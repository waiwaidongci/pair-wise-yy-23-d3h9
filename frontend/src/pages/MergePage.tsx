import { MergePanel } from "../components/common/MergePanel";
import { StatsPanel } from "../components/common/StatsPanel";

export function MergePage() {
  return (
    <section className="page">
      <section className="page-head">
        <div>
          <p className="eyebrow">braille-trainer</p>
          <h1>字符归并</h1>
        </div>
      </section>
      <MergePanel />
      <StatsPanel />
    </section>
  );
}
