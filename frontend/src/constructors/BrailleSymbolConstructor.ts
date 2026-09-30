import type { BrailleSymbol } from "../types/BrailleSymbol";

export const createDefaultBrailleSymbol = (overrides: Partial<BrailleSymbol> = {}): BrailleSymbol => ({
  id: 1,
  cell_pattern: "1",
  letter: "a",
  pinyin: "a",
  category: "LETTER",
  difficulty: "1",
  audio_hint_key: "letter:a",
  ...overrides
});

export const createBrailleSymbolForm = createDefaultBrailleSymbol;
export const createBrailleSymbolResponse = createDefaultBrailleSymbol;
