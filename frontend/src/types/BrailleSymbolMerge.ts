import type { BrailleSymbol } from "./BrailleSymbol";

/**
 * 归并状态。
 * - PENDING: 已创建待提交（崩溃恢复时的中间态）
 * - COMMITTED: 已提交，引用已全部迁到保留卡片
 * - FAILED: 提交失败（可凭原请求编号重试）
 * - ROLLED_BACK: 已按快照拆回
 */
export type MergeStatus = "PENDING" | "COMMITTED" | "FAILED" | "ROLLED_BACK";

/**
 * 受影响记录的快照单元（用于拆回 / 快照恢复）。
 */
export interface AffectedRecordSnapshot {
  table: "lesson" | "answerRecord";
  record_id: number;
  /** 归并前完整记录 */
  before: Record<string, unknown>;
  /** 归并后完整记录 */
  after: Record<string, unknown>;
}

/**
 * 归并快照：记录归并前的完整状态，误合可按此拆回。
 */
export interface MergeSnapshot {
  /** 待并入卡片（归并后删除，拆回时恢复） */
  source_symbol: BrailleSymbol;
  /** 受影响课程（symbol_ids 含 source） */
  affected_lessons: AffectedRecordSnapshot[];
  /** 受影响答题记录（symbol_id = source） */
  affected_answer_records: AffectedRecordSnapshot[];
  /** 受影响练习会话 id（ blast radius，仅列出不迁移） */
  impacted_session_ids: number[];
}

/**
 * 字符归并记录。
 */
export interface BrailleSymbolMerge {
  id: number;
  /** 原请求编号（幂等键，失败后凭此恢复） */
  request_id: string;
  /** 待并入卡片 id */
  source_symbol_id: number;
  /** 保留卡片 id */
  target_symbol_id: number;
  status: MergeStatus;
  snapshot: MergeSnapshot | null;
  affected_lesson_ids: number[];
  affected_session_ids: number[];
  affected_answer_record_ids: number[];
  /** 提交时的乐观锁版本号 */
  conflict_version: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  committed_at: string | null;
}

/**
 * 旧编号 → 保留编号 映射（旧编号保留来源）。
 */
export interface SymbolIdMapping {
  id: number;
  old_id: number;
  new_id: number;
  merge_record_id: number;
  merged_at: string;
}

/**
 * 归并预览（影响分析）。
 */
export interface MergePreview {
  source: BrailleSymbol;
  target: BrailleSymbol;
  /** 受影响课程 */
  affected_lessons: { id: number; title: string; symbol_ids: number[] }[];
  /** 受影响练习会话（blast radius） */
  impacted_sessions: { id: number; lesson_id: number; mode: string; started_at: string }[];
  /** 受影响答题记录 */
  affected_answer_records: { id: number; session_id: number; symbol_id: number; correct: string }[];
  /** 冲突提示（如同位点字符） */
  conflict_warning: string | null;
}

/**
 * 归并请求。
 */
export interface MergeRequest {
  request_id: string;
  source_symbol_id: number;
  target_symbol_id: number;
}

/**
 * 归并结果。
 */
export interface MergeResult {
  merge: BrailleSymbolMerge;
  /** 是否为幂等重放（返回已提交的旧结果） */
  idempotent_replay: boolean;
  migrated_lesson_count: number;
  migrated_answer_record_count: number;
}
