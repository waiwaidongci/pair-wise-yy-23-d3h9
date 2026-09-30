export const MergeStatus = ["PENDING", "COMMITTED", "FAILED", "ROLLED_BACK"] as const;
export type MergeStatus = (typeof MergeStatus)[number];
export const MergeStatusText: Record<MergeStatus, string> = {
  PENDING: "待提交",
  COMMITTED: "已归并",
  FAILED: "失败",
  ROLLED_BACK: "已拆回"
};
