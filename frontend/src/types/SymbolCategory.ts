export const SymbolCategory = ["LETTER", "NUMBER", "PUNCTUATION", "CONTRACTION"] as const;
export type SymbolCategory = (typeof SymbolCategory)[number];
export const SymbolCategoryText: Record<SymbolCategory, string> = {
  LETTER: "LETTER",
  NUMBER: "NUMBER",
  PUNCTUATION: "PUNCTUATION",
  CONTRACTION: "CONTRACTION"
};
