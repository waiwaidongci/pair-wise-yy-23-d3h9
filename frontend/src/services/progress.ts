import type { MasteryLevel } from "../constants/MasteryLevel";
import { getAllRows } from "../idb/repository";
import { masteryFromAnswers } from "./mistakeBook";
import { buildSymbolAliasMap, resolveSymbolId } from "./symbolResolve";
import type { Lesson } from "../types/Lesson";
import type { PracticeSession } from "../types/PracticeSession";

export interface SymbolProgress {
  symbolId: number;
  total: number;
  wrong: number;
  accuracy: number;
  mastery: MasteryLevel;
}

export interface LessonProgressView {
  lesson: Lesson;
  totalSymbols: number;
  masteredSymbols: number;
  progress: number;
}

export interface ProgressStats {
  symbolProgress: SymbolProgress[];
  lessonProgress: LessonProgressView[];
  totalSessions: number;
  averageScore: number;
  totalMistakes: number;
  /** 按完成日期排序的会话得分趋势，错题本/进度页在归并后都以保留卡片重算 */
  scoreTrend: { date: string; score: number; sessionId: number }[];
}

/**
 * 学习进度：课程按保留卡片去重后计算完成度，
 * 答题统计沿归并别名聚合，归并后立即反映合并卡片的真实水平。
 */
export async function buildProgressStats(): Promise<ProgressStats> {
  const [lessons, sessions, answers, merges] = await Promise.all([
    getAllRows("lesson"),
    getAllRows("practiceSession"),
    getAllRows("answerRecord"),
    getAllRows("symbolMerge")
  ]);
  const aliases = buildSymbolAliasMap(merges);

  const statsById = new Map<number, { total: number; wrong: number }>();
  for (const record of answers) {
    const keptId = resolveSymbolId(record.symbol_id, aliases);
    const stat = statsById.get(keptId) ?? { total: 0, wrong: 0 };
    stat.total += 1;
    if (!record.correct) stat.wrong += 1;
    statsById.set(keptId, stat);
  }
  const symbolProgress: SymbolProgress[] = [...statsById.entries()].map(([symbolId, stat]) => ({
    symbolId,
    total: stat.total,
    wrong: stat.wrong,
    accuracy: stat.total === 0 ? 0 : (stat.total - stat.wrong) / stat.total,
    mastery: masteryFromAnswers(stat.total, stat.wrong)
  }));
  const masteryById = new Map(symbolProgress.map((item) => [item.symbolId, item.mastery]));

  const lessonProgress: LessonProgressView[] = lessons.map((lesson) => {
    // 课程中的旧编号先解析到保留卡片再去重，归并不会虚增课程字符数
    const keptIds = new Set(lesson.symbol_ids.map((id) => resolveSymbolId(id, aliases)));
    const mastered = [...keptIds].filter((id) => masteryById.get(id) === "MASTERED").length;
    return {
      lesson,
      totalSymbols: keptIds.size,
      masteredSymbols: mastered,
      progress: keptIds.size === 0 ? 0 : mastered / keptIds.size
    };
  });

  const finished = sessions.filter((session) => session.finished_at);
  const scoreTrend = finished
    .map((session: PracticeSession) => ({
      date: session.finished_at,
      score: session.score,
      sessionId: session.id
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    symbolProgress,
    lessonProgress,
    totalSessions: sessions.length,
    averageScore: finished.length === 0 ? 0 : finished.reduce((sum, session) => sum + session.score, 0) / finished.length,
    totalMistakes: answers.filter((record) => !record.correct).length,
    scoreTrend
  };
}
