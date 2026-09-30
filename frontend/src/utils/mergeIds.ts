/**
 * 生成原请求编号（幂等键）。
 * 失败后凭同一个 requestId 调恢复接口，重复提交也不会产生第二笔归并。
 */
export function createMergeRequestId(): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(16).slice(2, 10);
  return `mrg-${Date.now().toString(36)}-${random}`;
}

const DEVICE_KEY = "braille-trainer:device-id";

/** 设备编号：同一浏览器内稳定，两台设备并发归并时用于审计谁拿到锁 */
export function getDeviceId(): string {
  try {
    const existed = localStorage.getItem(DEVICE_KEY);
    if (existed) return existed;
    const created = `dev-${createMergeRequestId().slice(4)}`;
    localStorage.setItem(DEVICE_KEY, created);
    return created;
  } catch {
    // 隐私模式等场景下降级为会话级编号，锁与台账仍在 IndexedDB 中互斥
    return `dev-tmp-${Math.random().toString(16).slice(2, 10)}`;
  }
}
