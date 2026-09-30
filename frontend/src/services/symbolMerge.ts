import { getAllByIndex, getAllRows, idbRequest, runTransaction } from "../idb/repository";
import { acquireMergeLock, releaseMergeLock } from "../idb/mergeLock";
import { writeLog, writeWarn } from "../utils/logger";
import { ServiceError } from "../utils/errors";
import {
  createCommittedSymbolMerge,
  createFailedSymbolMerge,
  createPendingSymbolMerge,
  createRevertedSymbolMerge,
  createSymbolMergeSnapshot
} from "../constructors/SymbolMergeConstructor";
import { buildReferenceSummary, createSnapshotFromPreview } from "./mergePreview";
import { buildSymbolAliasMap } from "./symbolResolve";
import type { AnswerRecord } from "../types/AnswerRecord";
import type { Lesson } from "../types/Lesson";
import type { MergeCommitResult, SymbolMerge, SymbolMergeSnapshot } from "../types/SymbolMerge";

export interface CommitSymbolMergeInput {
  requestId: string;
  keptSymbolId: number;
  mergedSymbolId: number;
  deviceId: string;
  reason?: string;
}

const nowIso = () => new Date().toISOString();

/** 台账查询（页面“归并记录”列表与按请求编号恢复共用） */
export async function listSymbolMerges(): Promise<SymbolMerge[]> {
  const rows = await getAllRows("symbolMerge");
  return [...rows].sort((a, b) => b.id - a.id);
}

export async function findMergeByRequestId(requestId: string): Promise<SymbolMerge | undefined> {
  const rows = await getAllByIndex("symbolMerge", "by_request", requestId);
  return rows[0];
}

async function requireMergeByRequestId(requestId: string): Promise<SymbolMerge> {
  const merge = await findMergeByRequestId(requestId);
  if (!merge) throw new ServiceError("MERGE_REQUEST_NOT_FOUND", { requestId });
  return merge;
}

/**
 * 提交字符归并。完整时序：
 * 1. 幂等检查：相同 requestId 已存在 -> 返回既有结果（同参）或报冲突（异参）。
 * 2. 先落 FAILED 台账（含完整快照），任何一步失败都能凭请求编号恢复。
 * 3. CAS 抢占归并锁，两台设备并发时只有一笔 ACQUIRED，另一笔 BUSY 且不改动任何引用。
 * 4. 单事务迁移课程/会话/答题记录并删除待并入卡片，失败整体回滚，不留半套引用。
 * 5. 台账置 MERGED 并释放锁。
 */
export async function commitSymbolMerge(input: CommitSymbolMergeInput): Promise<MergeCommitResult> {
  validateInput(input);

  const existed = await findMergeByRequestId(input.requestId);
  if (existed) {
    if (
      existed.kept_symbol_id !== input.keptSymbolId ||
      existed.merged_symbol_id !== input.mergedSymbolId
    ) {
      throw new ServiceError("MERGE_DUPLICATE_CONFLICT", { requestId: input.requestId });
    }
    if (existed.status === "MERGED" || existed.status === "REVERTED") {
      return toCommitResult(existed);
    }
    // FAILED：凭原请求编号继续恢复，复用同一台账行
    return recoverFailedMerge(existed, input.deviceId);
  }

  // 预览与快照必须先于加锁生成；旧编号已经处于其他归并链时禁止再次归并
  const [keptSummary, mergedSummary, merges] = await Promise.all([
    buildReferenceSummary(input.keptSymbolId),
    buildReferenceSummary(input.mergedSymbolId),
    listSymbolMerges()
  ]);
  if (!keptSummary.symbol) throw new ServiceError("MERGE_CARD_NOT_FOUND", { symbolId: input.keptSymbolId });
  if (!mergedSummary.symbol) throw new ServiceError("MERGE_CARD_NOT_FOUND", { symbolId: input.mergedSymbolId });

  const aliases = buildSymbolAliasMap(merges);
  if (aliases.aliasToKept.has(input.keptSymbolId)) {
    throw new ServiceError("MERGE_ALIAS_AMBIGUOUS", { oldId: input.keptSymbolId });
  }
  if (aliases.aliasToKept.has(input.mergedSymbolId)) {
    throw new ServiceError("MERGE_ALIAS_AMBIGUOUS", { oldId: input.mergedSymbolId });
  }

  const snapshot: SymbolMergeSnapshot = createSymbolMergeSnapshot({
    kept: keptSummary.symbol,
    merged: mergedSummary.symbol,
    ...createSnapshotFromPreview({ kept: keptSummary, merged: mergedSummary })
  });

  const pending = createPendingSymbolMerge({
    requestId: input.requestId,
    keptSymbolId: input.keptSymbolId,
    mergedSymbolId: input.mergedSymbolId,
    deviceId: input.deviceId,
    reason: input.reason ?? "同一字符重复建卡，归并课程与错题引用",
    snapshot,
    now: nowIso()
  });
  const pendingId = await persistPendingMerge(pending);

  return runMergeWithLock({ ...pending, id: pendingId }, input.deviceId);
}

function validateInput(input: CommitSymbolMergeInput): void {
  if (!input.requestId) throw new ServiceError("VALIDATION_FAILED");
  if (input.keptSymbolId === input.mergedSymbolId) {
    throw new ServiceError("MERGE_SAME_CARD", { symbolId: input.keptSymbolId });
  }
  if (!Number.isInteger(input.keptSymbolId) || !Number.isInteger(input.mergedSymbolId)) {
    throw new ServiceError("VALIDATION_FAILED");
  }
  if (!input.deviceId) throw new ServiceError("VALIDATION_FAILED");
}

async function persistPendingMerge(pending: SymbolMerge): Promise<number> {
  // symbolMerge 是自增主键表：放入前剥掉构造器里的占位 id（0），
  // 否则多行都落到 key 0，会撞 by_request 唯一索引并污染后续事务
  const { id: _omit, ...row } = pending;
  return runTransaction(["symbolMerge"], "readwrite", async (stores) => {
    const addResult = await idbRequest(stores.symbolMerge.add(row) as IDBRequest<number>);
    writeLog("SymbolMerge", "字符归并提交", { requestId: pending.request_id, stage: "FAILED-LEDGER-PREWRITTEN" });
    return addResult;
  });
}

async function runMergeWithLock(pending: SymbolMerge, deviceId: string): Promise<MergeCommitResult> {
  const lock = await acquireMergeLock({
    deviceId,
    requestId: pending.request_id,
    keptSymbolId: pending.kept_symbol_id,
    mergedSymbolId: pending.merged_symbol_id
  });

  if (lock.outcome === "BUSY") {
    // 他机持锁：本次一笔引用都不动，台账停在 FAILED，提示凭原请求编号恢复
    writeWarn("SymbolMerge", "字符归并抢占冲突", {
      requestId: pending.request_id,
      holder: lock.holder.held_by
    });
    throw new ServiceError("MERGE_LOCK_BUSY", { requestId: pending.request_id });
  }

  try {
    const result = await migrateReferences(pending, deviceId);
    writeLog("SymbolMerge", "字符归并提交", {
      requestId: pending.request_id,
      stolen: lock.outcome === "STOLEN",
      lessons: result.migratedLessonIds.length,
      sessions: result.migratedSessionIds.length,
      answers: result.migratedAnswerRecordIds.length
    });
    return result;
  } catch (error) {
    // 迁移事务整体回滚，不会留下半套引用；台账保留 FAILED 快照等待恢复
    await markLedgerFailed(pending, error);
    throw error;
  } finally {
    await releaseMergeLock(lock.lease).catch(() => undefined);
  }
}

/**
 * 单事务迁移全部引用：
 * - 课程 symbol_ids：旧编号替换为保留编号，并去重（同一课程不会出现重复字符）
 * - 答题记录：symbol_id 改指保留卡片；同一会话下与保留卡片已有记录重复时保留两行历史
 * - 练习会话：经答题记录关联，无需改字段，快照中留存用于预览与拆回
 * - 删除待并入卡片；台账置 MERGED
 */
async function migrateReferences(pending: SymbolMerge, deviceId: string): Promise<MergeCommitResult> {
  return runTransaction(
    ["brailleSymbol", "lesson", "practiceSession", "answerRecord", "symbolMerge"],
    "readwrite",
    async (stores) => {
      const migratedLessonIds: number[] = [];
      const migratedAnswerRecordIds: number[] = [];
      const sessionIds = new Set<number>();

      // 加锁后重新读卡片，防止预览后他机改动（STALE 则整体中止）
      const [keptRow, mergedRow] = await Promise.all([
        idbRequest(stores.brailleSymbol.get(pending.kept_symbol_id)),
        idbRequest(stores.brailleSymbol.get(pending.merged_symbol_id))
      ]);
      if (!keptRow || !mergedRow) {
        throw new ServiceError("MERGE_CARD_NOT_FOUND", { symbolId: pending.merged_symbol_id });
      }

      const lessonRows = (await idbRequest(stores.lesson.getAll())) as Lesson[];
      for (const lesson of lessonRows) {
        if (!lesson.symbol_ids.includes(pending.merged_symbol_id)) continue;
        const replaced = lesson.symbol_ids.map((id) =>
          id === pending.merged_symbol_id ? pending.kept_symbol_id : id
        );
        const nextLesson: Lesson = { ...lesson, symbol_ids: [...new Set(replaced)] };
        await idbRequest(stores.lesson.put(nextLesson));
        migratedLessonIds.push(lesson.id);
      }

      const answerRows = (await idbRequest(stores.answerRecord.getAll())) as AnswerRecord[];
      for (const record of answerRows) {
        if (record.symbol_id !== pending.merged_symbol_id) continue;
        const nextRecord: AnswerRecord = { ...record, symbol_id: pending.kept_symbol_id };
        await idbRequest(stores.answerRecord.put(nextRecord));
        migratedAnswerRecordIds.push(record.id);
        sessionIds.add(record.session_id);
      }

      await idbRequest(stores.brailleSymbol.delete(pending.merged_symbol_id));

      const ledger = (await idbRequest(stores.symbolMerge.get(pending.id))) as SymbolMerge;
      const committed = createCommittedSymbolMerge(
        ledger ?? pending,
        {
          migratedLessonIds,
          migratedSessionIds: [...sessionIds],
          migratedAnswerRecordIds,
          duplicateAnswerRecordIds: []
        },
        deviceId,
        nowIso()
      );
      await idbRequest(stores.symbolMerge.put(committed));

      return {
        merge: committed,
        migratedLessonIds,
        migratedSessionIds: [...sessionIds],
        migratedAnswerRecordIds
      };
    }
  );
}

async function markLedgerFailed(pending: SymbolMerge, error: unknown): Promise<void> {
  const code = error instanceof ServiceError ? error.code : "SERVICE_ERROR";
  const detail = error instanceof Error ? error.message : String(error);
  await runTransaction(["symbolMerge"], "readwrite", async (stores) => {
    const ledger = (await idbRequest(stores.symbolMerge.get(pending.id))) as SymbolMerge | undefined;
    if (!ledger || ledger.status !== "MERGED") {
      await idbRequest(stores.symbolMerge.put(createFailedSymbolMerge(ledger ?? pending, code, detail)));
    }
  }).catch(() => undefined);
}

/**
 * 失败恢复：必须凭原请求编号。
 * MERGED/REVERTED 幂等返回；FAILED 则用台账里冻结的快照重新抢锁迁移。
 */
export async function recoverSymbolMerge(requestId: string, deviceId: string): Promise<MergeCommitResult> {
  const merge = await requireMergeByRequestId(requestId);
  if (merge.status === "MERGED") return toCommitResult(merge);
  if (merge.status === "REVERTED") {
    throw new ServiceError("MERGE_ALREADY_REVERTED", { requestId });
  }
  writeLog("SymbolMerge", "字符归并失败恢复", { requestId, deviceId });
  return runMergeWithLock(merge, deviceId);
}

async function recoverFailedMerge(failed: SymbolMerge, deviceId: string): Promise<MergeCommitResult> {
  if (failed.status !== "FAILED") return toCommitResult(failed);
  return runMergeWithLock(failed, deviceId);
}

/**
 * 按快照拆回误合的归并。
 * 前提：该归并未被后续归并依赖（保留卡片不能已并入他卡、旧编号不能被新记录占用）。
 * 单事务恢复课程/答题记录原行、恢复待并入卡片、台账置 REVERTED。
 */
export async function revertSymbolMerge(requestId: string, deviceId: string): Promise<SymbolMerge> {
  const merge = await requireMergeByRequestId(requestId);
  if (merge.status === "REVERTED") {
    throw new ServiceError("MERGE_ALREADY_REVERTED", { requestId });
  }
  if (merge.status === "FAILED") {
    // 失败的归并未真正改动数据，无需拆回；应走“凭原请求编号恢复”
    throw new ServiceError("MERGE_NOT_REVERSIBLE", { requestId });
  }

  const merges = await listSymbolMerges();
  // 归并链必须按逆序拆回：只有当“本笔的保留卡片自己又作为待并入卡片
  // 进入了另一条仍生效（MERGED）的归并”时才阻塞。
  // 更早的一笔（merged_symbol_id 等于本笔的待并入卡片）不阻塞，
  // 已按快照拆回（REVERTED）的记录也不阻塞。
  const dependent = merges.find(
    (item) => item.id !== merge.id && item.status === "MERGED" && item.merged_symbol_id === merge.kept_symbol_id
  );
  if (dependent) {
    throw new ServiceError("MERGE_CHAIN_BLOCKED", { symbolId: dependent.merged_symbol_id });
  }

  const lock = await acquireMergeLock({
    deviceId,
    requestId,
    keptSymbolId: merge.kept_symbol_id,
    mergedSymbolId: merge.merged_symbol_id
  });
  if (lock.outcome === "BUSY") {
    throw new ServiceError("MERGE_LOCK_BUSY", { requestId });
  }

  try {
    const reverted = await runTransaction(
      ["brailleSymbol", "lesson", "answerRecord", "symbolMerge"],
      "readwrite",
      async (stores) => {
        // 旧编号位置不能已被新卡片占用
        const occupied = await idbRequest(stores.brailleSymbol.get(merge.merged_symbol_id));
        if (occupied) throw new ServiceError("MERGE_CHAIN_BLOCKED", { symbolId: merge.merged_symbol_id });

        const { snapshot } = merge;
        await idbRequest(stores.brailleSymbol.put(snapshot.merged));

        for (const lesson of snapshot.lessons) {
          await idbRequest(stores.lesson.put(structuredClone(lesson)));
        }
        for (const record of snapshot.answerRecords) {
          await idbRequest(stores.answerRecord.put(structuredClone(record)));
        }

        const ledger = (await idbRequest(stores.symbolMerge.get(merge.id))) as SymbolMerge;
        const revertedRow = createRevertedSymbolMerge(ledger ?? merge, deviceId, nowIso());
        await idbRequest(stores.symbolMerge.put(revertedRow));
        return revertedRow;
      }
    );
    writeLog("SymbolMerge", "字符归并按快照拆回", { requestId, deviceId });
    return reverted;
  } finally {
    await releaseMergeLock(lock.lease).catch(() => undefined);
  }
}

function toCommitResult(merge: SymbolMerge): MergeCommitResult {
  return {
    merge,
    migratedLessonIds: [],
    migratedSessionIds: [],
    migratedAnswerRecordIds: []
  };
}
