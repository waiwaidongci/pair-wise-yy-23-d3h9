export const MasteryLevel = ["NEW", "LEARNING", "FAMILIAR", "MASTERED"] as const;
export type MasteryLevel = (typeof MasteryLevel)[number];
export const MasteryLevelText: Record<MasteryLevel, string> = {
  NEW: "NEW",
  LEARNING: "LEARNING",
  FAMILIAR: "FAMILIAR",
  MASTERED: "MASTERED"
};
