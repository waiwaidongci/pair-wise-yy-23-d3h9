import type { AnswerRecord } from "./AnswerRecord";
import type { BrailleSymbol } from "./BrailleSymbol";
import type { Lesson } from "./Lesson";
import type { MergeStatusValue } from "./MergeStatus";
import type { PracticeSession } from "./PracticeSession";

/**
 * 字符归并台账：同一笔点字字符被建成两张卡片时，
 * 把“待并入卡片”统一迁到“保留卡片”，并在此留下可追溯、可拆回的记录。
 */
export interface SymbolMerge {
  id: number;
  /** 原请求编号：幂等键，失败后凭此编号恢复，不会重复归并 */
  request_id: string;
  /** 保留卡片编号 */
  kept_symbol_id: number;
  /** 待并入卡片编号（旧编号保留为来源别名） */
  merged_symbol_id: number;
  /** 发起设备编号（两台设备并发归并时用于审计谁生效） */
  initiated_by: string;
  status: MergeStatusValue;
  /** 归并前快照：误合时按快照把引用逐张拆回 */
  snapshot: SymbolMergeSnapshot;
  reason: string;
  created_at: string;
  finished_at: string;
  /** JSON 字符串：迁移结果、拆回设备等审计细节 */
  outcome: string;
}

/** 归并前的引用快照，拆回时逐表原样回放 */
export interface SymbolMergeSnapshot {
  kept: BrailleSymbol;
  merged: BrailleSymbol;
  /** 引用了待并入卡片的课程（整行留存） */
  lessons: Lesson[];
  /** 引用了待并入卡片的练习会话（经答题记录关联，整行留存） */
  sessions: PracticeSession[];
  /** 引用了待并入卡片的答题记录（整行留存） */
  answerRecords: AnswerRecord[];
}

/** 一张卡片在课程、练习会话、答题记录三处的引用清单 */
export interface MergeReferenceSummary {
  symbol: BrailleSymbol;
  lessons: Lesson[];
  sessions: PracticeSession[];
  answerRecords: AnswerRecord[];
  total: number;
}

/** 归并预览：先列出两张卡片各自被引用的位置，确认后再提交 */
export interface MergePreview {
  kept: MergeReferenceSummary;
  merged: MergeReferenceSummary;
}

export interface MergeCommitResult {
  merge: SymbolMerge;
  migratedLessonIds: number[];
  migratedSessionIds: number[];
  migratedAnswerRecordIds: number[];
}

/** 台账 outcome 字段的结构化审计细节（以 JSON 字符串存库） */
export interface MergeOutcomeDetail {
  stage: "PENDING" | "MERGED" | "REVERTED" | "FAILED";
  migratedLessonIds?: number[];
  migratedSessionIds?: number[];
  migratedAnswerRecordIds?: number[];
  duplicateAnswerRecordIds?: number[];
  finishedBy?: string;
  revertedBy?: string;
  failureCode?: string;
  detail?: string;
}
