import { database } from "../db/database";
import type { AnswerRecord } from "../types/AnswerRecord";
import type { BrailleSymbol } from "../types/BrailleSymbol";
import type { Lesson } from "../types/Lesson";
import type { PracticeSession } from "../types/PracticeSession";

/**
 * 错题本条目（按保留卡片聚合）。
 */
export interface MistakeBookEntry {
  symbol_id: number;
  symbol_letter: string;
  cell_pattern: string;
  mistake_count: number;
  total_answers: number;
  mistake_rate: number;
}

/**
 * 学习进度条目（按保留卡片重算）。
 */
export interface ProgressEntry {
  lesson_id: number;
  lesson_title: string;
  symbol_count: number;
  mastered_count: number;
  mastery_rate: number;
  session_count: number;
  average_score: number;
}

function isIncorrect(record: AnswerRecord): boolean {
  const value = String(record.correct).toLowerCase();
  return value === "false" || value === "0" || value === "incorrect" || value === "错";
}

/**
 * 错题本：按点字卡片聚合答错记录。
 * 归并后答题记录已迁到保留卡片，因此这里天然按保留卡片统计。
 */
export function computeMistakeBook(): MistakeBookEntry[] {
  const records = database.getAll<AnswerRecord>("answerRecord");
  const symbols = database.getAll<BrailleSymbol>("brailleSymbol");
  const bySymbol = new Map<number, { mistakes: number; total: number }>();
  for (const record of records) {
    const entry = bySymbol.get(record.symbol_id) ?? { mistakes: 0, total: 0 };
    entry.total += 1;
    if (isIncorrect(record)) entry.mistakes += 1;
    bySymbol.set(record.symbol_id, entry);
  }
  return [...bySymbol.entries()]
    .map(([symbol_id, value]) => {
      const symbol = symbols.find((s) => s.id === symbol_id);
      return {
        symbol_id,
        symbol_letter: symbol?.letter ?? `#${symbol_id}`,
        cell_pattern: symbol?.cell_pattern ?? "",
        mistake_count: value.mistakes,
        total_answers: value.total,
        mistake_rate: value.total ? value.mistakes / value.total : 0
      };
    })
    .sort((a, b) => b.mistake_count - a.mistake_count);
}

/**
 * 学习进度：按课程统计掌握度与练习次数。
 * 归并后课程 symbol_ids 已迁到保留卡片，按保留卡片重算。
 */
export function computeProgress(): ProgressEntry[] {
  const lessons = database.getAll<Lesson>("lesson");
  const records = database.getAll<AnswerRecord>("answerRecord");
  const sessions = database.getAll<PracticeSession>("practiceSession");
  return lessons.map((lesson) => {
    const lessonRecords = records.filter((r) => lesson.symbol_ids.includes(r.symbol_id));
    const symbolIds = new Set(lesson.symbol_ids);
    let mastered = 0;
    for (const sid of symbolIds) {
      const symbolRecords = lessonRecords.filter((r) => r.symbol_id === sid);
      if (symbolRecords.length === 0) continue;
      const correct = symbolRecords.filter((r) => !isIncorrect(r)).length;
      if (correct / symbolRecords.length >= 0.8) mastered += 1;
    }
    const lessonSessions = sessions.filter((s) => s.lesson_id === lesson.id);
    const scores = lessonSessions
      .map((s) => Number(s.score))
      .filter((n) => Number.isFinite(n));
    const averageScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return {
      lesson_id: lesson.id,
      lesson_title: lesson.title,
      symbol_count: symbolIds.size,
      mastered_count: mastered,
      mastery_rate: symbolIds.size ? mastered / symbolIds.size : 0,
      session_count: lessonSessions.length,
      average_score: averageScore
    };
  });
}

const STATS_CACHE_KEY = "braille-trainer:stats";

/**
 * 归并后重算错题本与学习进度。
 * 从迁移后的答题记录与课程数据重建派生聚合，并写缓存供消费方读取。
 */
export function recalculateDerivedStats(): {
  mistakeBook: MistakeBookEntry[];
  progress: ProgressEntry[];
  computed_at: string;
} {
  const mistakeBook = computeMistakeBook();
  const progress = computeProgress();
  const computed_at = new Date().toISOString();
  const result = { mistakeBook, progress, computed_at };
  try {
    localStorage.setItem(STATS_CACHE_KEY, JSON.stringify(result));
  } catch {
    // 忽略持久化失败
  }
  return result;
}

export function readCachedStats(): ReturnType<typeof recalculateDerivedStats> | null {
  try {
    const raw = localStorage.getItem(STATS_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ReturnType<typeof recalculateDerivedStats>) : null;
  } catch {
    return null;
  }
}
