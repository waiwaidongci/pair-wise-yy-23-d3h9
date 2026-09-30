import type { AnswerRecord } from "../types/AnswerRecord";
import type { BrailleSymbol } from "../types/BrailleSymbol";
import type { Lesson } from "../types/Lesson";
import type { PracticeSession } from "../types/PracticeSession";

/**
 * 本地模拟数据（首次打开 IndexedDB 时灌入）。
 * 注意 1 与 7、3 与 8 是同一个点字被建成的两张卡片，
 * 课程和错题记录各自引用 —— 这正是“字符归并”要处理的场景。
 *
 * cell_pattern 用六点编号表示凸点，如 "1" = ⠁（a），"1-4-5" = ⠙（d）。
 */
export const seedBrailleSymbols: BrailleSymbol[] = [
  { id: 1, cell_pattern: "1", letter: "a", pinyin: "a", category: "LETTER", difficulty: "1", audio_hint_key: "letter:a" },
  { id: 2, cell_pattern: "1-2", letter: "b", pinyin: "bo", category: "LETTER", difficulty: "1", audio_hint_key: "letter:b" },
  { id: 3, cell_pattern: "1-4", letter: "c", pinyin: "ci", category: "LETTER", difficulty: "2", audio_hint_key: "letter:c" },
  { id: 4, cell_pattern: "1-4-5", letter: "d", pinyin: "de", category: "LETTER", difficulty: "2", audio_hint_key: "letter:d" },
  { id: 5, cell_pattern: "1-5", letter: "e", pinyin: "e", category: "LETTER", difficulty: "1", audio_hint_key: "letter:e" },
  { id: 6, cell_pattern: "1-2-4", letter: "f", pinyin: "fo", category: "LETTER", difficulty: "3", audio_hint_key: "letter:f" },
  // 与 id=1 同为 ⠁（a）的重复卡片，课程引用 1，错题记录却记在 7 上
  { id: 7, cell_pattern: "1", letter: "a", pinyin: "a", category: "LETTER", difficulty: "1", audio_hint_key: "letter:a" },
  // 与 id=3 同为 ⠉（c）的重复卡片，练习会话引用 8
  { id: 8, cell_pattern: "1-4", letter: "c", pinyin: "ci", category: "LETTER", difficulty: "2", audio_hint_key: "letter:c" }
];

export const seedLessons: Lesson[] = [
  { id: 1, title: "第一课：基础元音", symbol_ids: [1, 5], stage: "入门", estimated_minutes: 10, unlock_rule: "默认开放" },
  { id: 2, title: "第二课：辅音入门", symbol_ids: [2, 3, 4], stage: "入门", estimated_minutes: 15, unlock_rule: "完成第一课" },
  { id: 3, title: "易混点字对比", symbol_ids: [3, 6], stage: "进阶", estimated_minutes: 20, unlock_rule: "完成第二课" },
  // 错题本配套课程误用了重复卡片 7、8
  { id: 4, title: "综合复习", symbol_ids: [7, 8, 2], stage: "复习", estimated_minutes: 25, unlock_rule: "完成前三课" }
];

export const seedPracticeSessions: PracticeSession[] = [
  { id: 1, lesson_id: 1, mode: "CELL_TO_TEXT", started_at: "2026-09-20T09:00:00Z", finished_at: "2026-09-20T09:08:00Z", score: 90, mistake_count: 1 },
  { id: 2, lesson_id: 2, mode: "LISTENING", started_at: "2026-09-22T10:00:00Z", finished_at: "2026-09-22T10:12:00Z", score: 65, mistake_count: 3 },
  { id: 3, lesson_id: 4, mode: "MIXED", started_at: "2026-09-26T14:00:00Z", finished_at: "2026-09-26T14:20:00Z", score: 72, mistake_count: 2 }
];

export const seedAnswerRecords: AnswerRecord[] = [
  { id: 1, session_id: 1, symbol_id: 1, user_answer: "a", correct: true, latency_ms: 1200, mistake_reason: "" },
  { id: 2, session_id: 1, symbol_id: 5, user_answer: "i", correct: false, latency_ms: 3100, mistake_reason: "点位混淆" },
  { id: 3, session_id: 2, symbol_id: 2, user_answer: "b", correct: true, latency_ms: 1500, mistake_reason: "" },
  { id: 4, session_id: 2, symbol_id: 3, user_answer: "k", correct: false, latency_ms: 4200, mistake_reason: "缺读第 5 点" },
  { id: 5, session_id: 2, symbol_id: 4, user_answer: "d", correct: true, latency_ms: 2000, mistake_reason: "" },
  // 错答挂在重复卡片 7（⠁）和 8（⠉）上，归并后错题本需按保留卡片重算
  { id: 6, session_id: 3, symbol_id: 7, user_answer: "e", correct: false, latency_ms: 3600, mistake_reason: "点位混淆" },
  { id: 7, session_id: 3, symbol_id: 8, user_answer: "z", correct: false, latency_ms: 5100, mistake_reason: "听写相似音" },
  { id: 8, session_id: 3, symbol_id: 2, user_answer: "b", correct: true, latency_ms: 1800, mistake_reason: "" }
];
