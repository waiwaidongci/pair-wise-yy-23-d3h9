import { parseMergeOutcome } from "../../constructors/SymbolMergeConstructor";
import { formatDate, formatMergeStatus } from "../../utils/formatters";
import { StatusBadge } from "./StatusBadge";
import type { MergeStatusValue } from "../../types/MergeStatus";
import type { SymbolMerge } from "../../types/SymbolMerge";

interface MergeLedgerProps {
  merges: SymbolMerge[];
  submitting: boolean;
  deviceId: string;
  onRecover: (requestId: string) => void;
  onRevert: (requestId: string) => void;
}

/** 归并台账：旧编号保留来源、误合按快照拆回、失败凭原请求编号恢复 */
export function MergeLedger({ merges, submitting, onRecover, onRevert }: MergeLedgerProps) {
  if (merges.length === 0) {
    return <div className="panel"><h2>归并记录</h2><p className="hint">暂无归并记录。</p></div>;
  }
  return (
    <div className="panel">
      <h2>归并记录（旧编号来源 / 快照拆回）</h2>
      <div className="ledger">
        {merges.map((merge) => {
          const outcome = parseMergeOutcome(merge.outcome);
          const status = merge.status as MergeStatusValue;
          return (
            <article key={merge.id} className="ledger-row">
              <div className="ledger-head">
                <strong>
                  旧编号 #{merge.merged_symbol_id} → 保留卡片 #{merge.kept_symbol_id}
                </strong>
                <StatusBadge value={status} />
              </div>
              <p className="hint">{merge.reason}</p>
              <p className="hint">
                原请求编号：<code>{merge.request_id}</code> · 发起设备：{merge.initiated_by}
                <br />
                创建：{formatDate(merge.created_at)} · 完成：{formatDate(merge.finished_at)}
              </p>
              {status === "MERGED" && (
                <p className="hint">
                  迁移课程 {outcome.migratedLessonIds?.length ?? 0} 门、会话 {outcome.migratedSessionIds?.length ?? 0} 场、
                  答题记录 {outcome.migratedAnswerRecordIds?.length ?? 0} 条
                </p>
              )}
              <div className="ledger-actions">
                {status === "FAILED" && (
                  <button className="action primary" disabled={submitting} onClick={() => onRecover(merge.request_id)}>
                    凭原请求编号恢复
                  </button>
                )}
                {status === "MERGED" && (
                  <button className="action warn" disabled={submitting} onClick={() => onRevert(merge.request_id)}>
                    误合了？按快照拆回
                  </button>
                )}
                {status === "REVERTED" && <span className="hint">已按快照恢复原引用，原编号重新生效。</span>}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
