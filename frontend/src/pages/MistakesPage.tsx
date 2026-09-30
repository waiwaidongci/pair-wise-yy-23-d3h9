import { useEffect, useState } from "react";
import { MistakeBook } from "../components/common/MistakeBook";

/** 错题本页：revision 由外层导航/归并事件驱动，组件内按保留卡片重算 */
export function MistakesPage({ revision = 0 }: { revision?: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => setTick((value) => value + 1), [revision]);
  return (
    <section>
      <header className="page-head">
        <div>
          <p className="eyebrow">braille-trainer / mistakes</p>
          <h1>错题本</h1>
        </div>
      </header>
      <MistakeBook revision={tick} />
    </section>
  );
}
