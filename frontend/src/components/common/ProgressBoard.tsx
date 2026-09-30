import { getProgressStatsApi } from "../../api/SymbolMerge";
import { ChartPanel } from "./ChartPanel";
import { LessonProgress } from "./LessonProgress";
import { StatCard } from "./StatCard";
import { formatMastery, formatNumber, formatPercent } from "../../utils/formatters";
import type { ProgressStats } from "../../services/progress";

interface ProgressBoardProps {
  stats: ProgressStats | null;
}

/** 学习进度面板：课程完成度与得分趋势在归并后按保留卡片重算 */
export function ProgressBoard({ stats }: ProgressBoardProps) {
  if (!stats) return <div className="panel wide"><h2>学习进度</h2><p className="hint">正在统计…</p></div>;
  return (
    <>
      <section className="metrics">
        <StatCard label="练习场次" value={formatNumber(stats.totalSessions)} />
        <StatCard label="平均得分" value={formatNumber(Math.round(stats.averageScore))} />
        <StatCard label="累计错题" value={formatNumber(stats.totalMistakes)} />
      </section>
      <section className="workbench">
        <div className="panel wide">
          <h2>课程进度（字符已解析到保留卡片）</h2>
          {stats.lessonProgress.map((item) => (
            <LessonProgress
              key={item.lesson.id}
              title={`#${item.lesson.id} ${item.lesson.title}`}
              value={`${item.masteredSymbols}/${item.totalSymbols}`}
              progress={item.progress}
            />
          ))}
        </div>
        <ChartPanel title="得分趋势" points={stats.scoreTrend.map((point) => ({ label: point.date, value: point.score }))} />
      </section>
      <section className="panel wide">
        <h2>各卡片掌握度（旧编号历史已并入）</h2>
        <div className="table">
          {stats.symbolProgress.map((item) => (
            <article key={item.symbolId} className="row">
              <strong>保留卡片 #{item.symbolId}</strong>
              <span className="hint">{formatMastery(item.mastery)} · 练习 {item.total} 次 · 错 {item.wrong} 次</span>
              <span className="hint">正确率 {formatPercent(item.accuracy)}</span>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}

export type { ProgressStats };
export { getProgressStatsApi };
