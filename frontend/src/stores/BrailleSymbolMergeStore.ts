import { create } from "zustand";
import * as mergeApi from "../api/BrailleSymbolMerge";
import type {
  BrailleSymbolMerge,
  MergePreview,
  MergeRequest,
  MergeResult
} from "../types/BrailleSymbolMerge";
import { isMergeError } from "../errors/MergeError";

type State = {
  merges: BrailleSymbolMerge[];
  preview: MergePreview | null;
  loading: boolean;
  error: string | null;
  lastResult: MergeResult | null;
  loadMerges: () => Promise<void>;
  previewMerge: (sourceId: number, targetId: number) => Promise<void>;
  executeMerge: (request: MergeRequest) => Promise<MergeResult>;
  rollbackMerge: (requestId: string) => Promise<void>;
  clearError: () => void;
  clearPreview: () => void;
};

function toErrorMessage(error: unknown): string {
  if (isMergeError(error)) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

export const useBrailleSymbolMergeStore = create<State>((set, get) => ({
  merges: [],
  preview: null,
  loading: false,
  error: null,
  lastResult: null,

  async loadMerges() {
    set({ loading: true, error: null });
    try {
      const merges = await mergeApi.listMerges();
      set({ merges, loading: false });
    } catch (error) {
      set({ error: toErrorMessage(error), loading: false });
    }
  },

  async previewMerge(sourceId, targetId) {
    set({ loading: true, error: null });
    try {
      const preview = await mergeApi.previewMerge(sourceId, targetId);
      set({ preview, loading: false });
    } catch (error) {
      set({ error: toErrorMessage(error), loading: false });
    }
  },

  async executeMerge(request) {
    set({ loading: true, error: null });
    try {
      const result = await mergeApi.executeMerge(request);
      set({ lastResult: result, loading: false });
      await get().loadMerges();
      return result;
    } catch (error) {
      set({ error: toErrorMessage(error), loading: false });
      throw error;
    }
  },

  async rollbackMerge(requestId) {
    set({ loading: true, error: null });
    try {
      await mergeApi.rollbackMerge(requestId);
      set({ loading: false });
      await get().loadMerges();
    } catch (error) {
      set({ error: toErrorMessage(error), loading: false });
    }
  },

  clearError() {
    set({ error: null });
  },

  clearPreview() {
    set({ preview: null });
  }
}));
