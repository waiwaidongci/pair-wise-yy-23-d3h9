import { create } from "zustand";
import { listBrailleSymbol } from "../api/BrailleSymbol";
import type { BrailleSymbol } from "../types/BrailleSymbol";

type State = {
  rows: BrailleSymbol[];
  loading: boolean;
  loaded: boolean;
  load: (force?: boolean) => Promise<void>;
};

export const useBrailleSymbolStore = create<State>((set, get) => ({
  rows: [],
  loading: false,
  loaded: false,
  async load(force = false) {
    if (get().loading || (get().loaded && !force)) return;
    set({ loading: true });
    try {
      set({ rows: await listBrailleSymbol(), loading: false, loaded: true });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  }
}));
