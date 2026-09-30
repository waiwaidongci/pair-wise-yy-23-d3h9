export const MergeStatus = ["MERGED", "REVERTED", "FAILED"] as const;
export type MergeStatus = (typeof MergeStatus)[number];
export const MergeStatusText: Record<MergeStatus, string> = {
  MERGED: "已归并",
  REVERTED: "已拆回",
  FAILED: "归并失败"
};
