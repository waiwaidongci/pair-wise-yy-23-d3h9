export const ERROR_MESSAGES = {
  AUTH_REQUIRED: "请先登录后再继续操作",
  RBAC_DENIED: "当前角色没有执行该动作的权限",
  VALIDATION_FAILED: "表单字段缺失或格式错误",
  RATE_LIMITED: "请求过于频繁，请稍后再试",
  MERGE_SAME_CARD: "保留卡片与待并入卡片不能是同一张：{symbolId}",
  MERGE_CARD_NOT_FOUND: "找不到归并所需的点字字符卡片：{symbolId}",
  MERGE_ALIAS_AMBIGUOUS: "旧编号 {oldId} 已处于另一条归并链中，不能重复归并",
  MERGE_DUPLICATE_CONFLICT: "请求编号 {requestId} 已用于另一组卡片的归并，请更换请求编号",
  MERGE_LOCK_BUSY: "另一台设备正在归并该组卡片，本次只允许一笔生效，可凭原请求编号 {requestId} 恢复",
  MERGE_NOT_FAILED: "请求编号 {requestId} 当前不是失败状态，无需恢复",
  MERGE_ALREADY_REVERTED: "请求编号 {requestId} 已按快照拆回，请勿重复操作",
  MERGE_CHAIN_BLOCKED: "卡片 {symbolId} 已被后续归并引用，请先拆回依赖的归并记录",
  MERGE_STALE_CONFLICT: "卡片 {symbolId} 在预览后发生变化，已放弃本次归并以免覆盖他机修改",
  MERGE_NOT_REVERSIBLE: "请求编号 {requestId} 已成功归并，不能直接恢复，如需还原请使用按快照拆回",
  MERGE_REQUEST_NOT_FOUND: "找不到请求编号 {requestId} 对应的归并记录",
  SERVICE_ERROR: "归并服务处理失败：{detail}",
  API_ERROR: "归并接口调用失败：{detail}",
  CONTROLLER_ERROR: "归并操作未完成：{detail}"
};

export type ErrorMessageKey = keyof typeof ERROR_MESSAGES;
