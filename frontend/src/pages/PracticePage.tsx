import { useEffect, useMemo, useState } from "react";
import { useBrailleSymbolStore } from "../stores/BrailleSymbolStore";
import { useAnswerRecordStore } from "../stores/AnswerRecordStore";
import { usePracticeSessionStore } from "../stores/PracticeSessionStore";
import { BrailleCell } from "../components/common/BrailleCell";
import { EmptyState } from "../components/common/EmptyState";
import { ResultBadge } from "../components/common/ResultBadge";
import { PracticeModeText } from "../constants/PracticeMode";
import { formatDate } from "../utils/formatters";
import type { PracticeMode } from "../types/PracticeMode";
import { loadSymbolAliasMap, resolveSymbolId } from "../services/symbolResolve";

/** 练习模式：最近的答题明细（旧编号已解析到保留卡片），并按会话分组 */
export function PracticePage() {
  const symbolStore = useBrailleSymbolStore();
  const answerStore = useAnswerRecordStore();
  const sessionStore = usePracticeSessionStore();
  const [resolvedMap, setResolvedMap] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    void Promise.all([symbolStore.load(), answerStore.load(), sessionStore.load()]).then(async () => {
      const aliases = await loadSymbolAliasMap();
      setResolvedMap(aliases.aliasToKept);
    });
  }, [symbolStore, answerStore, sessionStore]);

  const symbolsById = useMemo(() => new Map(symbolStore.rows.map((symbol) => [symbol.id, symbol])), [symbolStore.rows]);
  const sessionsById = useMemo(() => new Map(sessionStore.rows.map((session) => [session.id, session])), [sessionStore.rows]);
  const records = answerStore.rows.slice().sort((a, b) => b.id - a.id);

  return (
    <section>
      <header className="page-head">
        <div>
          <p className="eyebrow">braille-trainer / practice</p>
          <h1>练习模式</h1>
        </div>
      </header>
      {records.length === 0 && !answerStore.loading ? <EmptyState title="暂无练习记录" /> : (
        <div className="panel wide">
          <h2>最近答题明细（编号已解析到保留卡片）</h2>
          <div className="table">
            {records.map((record) => {
              const keptId = resolvedMap.get(record.symbol_id) ?? record.symbol_id;
              const symbol = symbolsById.get(keptId);
              const session = sessionsById.get(record.session_id);
              return (
                <article key={record.id} className="row practice-row">
                  {symbol ? <BrailleCell pattern={symbol.cell_pattern} letter={symbol.letter} size={36} /> : <span>#{keptId}</span>}
                  <div>
                    <strong>卡片 #{keptId}</strong>
                    {keptId !== record.symbol_id && <span className="hint">（原记录编号 #{record.symbol_id}，归并保留来源）</span>}
                    <span className="hint">会话 #{record.session_id}{session ? ` · ${PracticeModeText[session.mode as PracticeMode] ?? session.mode} · ${formatDate(session.finished_at)}` : ""}</span>
                  </div>
                  <span className="hint">你的回答：{record.user_answer} · {record.latency_ms}ms</span>
                  <ResultBadge value={record.correct ? "ANSWER_CORRECT" : "ANSWER_WRONG"} />
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
