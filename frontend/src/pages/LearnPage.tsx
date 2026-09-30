import { useEffect, useMemo, useState } from "react";
import { useBrailleSymbolStore } from "../stores/BrailleSymbolStore";
import { BrailleCell } from "../components/common/BrailleCell";
import { EmptyState } from "../components/common/EmptyState";
import { StatusBadge } from "../components/common/StatusBadge";
import { SymbolCategoryText } from "../constants/SymbolCategory";
import type { SymbolCategory } from "../types/SymbolCategory";

const DIFFICULTIES = ["1", "2", "3"] as const;

export function LearnPage({ onNavigateMerge }: { onNavigateMerge?: () => void }) {
  const store = useBrailleSymbolStore();
  const [difficulty, setDifficulty] = useState<string>("全部");

  useEffect(() => {
    void store.load();
  }, [store]);

  const rows = store.rows.filter((symbol) => difficulty === "全部" || symbol.difficulty === difficulty);
  const duplicateMap = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const symbol of store.rows) {
      const key = `${symbol.cell_pattern}|${symbol.letter}`;
      map.set(key, [...(map.get(key) ?? []), symbol.id]);
    }
    return map;
  }, [store.rows]);

  return (
    <section>
      <header className="page-head">
        <div>
          <p className="eyebrow">braille-trainer / learn</p>
          <h1>学习卡片</h1>
        </div>
        <div className="filters">
          {["全部", ...DIFFICULTIES].map((value) => (
            <button key={value} className={difficulty === value ? "chip active" : "chip"} onClick={() => setDifficulty(value)}>
              难度 {value === "全部" ? "全部" : value}
            </button>
          ))}
        </div>
      </header>

      {[...duplicateMap.values()].filter((ids) => ids.length > 1).length > 0 && (
        <div className="dup-tip">
          存在同一字符的重复卡片，错题可能散落在不同编号上。
          <button className="action inline" onClick={onNavigateMerge}>去字符归并</button>
        </div>
      )}

      {rows.length === 0 && !store.loading ? <EmptyState title="暂无点字卡片" /> : (
        <div className="card-grid">
          {rows.map((symbol) => {
            const twins = duplicateMap.get(`${symbol.cell_pattern}|${symbol.letter}`) ?? [];
            return (
              <article key={symbol.id} className="symbol-card">
                <BrailleCell pattern={symbol.cell_pattern} letter={symbol.letter} size={72} />
                <div className="symbol-meta">
                  <strong>#{symbol.id} {symbol.letter}</strong>
                  <span className="hint">拼音：{symbol.pinyin}</span>
                  <span className="hint">点位：{symbol.cell_pattern}</span>
                  <StatusBadge value={SymbolCategoryText[symbol.category as SymbolCategory] ?? symbol.category} />
                </div>
                {twins.length > 1 && <span className="dup-badge">重复：{twins.join("、")}</span>}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
