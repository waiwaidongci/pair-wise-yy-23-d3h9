export const PracticeMode = ["CELL_TO_TEXT", "TEXT_TO_CELL", "LISTENING", "MIXED"] as const;
export type PracticeMode = (typeof PracticeMode)[number];
export const PracticeModeText: Record<PracticeMode, string> = {
  CELL_TO_TEXT: "CELL_TO_TEXT",
  TEXT_TO_CELL: "TEXT_TO_CELL",
  LISTENING: "LISTENING",
  MIXED: "MIXED"
};
