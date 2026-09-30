import type { MergeOutcomeDetail, SymbolMerge, SymbolMergeSnapshot } from "../types/SymbolMerge";
import type { MergeStatusValue } from "../types/MergeStatus";

/** 提交归并前台账行先落 FAILED：抢占失败也有来源可查、可凭请求编号恢复 */
export const createPendingSymbolMerge = (input: {
  requestId: string;
  keptSymbolId: number;
  mergedSymbolId: number;
  deviceId: string;
  reason: string;
  snapshot: SymbolMergeSnapshot;
  now: string;
}): SymbolMerge => ({
  id: 0,
  request_id: input.requestId,
  kept_symbol_id: input.keptSymbolId,
  merged_symbol_id: input.mergedSymbolId,
  initiated_by: input.deviceId,
  status: "FAILED",
  snapshot: input.snapshot,
  reason: input.reason,
  created_at: input.now,
  finished_at: input.now,
  outcome: serializeMergeOutcome({ stage: "PENDING" })
});

export const createSymbolMergeSnapshot = (
  snapshot: SymbolMergeSnapshot
): SymbolMergeSnapshot => structuredClone(snapshot);

export const createCommittedSymbolMerge = (
  pending: SymbolMerge,
  detail: Omit<MergeOutcomeDetail, "stage" | "finishedBy" | "revertedBy">,
  finishedBy: string,
  now: string
): SymbolMerge => ({
  ...pending,
  status: "MERGED",
  finished_at: now,
  outcome: serializeMergeOutcome({ ...detail, stage: "MERGED", finishedBy })
});

export const createRevertedSymbolMerge = (merge: SymbolMerge, revertedBy: string, now: string): SymbolMerge => ({
  ...merge,
  status: "REVERTED",
  finished_at: now,
  outcome: serializeMergeOutcome({
    ...parseMergeOutcome(merge.outcome),
    stage: "REVERTED",
    revertedBy
  })
});

export const createFailedSymbolMerge = (pending: SymbolMerge, failureCode: string, detail: string): SymbolMerge => ({
  ...pending,
  status: "FAILED",
  outcome: serializeMergeOutcome({
    ...parseMergeOutcome(pending.outcome),
    stage: "FAILED",
    failureCode,
    detail
  })
});

export const serializeMergeOutcome = (detail: MergeOutcomeDetail): string => JSON.stringify(detail);

export const parseMergeOutcome = (raw: string): MergeOutcomeDetail => {
  try {
    return JSON.parse(raw) as MergeOutcomeDetail;
  } catch {
    return { stage: "PENDING" };
  }
};

export type { MergeStatusValue };
