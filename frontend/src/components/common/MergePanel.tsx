import { useEffect, useMemo, useState } from "react";
import { useBrailleMerge } from "../../hooks/useBrailleMerge";
import { useDatabaseTable } from "../../hooks/useDatabase";
import type { BrailleSymbol } from "../../types/BrailleSymbol";
import type { BrailleSymbolMerge } from "../../types/BrailleSymbolMerge";
import { MergeStatusText } from "../../constants/MergeStatus";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./EmptyState";
import { isMergeError } from "../../errors/MergeError";

/**
 * 字符归并面板。
 *
 * 流程：选保留卡片与待并入卡片 → 预览受影响的课程/练习会话/答题记录
 * → 统一迁到保留卡片 → 旧编号保留来源，误合可按快照拆回。
 */
export function MergePanel() {
  const symbols = useDatabaseTable<BrailleSymbol>("brailleSymbol");
  const {
    merges,
    preview,
    loading,
    error,
    lastResult,
    loadMerges,
    previewMerge,
    executeMerge,
    rollbackMerge,
    clearError,
    clearPreview,
    generateRequestId
  } = useBrailleMerge();

  const [sourceId, setSourceId] = useState<number>(0);
  const [targetId, setTargetId] = useState<number>(0);
  const [requestId, setRequestId] = useState<string>("");

  useEffect(() => {
    loadMerges();
  }, [loadMerges]);

  useEffect(() => {
    if (!requestId) {
      setRequestId(generateRequestId());
    }
  }, [requestId, generateRequestId]);

  const symbolOptions = useMemo(
    () => symbols.map((symbol: BrailleSymbol) => ({ value: symbol.id, label: `${symbol.letter} (${symbol.cell_pattern})` })),
    [symbols]
  );

  const handlePreview = () => {
    if (sourceId && targetId) {
      clearError();
      previewMerge(sourceId, targetId);
    }
  };

  const handleExecute = async () => {
    if (!sourceId || !targetId) return;
    clearError();
    try {
      await executeMerge({ request_id: requestId, source_symbol_id: sourceId, target_symbol_id: targetId });
      // 归并成功后生成新的请求编号，便于下一次操作
      setRequestId(generateRequestId());
      clearPreview();
    } catch (err) {
      // 冲突失败后保留原请求编号，用户可凭此编号重试（幂等恢复）
      if (isMergeError(err) && err.code === "MERGE_CONFLICT") {
        // 保留 requestId 不变，提示用户重试
      }
    }
  };

  const handleRollback = async (mergeRequestId: string) => {
    clearError();
    await rollbackMerge(mergeRequestId);
  };

  const handleSwap = () => {
    setSourceId(targetId);
    setTargetId(sourceId);
    clearPreview();
  };

  return (
    <div className="merge-panel">
      <section className="panel">
        <h2>字符归并</h2>
        <p className="hint">
          同一个点字字符建成两条卡片时，选择保留卡片与待并入卡片。
          先预览受影响的课程、练习会话和答题记录，再统一迁到保留卡片。
        </p>

        <div className="merge-form">
          <label>
            待并入卡片
            <select value={sourceId} onChange={(e) => setSourceId(Number(e.target.value))}>
              <option value={0}>请选择</option>
              {symbolOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="swap-btn" onClick={handleSwap} title="交换">
            ⇄
          </button>
          <label>
            保留卡片
            <select value={targetId} onChange={(e) => setTargetId(Number(e.target.value))}>
              <option value={0}>请选择</option>
              {symbolOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="merge-actions">
          <button type="button" disabled={!sourceId || !targetId || loading} onClick={handlePreview}>
            预览影响
          </button>
          <button
            type="button"
            className="primary"
            disabled={!sourceId || !targetId || loading}
            onClick={handleExecute}
          >
            确认归并
          </button>
          <span className="request-id" title="原请求编号（幂等键）">
            请求编号：{requestId || "生成中…"}
          </span>
        </div>

        {error && (
          <div className="merge-error" role="alert">
            <strong>操作失败：</strong>
            {error}
            <button type="button" className="retry-btn" onClick={handleExecute} disabled={loading}>
              凭原请求编号重试
            </button>
          </div>
        )}

        {lastResult && !error && (
          <div className="merge-success">
            归并完成：迁移课程 {lastResult.migrated_lesson_count} 门、答题记录{" "}
            {lastResult.migrated_answer_record_count} 条
            {lastResult.idempotent_replay && "（幂等重放）"}
          </div>
        )}
      </section>

      {preview && (
        <section className="panel">
          <h2>归并预览</h2>
          {preview.conflict_warning && <div className="merge-warning">{preview.conflict_warning}</div>}
          <div className="preview-grid">
            <div>
              <h3>受影响课程（{preview.affected_lessons.length}）</h3>
              {preview.affected_lessons.length === 0 ? (
                <EmptyState title="无" />
              ) : (
                <ul>
                  {preview.affected_lessons.map((lesson: { id: number; title: string; symbol_ids: number[] }) => (
                    <li key={lesson.id}>
                      #{lesson.id} {lesson.title}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>受影响练习会话（{preview.impacted_sessions.length}）</h3>
              {preview.impacted_sessions.length === 0 ? (
                <EmptyState title="无" />
              ) : (
                <ul>
                  {preview.impacted_sessions.map((session: { id: number; lesson_id: number; mode: string; started_at: string }) => (
                    <li key={session.id}>
                      #{session.id} {session.mode} · {session.started_at.slice(0, 10)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3>受影响答题记录（{preview.affected_answer_records.length}）</h3>
              {preview.affected_answer_records.length === 0 ? (
                <EmptyState title="无" />
              ) : (
                <ul>
                  {preview.affected_answer_records.map((record: { id: number; session_id: number; symbol_id: number; correct: string }) => (
                    <li key={record.id}>
                      #{record.id} 会话 {record.session_id} · {record.correct}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <h2>归并历史</h2>
        {merges.length === 0 ? (
          <EmptyState title="暂无归并记录" />
        ) : (
          <table className="merge-history">
            <thead>
              <tr>
                <th>请求编号</th>
                <th>待并入</th>
                <th>保留</th>
                <th>状态</th>
                <th>时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {merges.map((merge: BrailleSymbolMerge) => (
                <tr key={merge.id}>
                  <td className="mono">{merge.request_id.slice(0, 8)}</td>
                  <td>#{merge.source_symbol_id}</td>
                  <td>#{merge.target_symbol_id}</td>
                  <td>
                    <StatusBadge value={MergeStatusText[merge.status] ?? merge.status} />
                  </td>
                  <td>{(merge.committed_at ?? merge.created_at).slice(0, 19).replace("T", " ")}</td>
                  <td>
                    {merge.status === "COMMITTED" && (
                      <button type="button" onClick={() => handleRollback(merge.request_id)} disabled={loading}>
                        按快照拆回
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
