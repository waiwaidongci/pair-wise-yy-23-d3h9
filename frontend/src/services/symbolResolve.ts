import { MERGE_CHAIN_LIMIT } from "../idb/config";
import { getAllRows } from "../idb/repository";
import { ServiceError } from "../utils/errors";
import type { BrailleSymbol } from "../types/BrailleSymbol";
import type { SymbolMerge } from "../types/SymbolMerge";

export interface SymbolAliasMap {
  /** 旧编号 -> 当前保留卡片编号（多级并入时沿链回溯） */
  aliasToKept: Map<number, number>;
  /** 每条归并来源，用于展示“7 → 1”的旧编号来源 */
  chains: { kept: number; merged: number }[];
  activeMergeByMerged: Map<number, SymbolMerge>;
}

/**
 * 从归并台账构造旧编号别名表。
 * 只采用 MERGED 记录：REVERTED 表示旧卡片已按快照恢复、编号重新指向自己。
 */
export function buildSymbolAliasMap(merges: SymbolMerge[]): SymbolAliasMap {
  const direct = new Map<number, number>();
  const activeMergeByMerged = new Map<number, SymbolMerge>();
  for (const merge of merges) {
    if (merge.status === "MERGED") {
      direct.set(merge.merged_symbol_id, merge.kept_symbol_id);
      activeMergeByMerged.set(merge.merged_symbol_id, merge);
    }
  }
  // 解析多级链：A -> B -> C 时，A 与 B 都解析到 C
  const resolveOne = (start: number): number => {
    let current = start;
    let hops = 0;
    const seen = new Set<number>([start]);
    while (direct.has(current)) {
      const next = direct.get(current)!;
      if (seen.has(next) || hops >= MERGE_CHAIN_LIMIT) {
        throw new ServiceError("MERGE_ALIAS_AMBIGUOUS", { oldId: start });
      }
      seen.add(next);
      current = next;
      hops += 1;
    }
    return current;
  };
  const aliasToKept = new Map<number, number>();
  for (const oldId of direct.keys()) aliasToKept.set(oldId, resolveOne(oldId));
  return {
    aliasToKept,
    chains: [...direct.entries()].map(([merged, kept]) => ({ merged, kept })),
    activeMergeByMerged
  };
}

/** 同步解析：编号命中别名表则回溯到保留卡片，否则原样返回（兼容原编号） */
export function resolveSymbolId(symbolId: number, aliases: SymbolAliasMap): number {
  return aliases.aliasToKept.get(symbolId) ?? symbolId;
}

/** 读库版解析：错题本、学习进度等页面统一走这里，保证按保留卡片聚合 */
export async function loadSymbolAliasMap(): Promise<SymbolAliasMap> {
  const merges = await getAllRows("symbolMerge");
  return buildSymbolAliasMap(merges);
}

/** 找到当前仍存活的保留卡片；旧编号会被解析到其保留卡片 */
export function findLiveSymbol(symbols: BrailleSymbol[], symbolId: number, aliases: SymbolAliasMap): BrailleSymbol | undefined {
  const resolved = resolveSymbolId(symbolId, aliases);
  return symbols.find((symbol) => symbol.id === resolved);
}
