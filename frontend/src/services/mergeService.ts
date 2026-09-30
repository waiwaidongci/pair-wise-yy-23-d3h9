import { database, deepClone, type DbShape } from "../db/database";
import type { BrailleSymbol } from "../types/BrailleSymbol";
import type { Lesson } from "../types/Lesson";
import type { AnswerRecord } from "../types/AnswerRecord";
import type { PracticeSession } from "../types/PracticeSession";
import type {
  BrailleSymbolMerge,
  MergePreview,
  MergeRequest,
  MergeResult,
  MergeSnapshot,
  AffectedRecordSnapshot,
  SymbolIdMapping
} from "../types/BrailleSymbolMerge";
import {
  createDefaultBrailleSymbolMerge
} from "../constructors/BrailleSymbolMergeConstructor";
import { MergeError } from "../errors/MergeError";
import { LOG_TEMPLATES } from "../constants/logTemplates";
import { recalculateDerivedStats } from "./statsService";

function now(): string {
  return new Date().toISOString();
}

function throwMergeError(code: string): never {
  throw new MergeError(code);
}

function nextId(rows: { id: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
}

/**
 * 课程 symbol_ids 归并：source → target，去重并保留 target。
 */
function migrateSymbolIds(ids: number[], sourceId: number, targetId: number): number[] {
  const next = ids.map((id) => (id === sourceId ? targetId : id));
  return [...new Set(next)];
}

/**
 * 构建归并快照（归并前的完整状态，用于拆回）。
 */
function buildSnapshot(sourceId: number, targetId: number): MergeSnapshot {
  const source = database.getById<BrailleSymbol>("brailleSymbol", sourceId);
  if (!source) throwMergeError("MERGE_SYMBOL_NOT_FOUND");
  const allLessons = database.getAll<Lesson>("lesson");
  const allAnswerRecords = database.getAll<AnswerRecord>("answerRecord");
  const allSessions = database.getAll<PracticeSession>("practiceSession");

  const affectedLessons = allLessons.filter((lesson) => lesson.symbol_ids.includes(sourceId));
  const affectedAnswerRecords = allAnswerRecords.filter((record) => record.symbol_id === sourceId);

  const impactedSessionIds = new Set<number>();
  for (const lesson of affectedLessons) {
    for (const session of allSessions) {
      if (session.lesson_id === lesson.id) impactedSessionIds.add(session.id);
    }
  }
  for (const record of affectedAnswerRecords) {
    impactedSessionIds.add(record.session_id);
  }

  const lessonSnaps: AffectedRecordSnapshot[] = affectedLessons.map((lesson) => ({
    table: "lesson",
    record_id: lesson.id,
    before: deepClone(lesson) as unknown as Record<string, unknown>,
    after: {
      ...deepClone(lesson),
      symbol_ids: migrateSymbolIds(lesson.symbol_ids, sourceId, targetId)
    } as unknown as Record<string, unknown>
  }));

  const answerRecordSnaps: AffectedRecordSnapshot[] = affectedAnswerRecords.map((record) => ({
    table: "answerRecord",
    record_id: record.id,
    before: deepClone(record) as unknown as Record<string, unknown>,
    after: { ...deepClone(record), symbol_id: targetId } as unknown as Record<string, unknown>
  }));

  return {
    source_symbol: deepClone(source!),
    affected_lessons: lessonSnaps,
    affected_answer_records: answerRecordSnaps,
    impacted_session_ids: [...impactedSessionIds]
  };
}

/**
 * 归并预览：列出受影响的课程、练习会话和答题记录。
 */
export function previewMerge(sourceId: number, targetId: number): MergePreview {
  const source = database.getById<BrailleSymbol>("brailleSymbol", sourceId);
  const target = database.getById<BrailleSymbol>("brailleSymbol", targetId);
  if (!source || !target) throwMergeError("MERGE_SYMBOL_NOT_FOUND");

  const snapshot = buildSnapshot(sourceId, targetId);
  const allSessions = database.getAll<PracticeSession>("practiceSession");

  const impactedSessions = snapshot.impacted_session_ids
    .map((id) => allSessions.find((session) => session.id === id))
    .filter((session): session is PracticeSession => Boolean(session))
    .map((session) => ({
      id: session.id,
      lesson_id: session.lesson_id,
      mode: session.mode,
      started_at: session.started_at
    }));

  const conflictWarning =
    source.cell_pattern === target.cell_pattern
      ? `两张卡片点位相同（${source.cell_pattern}），归并后将保留「${target.letter}」并删除重复卡片`
      : null;

  return {
    source,
    target,
    affected_lessons: snapshot.affected_lessons.map((snap) => {
      const after = snap.after as unknown as Lesson;
      return { id: snap.record_id, title: after.title, symbol_ids: after.symbol_ids };
    }),
    impacted_sessions: impactedSessions,
    affected_answer_records: snapshot.affected_answer_records.map((snap) => {
      const after = snap.after as unknown as AnswerRecord;
      return {
        id: snap.record_id,
        session_id: after.session_id,
        symbol_id: after.symbol_id,
        correct: String(after.correct)
      };
    }),
    conflict_warning: conflictWarning
  };
}

function upsertMergeRecord(draft: DbShape, record: BrailleSymbolMerge): void {
  const index = draft.mergeRecord.findIndex((row) => row.id === record.id);
  if (index >= 0) {
    draft.mergeRecord[index] = record;
  } else {
    draft.mergeRecord.push(record);
  }
}

/**
 * 幂等恢复：按原请求编号查找归并记录。
 */
export function getMergeByRequestId(requestId: string): BrailleSymbolMerge | undefined {
  return database
    .getAll<BrailleSymbolMerge>("mergeRecord")
    .find((record) => record.request_id === requestId);
}

export function listMerges(): BrailleSymbolMerge[] {
  return database.getAll<BrailleSymbolMerge>("mergeRecord");
}

/**
 * 查找某张卡片被归并到的保留卡片（用于并发冲突后的幂等重放）。
 */
function findCommittedTarget(sourceId: number): number | null {
  const mapping = database
    .getAll<SymbolIdMapping>("symbolIdMapping")
    .find((row) => row.old_id === sourceId);
  return mapping ? mapping.new_id : null;
}

/**
 * 执行字符归并。
 *
 * 流程：
 * 1. 幂等检查：同 request_id 已提交则直接返回（失败后凭原请求编号恢复）。
 * 2. 校验：source ≠ target，且两者存在。
 * 3. 构建快照（用于拆回）。
 * 4. 乐观锁 CAS：仅当版本未变时提交，保证两台设备只有一笔生效。
 * 5. 事务内完成：写归并记录 + 迁移课程/答题记录 + 删除源卡片 + 写编号映射。
 * 6. 重算错题本与学习进度。
 */
export function executeMerge(request: MergeRequest): MergeResult {
  const { request_id, source_symbol_id, target_symbol_id } = request;
  if (!request_id) throwMergeError("VALIDATION_FAILED");

  // 1. 幂等检查
  const existing = getMergeByRequestId(request_id);
  if (existing) {
    if (existing.status === "COMMITTED") {
      logMerge("字符归并幂等重放", { request_id, source_symbol_id, target_symbol_id });
      return {
        merge: existing,
        idempotent_replay: true,
        migrated_lesson_count: existing.affected_lesson_ids.length,
        migrated_answer_record_count: existing.affected_answer_record_ids.length
      };
    }
    if (existing.status === "ROLLED_BACK") {
      throwMergeError("MERGE_ALREADY_ROLLED_BACK");
    }
    // PENDING / FAILED：继续走提交流程（恢复）
  }

  // 2. 校验
  if (source_symbol_id === target_symbol_id) {
    throwMergeError("MERGE_SOURCE_TARGET_SAME");
  }
  const source = database.getById<BrailleSymbol>("brailleSymbol", source_symbol_id);
  const target = database.getById<BrailleSymbol>("brailleSymbol", target_symbol_id);
  if (!source || !target) {
    // 并发冲突后恢复：若源卡片已被另一台设备归并，尝试返回其结果
    const committedTarget = findCommittedTarget(source_symbol_id);
    if (committedTarget !== null) {
      const committed = database
        .getAll<BrailleSymbolMerge>("mergeRecord")
        .find((record) => record.source_symbol_id === source_symbol_id && record.status === "COMMITTED");
      if (committed) {
        return {
          merge: committed,
          idempotent_replay: true,
          migrated_lesson_count: committed.affected_lesson_ids.length,
          migrated_answer_record_count: committed.affected_answer_record_ids.length
        };
      }
    }
    throwMergeError("MERGE_SYMBOL_NOT_FOUND");
  }

  // 3. 构建快照
  const snapshot = buildSnapshot(source_symbol_id, target_symbol_id);
  const timestamp = now();

  const record: BrailleSymbolMerge = existing
    ? {
        ...existing,
        source_symbol_id,
        target_symbol_id,
        status: "COMMITTED",
        snapshot,
        affected_lesson_ids: snapshot.affected_lessons.map((snap) => snap.record_id),
        affected_session_ids: snapshot.impacted_session_ids,
        affected_answer_record_ids: snapshot.affected_answer_records.map((snap) => snap.record_id),
        conflict_version: null,
        error_code: null,
        error_message: null,
        updated_at: timestamp,
        committed_at: timestamp
      }
    : createDefaultBrailleSymbolMerge({
        request_id,
        source_symbol_id,
        target_symbol_id,
        status: "COMMITTED",
        snapshot,
        affected_lesson_ids: snapshot.affected_lessons.map((snap) => snap.record_id),
        affected_session_ids: snapshot.impacted_session_ids,
        affected_answer_record_ids: snapshot.affected_answer_records.map((snap) => snap.record_id),
        conflict_version: null,
        error_code: null,
        error_message: null,
        created_at: timestamp,
        updated_at: timestamp,
        committed_at: timestamp
      });

  // 4. 乐观锁 CAS：两台设备并发时只有一笔生效
  const expectedVersion = database.getVersion();
  const committed = database.cas((draft) => {
    // 5. 事务内统一迁移，不留下半套引用
    upsertMergeRecord(draft, record);

    for (const snap of snapshot.affected_lessons) {
      const lesson = draft.lesson.find((row) => row.id === snap.record_id);
      if (lesson) {
        lesson.symbol_ids = migrateSymbolIds(lesson.symbol_ids, source_symbol_id, target_symbol_id);
      }
    }
    for (const snap of snapshot.affected_answer_records) {
      const answerRecord = draft.answerRecord.find((row) => row.id === snap.record_id);
      if (answerRecord) {
        answerRecord.symbol_id = target_symbol_id;
      }
    }

    // 删除待并入卡片
    draft.brailleSymbol = draft.brailleSymbol.filter((row) => row.id !== source_symbol_id);

    // 旧编号保留来源：写入映射
    const mapping: SymbolIdMapping = {
      id: nextId(draft.symbolIdMapping),
      old_id: source_symbol_id,
      new_id: target_symbol_id,
      merge_record_id: record.id,
      merged_at: timestamp
    };
    draft.symbolIdMapping.push(mapping);
  }, expectedVersion);

  if (!committed) {
    // 版本冲突：另一台设备已提交。不写任何引用，抛冲突错误。
    // 客户端可凭原请求编号重试（幂等重放）。
    throwMergeError("MERGE_CONFLICT");
  }

  // 6. 重算错题本与学习进度
  recalculateDerivedStats();

  logMerge("字符归并提交完成", {
    request_id,
    source_symbol_id,
    target_symbol_id,
    migrated_lessons: snapshot.affected_lessons.length,
    migrated_answer_records: snapshot.affected_answer_records.length
  });

  return {
    merge: record,
    idempotent_replay: false,
    migrated_lesson_count: snapshot.affected_lessons.length,
    migrated_answer_record_count: snapshot.affected_answer_records.length
  };
}

/**
 * 按快照拆回：把已归并的卡片与引用恢复到归并前状态。
 */
export function rollbackMerge(requestId: string): BrailleSymbolMerge {
  const record = getMergeByRequestId(requestId);
  if (!record) throwMergeError("MERGE_NOT_FOUND");
  if (record.status === "ROLLED_BACK") throwMergeError("MERGE_ALREADY_ROLLED_BACK");
  if (record.status !== "COMMITTED") throwMergeError("MERGE_NOT_ROLLBACKABLE");
  if (!record.snapshot) throwMergeError("MERGE_SNAPSHOT_MISSING");

  const snapshot = record.snapshot;
  const timestamp = now();

  const expectedVersion = database.getVersion();
  const committed = database.cas((draft) => {
    // 恢复待并入卡片（若 id 已被占用则冲突）
    const exists = draft.brailleSymbol.some((row) => row.id === snapshot.source_symbol.id);
    if (exists) {
      throwMergeError("MERGE_ROLLBACK_CONFLICT");
    }
    draft.brailleSymbol.push(deepClone(snapshot.source_symbol));

    // 恢复课程
    for (const snap of snapshot.affected_lessons) {
      const lesson = draft.lesson.find((row) => row.id === snap.record_id);
      if (lesson) {
        const before = snap.before as unknown as Lesson;
        lesson.symbol_ids = before.symbol_ids;
      }
    }
    // 恢复答题记录
    for (const snap of snapshot.affected_answer_records) {
      const answerRecord = draft.answerRecord.find((row) => row.id === snap.record_id);
      if (answerRecord) {
        const before = snap.before as unknown as AnswerRecord;
        answerRecord.symbol_id = before.symbol_id;
      }
    }

    // 移除编号映射（旧编号不再指向保留卡片）
    draft.symbolIdMapping = draft.symbolIdMapping.filter(
      (row) => row.merge_record_id !== record.id
    );

    // 标记拆回
    const target = draft.mergeRecord.find((row) => row.id === record.id);
    if (target) {
      target.status = "ROLLED_BACK";
      target.updated_at = timestamp;
    }
  }, expectedVersion);

  if (!committed) {
    throwMergeError("MERGE_CONFLICT");
  }

  recalculateDerivedStats();

  logMerge("字符归并拆回完成", { request_id: requestId, source_symbol_id: record.source_symbol_id });

  return { ...record, status: "ROLLED_BACK", updated_at: timestamp };
}

/**
 * 解析旧编号：归并后可用旧编号查到保留卡片。
 */
export function resolveSymbolId(oldId: number): number {
  const mapping = database
    .getAll<SymbolIdMapping>("symbolIdMapping")
    .find((row) => row.old_id === oldId);
  return mapping ? mapping.new_id : oldId;
}

function logMerge(action: string, detail: Record<string, unknown>): void {
  // 日志模板集中管理，所有写操作记录日志
  const template = LOG_TEMPLATES.BrailleSymbolMerge.find((t) => t === action) ?? action;
  console.info(`[merge] ${template}`, detail);
}
