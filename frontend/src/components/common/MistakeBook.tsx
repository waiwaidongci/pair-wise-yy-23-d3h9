import { useEffect, useState } from "react";
import { getMistakeBookApi } from "../../api/SymbolMerge";
import { BrailleCell } from "./BrailleCell";
import { ResultBadge } from "./ResultBadge";
import { EmptyState } from "./EmptyState";
import { formatMastery } from "../../utils/formatters";
import type { MistakeBookEntry } from "../../services/mistakeBook";

interface MistakeBookProps {
  /** 归并/拆回完成后由页面递增此值触发重算 */
  revision: number;
}

/** 错题本：按保留卡片重算，两张重复卡片上的错答合并展示 */
export function MistakeBook({ revision }: MistakeBookProps) {
  const [entries, setEntries] = useState<MistakeBookEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMistakeBookApi()
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  if (!loading && entries.length === 0) return <EmptyState title="错题本为空，继续保持！" />;

  return (
    <div className="panel wide">
      <h2>错题归类（已按保留卡片归并）</h2>
      <div className="mistake-list">
        {entries.map((entry) => (
          <article key={entry.symbolId} className="mistake-card">
            <div className="mistake-head">
              <BrailleCell pattern={entry.symbol.cell_pattern} letter={entry.symbol.letter} size={44} />
              <div>
                <strong>保留卡片 #{entry.symbolId} {entry.symbol.letter}</strong>
                <p className="hint">
                  错 {entry.wrongRecords.length} 次 / 共练 {entry.totalCount} 次 · 掌握度：{formatMastery(entry.mastery)}
                </p>
              </div>
            </div>
            <div className="reason-tags">
              {entry.mistakeReasons.map((reason) => (
                <span key={reason.reason} className="dup-badge">{reason.reason} × {reason.count}</span>
              ))}
            </div>
            <ul className="reference-list">
              {entry.wrongRecords.slice(0, 3).map((record) => (
                <li key={record.id}>
                  答题 #{record.id}（会话 #{record.session_id}）回答“{record.user_answer}”
                  <ResultBadge value="ANSWER_WRONG" />
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
