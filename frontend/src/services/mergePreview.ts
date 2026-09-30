import { getAllByIndex, getAllRows } from "../idb/repository";
import { writeLog } from "../utils/logger";
import type { AnswerRecord } from "../types/AnswerRecord";
import type { BrailleSymbol } from "../types/BrailleSymbol";
import type { Lesson } from "../types/Lesson";
import type { MergePreview, MergeReferenceSummary, SymbolMergeSnapshot } from "../types/SymbolMerge";
import type { PracticeSession } from "../types/PracticeSession";

/**
 * 归并预览：先列出某张卡片在课程、练习会话、答题记录三处的引用。
 * 练习会话本身不直接存 symbol_id，需经其名下答题记录关联。
 */
export async function buildReferenceSummary(symbolId: number): Promise<MergeReferenceSummary> {
  const [symbols, lessons, sessions, answers] = await Promise.all([
    getAllRows("brailleSymbol"),
    getAllRows("lesson"),
    getAllRows("practiceSession"),
    getAllByIndex("answerRecord", "by_symbol", symbolId) as Promise<AnswerRecord[]>
  ]);
  const symbol = symbols.find((item) => item.id === symbolId);
  const referencedLessons = lessons.filter((lesson) => lesson.symbol_ids.includes(symbolId));
  const sessionIds = new Set(answers.map((record) => record.session_id));
  const referencedSessions = sessions.filter((session) => sessionIds.has(session.id));
  return {
    symbol: symbol as BrailleSymbol,
    lessons: referencedLessons,
    sessions: referencedSessions,
    answerRecords: answers,
    total: referencedLessons.length + referencedSessions.length + answers.length
  };
}

export async function previewSymbolMerge(keptSymbolId: number, mergedSymbolId: number): Promise<MergePreview> {
  const [kept, merged] = await Promise.all([
    buildReferenceSummary(keptSymbolId),
    buildReferenceSummary(mergedSymbolId)
  ]);
  writeLog("SymbolMerge", "字符归并预览", { keptSymbolId, mergedSymbolId, references: kept.total + merged.total });
  return { kept, merged };
}

/** 提交前冻结快照：误合后能把课程/会话/答题记录逐行拆回原状 */
export function createSnapshotFromPreview(
  preview: MergePreview
): Pick<SymbolMergeSnapshot, "lessons" | "sessions" | "answerRecords"> {
  const uniqueLessons = dedupeById(preview.merged.lessons);
  const uniqueSessions = dedupeById(preview.merged.sessions);
  const uniqueAnswers = dedupeById(preview.merged.answerRecords);
  return {
    lessons: structuredClone(uniqueLessons),
    sessions: structuredClone(uniqueSessions),
    answerRecords: structuredClone(uniqueAnswers)
  };
}

function dedupeById<T extends { id: number }>(rows: T[]): T[] {
  const map = new Map<number, T>();
  for (const row of rows) map.set(row.id, row);
  return [...map.values()];
}

/** 供测试与恢复逻辑复用的无副作用快照构造 */
export async function buildSnapshot(kept: BrailleSymbol, merged: BrailleSymbol): Promise<SymbolMergeSnapshot> {
  const preview = await previewSymbolMerge(kept.id, merged.id);
  return { kept: structuredClone(kept), merged: structuredClone(merged), ...createSnapshotFromPreview(preview) };
}

export type { Lesson, PracticeSession };
