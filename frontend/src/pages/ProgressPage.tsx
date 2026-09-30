import { useEffect, useState } from "react";
import { ProgressBoard, getProgressStatsApi } from "../components/common/ProgressBoard";
import type { ProgressStats } from "../services/progress";

export function ProgressPage({ revision = 0 }: { revision?: number }) {
  const [stats, setStats] = useState<ProgressStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProgressStatsApi().then((rows) => {
      if (!cancelled) setStats(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  return (
    <section>
      <header className="page-head">
        <div>
          <p className="eyebrow">braille-trainer / progress</p>
          <h1>学习进度</h1>
        </div>
      </header>
      <ProgressBoard stats={stats} />
    </section>
  );
}
