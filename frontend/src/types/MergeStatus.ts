export const MergeStatus = ["MERGED", "REVERTED", "FAILED"] as const;
export type MergeStatusValue = (typeof MergeStatus)[number];
export const MergeStatusText: Record<MergeStatusValue, string> = {
  MERGED: "MERGED",
  REVERTED: "REVERTED",
  FAILED: "FAILED"
};
