import type { PracticeSession } from "../types/PracticeSession";

export const createDefaultPracticeSession = (overrides: Partial<PracticeSession> = {}): PracticeSession => ({
  id: 1,
  lesson_id: 1,
  mode: "MIXED",
  started_at: "2026-09-20T09:00:00Z",
  finished_at: "2026-09-20T09:08:00Z",
  score: 0,
  mistake_count: 0,
  ...overrides
});

export const createPracticeSessionForm = createDefaultPracticeSession;
export const createPracticeSessionResponse = createDefaultPracticeSession;
