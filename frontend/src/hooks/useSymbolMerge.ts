import { useCallback } from "react";
import { ControllerError } from "../utils/errors";
import { useSymbolMergeStore } from "../stores/SymbolMergeStore";

/**
 * controller 层：页面只能通过本 hook 操作归并。
 * api/service 异常在 store 转成消息的同时，会经这里再包成 ControllerError，
 * 三层分别包装异常，禁止跨层吞异常。
 */
export function useSymbolMerge() {
  const store = useSymbolMergeStore();

  const wrap = useCallback(<Args extends unknown[], Result>(fn: (...args: Args) => Promise<Result>) => {
    return async (...args: Args): Promise<Result> => {
      try {
        return await fn(...args);
      } catch (error) {
        throw new ControllerError("CONTROLLER_ERROR", error);
      }
    };
  }, []);

  return {
    deviceId: store.deviceId,
    merges: store.merges,
    preview: store.preview,
    draft: store.draft,
    submitting: store.submitting,
    loading: store.loading,
    message: store.message,
    previewMerge: useCallback(
      (keptSymbolId: number, mergedSymbolId: number) =>
        wrap(store.previewMerge)(keptSymbolId, mergedSymbolId).then(() => true).catch(() => false),
      [wrap, store.previewMerge]
    ),
    beginDraft: store.beginDraft,
    submit: wrap(store.submit),
    recover: wrap(store.recover),
    revert: wrap(store.revert),
    loadMerges: store.loadMerges,
    resetSelection: store.resetSelection,
    clearMessage: store.clearMessage
  };
}
