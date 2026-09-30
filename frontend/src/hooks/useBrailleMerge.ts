import { useCallback } from "react";
import { useBrailleSymbolMergeStore } from "../stores/BrailleSymbolMergeStore";

/**
 * 字符归并 hook。
 *
 * 在 store 之上提供原请求编号（request_id）生成能力：
 * 每台设备发起归并时生成唯一请求编号，失败后凭此编号幂等恢复。
 */
export function useBrailleMerge() {
  const store = useBrailleSymbolMergeStore();

  const generateRequestId = useCallback((): string => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }, []);

  return { ...store, generateRequestId };
}
