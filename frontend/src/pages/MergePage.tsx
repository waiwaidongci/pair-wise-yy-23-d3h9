import { useEffect, useMemo, useState } from "react";
import { useBrailleSymbolStore } from "../stores/BrailleSymbolStore";
import { useSymbolMerge } from "../hooks/useSymbolMerge";
import { MergeLedger } from "../components/common/MergeLedger";
import { MergePanel } from "../components/common/MergePanel";
import { loadSymbolAliasMap } from "../services/symbolResolve";

export function MergePage() {
  const symbolStore = useBrailleSymbolStore();
  const merge = useSymbolMerge();
  const [keptSymbolId, setKeptSymbolId] = useState(1);
  const [mergedSymbolId, setMergedSymbolId] = useState(0);
  const [aliasChains, setAliasChains] = useState<{ kept: number; merged: number }[]>([]);

  useEffect(() => {
    void symbolStore.load();
    void merge.loadMerges();
    void refreshChains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshChains() {
    const aliases = await loadSymbolAliasMap();
    setAliasChains(aliases.chains);
  }

  const symbols = symbolStore.rows;
  const duplicatePick = useMemo(() => symbols.find((symbol) => symbol.id !== 1 && symbol.cell_pattern === symbols.find((s) => s.id === 1)?.cell_pattern), [symbols]);

  useEffect(() => {
    if (mergedSymbolId === 0 && duplicatePick) setMergedSymbolId(duplicatePick.id);
  }, [duplicatePick, mergedSymbolId]);

  async function handlePreview() {
    const ok = await merge.previewMerge(keptSymbolId, mergedSymbolId);
    if (ok) merge.beginDraft(keptSymbolId, mergedSymbolId);
  }

  async function refreshAfterMutation() {
    await symbolStore.load(true);
    await merge.loadMerges();
    await refreshChains();
  }

  async function handleSubmit() {
    const ok = await merge.submit();
    if (ok) await refreshAfterMutation();
  }

  async function handleRecover(requestId: string) {
    const ok = await merge.recover(requestId);
    if (ok) await refreshAfterMutation();
  }

  async function handleRevert(requestId: string) {
    const ok = await merge.revert(requestId);
    if (ok) await refreshAfterMutation();
  }

  return (
    <section className="merge-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">braille-trainer / merge</p>
          <h1>字符归并</h1>
        </div>
      </header>
      <MergePanel
        symbols={symbols}
        preview={merge.preview}
        loading={merge.loading || symbolStore.loading}
        keptSymbolId={keptSymbolId}
        mergedSymbolId={mergedSymbolId}
        draftRequestId={merge.draft?.requestId ?? null}
        submitting={merge.submitting}
        message={merge.message}
        deviceId={merge.deviceId}
        aliasChains={aliasChains}
        onSelectKept={(id) => { setKeptSymbolId(id); if (id === mergedSymbolId) setMergedSymbolId(0); merge.resetSelection(); }}
        onSelectMerged={(id) => { setMergedSymbolId(id); merge.resetSelection(); }}
        onPreview={handlePreview}
        onSubmit={handleSubmit}
        onRecoverDraft={() => merge.draft && void handleRecover(merge.draft.requestId)}
      />
      <MergeLedger
        merges={merge.merges}
        submitting={merge.submitting}
        deviceId={merge.deviceId}
        onRecover={(requestId) => void handleRecover(requestId)}
        onRevert={(requestId) => void handleRevert(requestId)}
      />
    </section>
  );
}
