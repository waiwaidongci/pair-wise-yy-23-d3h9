import type { MasteryLevel } from "../constants/MasteryLevel";
import { getAllRows } from "../idb/repository";
import { buildSymbolAliasMap, resolveSymbolId } from "./symbolResolve";
import type { AnswerRecord } from "../types/AnswerRecord";
import type { BrailleSymbol } from "../types/BrailleSymbol";

export interface MistakeBookEntry {
  /** 始终是保留卡片编号；旧编号引用归并后也聚合到这里 */
  symbolId: number;
  symbol: BrailleSymbol;
  wrongRecords: AnswerRecord[];
  mistakeReasons: { reason: string; count: number }[];
  totalCount: number;
  mastery: MasteryLevel;
}

/** 单张保留卡片的掌握程度：归并不丢历史，按归并后的全部答题记录重算 */
export function masteryFromAnswers(total: number, wrong: number): MasteryLevel {
  if (total === 0) return "NEW";
  const accuracy = (total - wrong) / total;
  if (accuracy >= 0.9 && total >= 3) return "MASTERED";
  if (accuracy >= 0.7) return "FAMILIAR";
  return "LEARNING";
}

/**
 * 错题本：答题记录先经别名表解析到保留卡片，再按卡片与错误原因归类。
 * 两张重复卡片上的错答会合并到同一条错题记录。
 */
export async function buildMistakeBook(): Promise<MistakeBookEntry[]> {
  const [symbols, answers, merges] = await Promise.all([
    getAllRows("brailleSymbol"),
    getAllRows("answerRecord"),
    getAllRows("symbolMerge")
  ]);
  const aliases = buildSymbolAliasMap(merges);
  const symbolById = new Map(symbols.map((symbol) => [symbol.id, symbol]));

  const grouped = new Map<number, AnswerRecord[]>();
  for (const record of answers) {
    const keptId = resolveSymbolId(record.symbol_id, aliases);
    const list = grouped.get(keptId) ?? [];
    list.push(record);
    grouped.set(keptId, list);
  }

  const entries: MistakeBookEntry[] = [];
  for (const [symbolId, records] of grouped) {
    const symbol = symbolById.get(symbolId);
    if (!symbol) continue; // 已归并删除的旧编号必然解析到存活卡片；解析不到说明数据异常，跳过
    const wrongRecords = records.filter((record) => !record.correct);
    if (wrongRecords.length === 0) continue;
    const reasonCount = new Map<string, number>();
    for (const record of wrongRecords) {
      const reason = record.mistake_reason || "未填写原因";
      reasonCount.set(reason, (reasonCount.get(reason) ?? 0) + 1);
    }
    entries.push({
      symbolId,
      symbol,
      wrongRecords: wrongRecords.sort((a, b) => b.id - a.id),
      mistakeReasons: [...reasonCount.entries()]
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count),
      totalCount: records.length,
      mastery: masteryFromAnswers(records.length, wrongRecords.length)
    });
  }
  return entries.sort((a, b) => b.wrongRecords.length - a.wrongRecords.length);
}
