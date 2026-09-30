export const PracticeMode = ["CELL_TO_TEXT", "TEXT_TO_CELL", "LISTENING", "MIXED"] as const;
export type PracticeMode = (typeof PracticeMode)[number];
export const PracticeModeText: Record<PracticeMode, string> = {
  CELL_TO_TEXT: "看点位写字母",
  TEXT_TO_CELL: "看字母摆点位",
  LISTENING: "听写",
  MIXED: "混合练习"
};
