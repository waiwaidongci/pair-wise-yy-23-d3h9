import { create } from "zustand";
import { listAnswerRecord } from "../api/AnswerRecord";
import type { AnswerRecord } from "../types/AnswerRecord";

type State = {
  rows: AnswerRecord[];
  loading: boolean;
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
};

export const useAnswerRecordStore = create<State>((set, get) => ({
  rows: [],
  loading: false,
  loaded: false,
  async load(force = false) {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true });
    try {
      set({ rows: await listAnswerRecord(), loading: false, loaded: true });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  }
}));
