import { create } from "zustand";
import { listPracticeSession } from "../api/PracticeSession";
import type { PracticeSession } from "../types/PracticeSession";

type State = {
  rows: PracticeSession[];
  loading: boolean;
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
};

export const usePracticeSessionStore = create<State>((set, get) => ({
  rows: [],
  loading: false,
  loaded: false,
  async load(force = false) {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true });
    try {
      set({ rows: await listPracticeSession(), loading: false, loaded: true });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  }
}));
