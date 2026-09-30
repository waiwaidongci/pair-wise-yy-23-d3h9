import type { Lesson } from "../types/Lesson";

export const createDefaultLesson = (overrides: Partial<Lesson> = {}): Lesson => ({
  id: 1,
  title: "新建课程",
  symbol_ids: [],
  stage: "入门",
  estimated_minutes: 10,
  unlock_rule: "默认开放",
  ...overrides
});

export const createLessonForm = createDefaultLesson;
export const createLessonResponse = createDefaultLesson;
