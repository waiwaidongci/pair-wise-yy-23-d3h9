import { useMemo } from "react";
import { BrailleCell } from "./BrailleCell";
import { formatMergeChain } from "../../utils/formatters";
import type { BrailleSymbol as BrailleSymbolType } from "../../types/BrailleSymbol";
import type { MergePreview, MergeReferenceSummary } from "../../types/SymbolMerge";

interface MergePanelProps {
  symbols: BrailleSymbolType[];
  preview: MergePreview | null;
  loading: boolean;
  keptSymbolId: number;
  mergedSymbolId: number;
  draftRequestId: string | null;
  submitting: boolean;
  message: string | null;
  deviceId: string;
  aliasChains: { kept: number; merged: number }[];
  onSelectKept: (id: number) => void;
  onSelectMerged: (id: number) => void;
  onPreview: () => void;
  onSubmit: () => void;
  onRecoverDraft: () => void;
}

/** 字符归并操作面板：选保留卡片/待并入卡片 → 列出引用 → 统一迁移 */
export function MergePanel(props: MergePanelProps) {
  const {
    symbols, preview, loading, keptSymbolId, mergedSymbolId, draftRequestId, submitting, message,
    deviceId, aliasChains, onSelectKept, onSelectMerged, onPreview, onSubmit, onRecoverDraft
  } = props;

  const duplicateGroups = useMemo(() => buildDuplicateGroups(symbols), [symbols]);
  const sameCard = keptSymbolId === mergedSymbolId;

  return (
    <div className="panel wide">
      <h2>字符归并</h2>
      <p className="hint">同一盲文字符被建成两张卡片时，先选保留卡片与待并入卡片，系统会先列出课程、练习会话和答题记录，确认后统一迁移；旧编号保留为来源，误合可按快照拆回。</p>

      {duplicateGroups.length > 0 && (
        <div className="dup-tip">
          检测到可能重复的点字（相同凸点/字母）：
          {duplicateGroups.map((group) => (
            <span key={group.cell_pattern} className="dup-badge">
              {group.cell_pattern} · {group.letter}（卡片 {group.ids.join("、")}）
            </span>
          ))}
        </div>
      )}
      {aliasChains.length > 0 && (
        <p className="hint">已生效的旧编号来源：{formatMergeChain(aliasChains)}（原编号仍可解析到保留卡片）</p>
      )}

      <div className="merge-form">
        <label>
          保留卡片
          <select value={keptSymbolId} onChange={(event) => onSelectKept(Number(event.target.value))}>
            {symbols.map((symbol) => (
              <option key={symbol.id} value={symbol.id}>#{symbol.id} {symbol.letter}（{symbol.cell_pattern}）</option>
            ))}
          </select>
        </label>
        <label>
          待并入卡片
          <select value={mergedSymbolId} onChange={(event) => onSelectMerged(Number(event.target.value))}>
            <option value={0}>请选择…</option>
            {symbols.map((symbol) => (
              <option key={symbol.id} value={symbol.id} disabled={symbol.id === keptSymbolId}>
                #{symbol.id} {symbol.letter}（{symbol.cell_pattern}）
              </option>
            ))}
          </select>
        </label>
        <button className="action" disabled={loading || sameCard || !mergedSymbolId} onClick={onPreview}>
          {loading ? "正在列出引用…" : "1. 列出课程/会话/答题记录"}
        </button>
      </div>

      {sameCard && <p className="error-text">保留卡片和待并入卡片不能是同一张。</p>}

      {preview && (
        <div className="preview-grid">
          <ReferenceColumn title="保留卡片（保留）" summary={preview.kept} tone="kept" />
          <ReferenceColumn title="待并入卡片（将删除）" summary={preview.merged} tone="merged" />
        </div>
      )}

      {preview && (
        <div className="merge-actions">
          <button className="action primary" disabled={submitting || sameCard} onClick={onSubmit}>
            {submitting ? "归并进行中…" : "2. 确认归并并统一迁移引用"}
          </button>
          {draftRequestId && (
            <button className="action warn" disabled={submitting} onClick={onRecoverDraft}>
              失败后凭原请求编号恢复（{draftRequestId}）
            </button>
          )}
        </div>
      )}

      {message && <p className={message.includes("失败") || message.includes("只有一笔") ? "error-text" : "success-text"}>{message}</p>}
      <p className="hint">本机设备编号：{deviceId}（两台设备并发归并时只有抢到锁的一笔生效）</p>
    </div>
  );
}

function ReferenceColumn({ title, summary, tone }: { title: string; summary: MergeReferenceSummary; tone: "kept" | "merged" }) {
  return (
    <div className={`reference-col ${tone}`}>
      <h3>{title}</h3>
      {summary.symbol ? (
        <div className="reference-symbol">
          <BrailleCell pattern={summary.symbol.cell_pattern} letter={summary.symbol.letter} size={48} />
          <div>
            <strong>#{summary.symbol.id} {summary.symbol.letter}</strong>
            <span className="hint">{summary.symbol.pinyin} · 点位 {summary.symbol.cell_pattern}</span>
          </div>
        </div>
      ) : <p className="error-text">该卡片已不存在（可能已被归并）。</p>}
      <ul className="reference-list">
        <li>课程引用：{summary.lessons.length} 条{summary.lessons.length > 0 ? `（${summary.lessons.map((item) => `#${item.id} ${item.title}`).join("、")}）` : ""}</li>
        <li>练习会话：{summary.sessions.length} 场{summary.sessions.length > 0 ? `（${summary.sessions.map((item) => `#${item.id}`).join("、")}）` : ""}</li>
        <li>答题记录：{summary.answerRecords.length} 条{summary.answerRecords.length > 0 ? `（${summary.answerRecords.map((item) => `#${item.id}`).join("、")}）` : ""}</li>
      </ul>
    </div>
  );
}

function buildDuplicateGroups(symbols: BrailleSymbolType[]): { cell_pattern: string; letter: string; ids: number[] }[] {
  const groups = new Map<string, BrailleSymbolType[]>();
  for (const symbol of symbols) {
    const key = `${symbol.cell_pattern}|${symbol.letter}`;
    const list = groups.get(key) ?? [];
    list.push(symbol);
    groups.set(key, list);
  }
  return [...groups.values()]
    .filter((list) => list.length > 1)
    .map((list) => ({ cell_pattern: list[0].cell_pattern, letter: list[0].letter, ids: list.map((item) => item.id) }));
}
