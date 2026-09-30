import { create } from "zustand";
import {
  commitSymbolMergeApi,
  listSymbolMergeApi,
  previewSymbolMergeApi,
  recoverSymbolMergeApi,
  revertSymbolMergeApi
} from "../api/SymbolMerge";
import { getDeviceId, createMergeRequestId } from "../utils/mergeIds";
import { useBrailleSymbolStore } from "./BrailleSymbolStore";
import { useLessonStore } from "./LessonStore";
import { usePracticeSessionStore } from "./PracticeSessionStore";
import { useAnswerRecordStore } from "./AnswerRecordStore";
import type { MergePreview, SymbolMerge } from "../types/SymbolMerge";

interface MergeDraft {
  requestId: string;
  keptSymbolId: number;
  mergedSymbolId: number;
  reason: string;
}

type State = {
  deviceId: string;
  merges: SymbolMerge[];
  preview: MergePreview | null;
  draft: MergeDraft | null;
  submitting: boolean;
  loading: boolean;
  message: string | null;
  previewMerge: (keptSymbolId: number, mergedSymbolId: number) => Promise<void>;
  beginDraft: (keptSymbolId: number, mergedSymbolId: number, reason?: string) => string;
  submit: () => Promise<boolean>;
  recover: (requestId: string) => Promise<boolean>;
  revert: (requestId: string) => Promise<boolean>;
  loadMerges: () => Promise<void>;
  resetSelection: () => void;
  clearMessage: () => void;
};

/** 归并完成后让四个实体 store 全部重读，错题本与学习进度随即按保留卡片重算 */
async function reloadAllEntities(): Promise<void> {
  await Promise.all([
    useBrailleSymbolStore.getState().load(true),
    useLessonStore.getState().load(true),
    usePracticeSessionStore.getState().load(true),
    useAnswerRecordStore.getState().load(true)
  ]);
}

export const useSymbolMergeStore = create<State>((set, get) => ({
  deviceId: getDeviceId(),
  merges: [],
  preview: null,
  draft: null,
  submitting: false,
  loading: false,
  message: null,

  async previewMerge(keptSymbolId, mergedSymbolId) {
    set({ loading: true, message: null });
    try {
      const preview = await previewSymbolMergeApi(keptSymbolId, mergedSymbolId);
      set({ preview, loading: false });
    } catch (error) {
      set({ loading: false, message: describeError(error) });
      throw error;
    }
  },

  beginDraft(keptSymbolId, mergedSymbolId, reason) {
    const requestId = createMergeRequestId();
    set({
      draft: { requestId, keptSymbolId, mergedSymbolId, reason: reason ?? "同一字符重复建卡，归并课程与错题引用" },
      message: null
    });
    return requestId;
  },

  async submit() {
    const draft = get().draft;
    if (!draft || get().submitting) return false;
    set({ submitting: true, message: null });
    try {
      await commitSymbolMergeApi({ ...draft, deviceId: get().deviceId });
      await reloadAllEntities();
      await get().loadMerges();
      set({ submitting: false, draft: null, preview: null, message: "归并完成：课程、练习会话、答题记录已统一迁到保留卡片" });
      return true;
    } catch (error) {
      // 并发抢占时保留原 draft（含请求编号），页面可直接点“凭原请求编号恢复”
      set({ submitting: false, message: describeError(error) });
      return false;
    }
  },

  async recover(requestId) {
    set({ submitting: true, message: null });
    try {
      await recoverSymbolMergeApi(requestId, get().deviceId);
      await reloadAllEntities();
      await get().loadMerges();
      set({ submitting: false, draft: null, preview: null, message: `请求编号 ${requestId} 已恢复并完成归并` });
      return true;
    } catch (error) {
      set({ submitting: false, message: describeError(error) });
      return false;
    }
  },

  async revert(requestId) {
    set({ submitting: true, message: null });
    try {
      await revertSymbolMergeApi(requestId, get().deviceId);
      await reloadAllEntities();
      await get().loadMerges();
      set({ submitting: false, message: `请求编号 ${requestId} 已按快照拆回` });
      return true;
    } catch (error) {
      set({ submitting: false, message: describeError(error) });
      return false;
    }
  },

  async loadMerges() {
    set({ loading: true });
    try {
      set({ merges: await listSymbolMergeApi(), loading: false });
    } catch (error) {
      set({ loading: false, message: describeError(error) });
    }
  },

  clearMessage() {
    set({ message: null });
  },

  resetSelection() {
    set({ preview: null, draft: null, message: null });
  }
}));

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
