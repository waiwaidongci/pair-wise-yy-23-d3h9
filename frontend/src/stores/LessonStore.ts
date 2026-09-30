import { create } from "zustand";
import { listLesson } from "../api/Lesson";
import type { Lesson } from "../types/Lesson";

type State = {
  rows: Lesson[];
  loading: boolean;
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
};

export const useLessonStore = create<State>((set, get) => ({
  rows: [],
  loading: false,
  loaded: false,
  async load(force = false) {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true });
    try {
      set({ rows: await listLesson(), loading: false, loaded: true });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  }
}));
