export const ERROR_MESSAGES = {
  AUTH_REQUIRED: "请先登录后再继续操作",
  RBAC_DENIED: "当前角色没有执行该动作的权限",
  VALIDATION_FAILED: "表单字段缺失或格式错误",
  RATE_LIMITED: "请求过于频繁，请稍后再试",
  MERGE_SOURCE_TARGET_SAME: "保留卡片与待并入卡片不能为同一张",
  MERGE_SYMBOL_NOT_FOUND: "待并入或保留的点字卡片不存在，可能已被其他设备归并",
  MERGE_CONFLICT: "归并冲突：另一台设备已先提交，请刷新后重试",
  MERGE_ALREADY_COMMITTED: "该请求已归并完成，请勿重复提交",
  MERGE_NOT_FOUND: "未找到对应的归并记录",
  MERGE_SNAPSHOT_MISSING: "归并快照缺失，无法拆回",
  MERGE_NOT_ROLLBACKABLE: "当前归并状态不允许拆回",
  MERGE_ROLLBACK_CONFLICT: "拆回冲突：另一台设备已变更数据，请刷新后重试",
  MERGE_ALREADY_ROLLED_BACK: "该归并已拆回，请勿重复操作",
  MERGE_VERSION_MISMATCH: "数据版本不一致，请刷新后重试"
} as const;
