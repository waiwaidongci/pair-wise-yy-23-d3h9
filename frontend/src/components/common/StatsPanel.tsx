import { useMemo } from "react";
import { useDatabaseTable } from "../../hooks/useDatabase";
import type { BrailleSymbol } from "../../types/BrailleSymbol";
import type { AnswerRecord } from "../../types/AnswerRecord";
import type { Lesson } from "../../types/Lesson";
import {
  computeMistakeBook,
  computeProgress,
  type MistakeBookEntry,
  type ProgressEntry
} from "../../services/statsService";
import { StatCard } from "./StatCard";
import { EmptyState } from "./EmptyState";

/**
 * 归并后重算面板：错题本与学习进度按保留卡片重算。
 */
export function StatsPanel() {
  // 订阅数据变更，归并后自动重算
  useDatabaseTable<BrailleSymbol>("brailleSymbol");
  useDatabaseTable<AnswerRecord>("answerRecord");
  useDatabaseTable<Lesson>("lesson");

  const mistakeBook = useMemo<MistakeBookEntry[]>(() => computeMistakeBook(), []);
  const progress = useMemo<ProgressEntry[]>(() => computeProgress(), []);

  const totalMistakes = mistakeBook.reduce((sum: number, entry: MistakeBookEntry) => sum + entry.mistake_count, 0);
  const totalAnswers = mistakeBook.reduce((sum: number, entry: MistakeBookEntry) => sum + entry.total_answers, 0);
  const avgMastery = progress.length
    ? progress.reduce((sum: number, entry: ProgressEntry) => sum + entry.mastery_rate, 0) / progress.length
    : 0;

  return (
    <div className="stats-panel">
      <section className="metrics">
        <StatCard label="答题总数" value={totalAnswers} />
        <StatCard label="错题数（按保留卡片）" value={totalMistakes} />
        <StatCard label="平均掌握度" value={`${Math.round(avgMastery * 100)}%`} />
      </section>

      <section className="panel">
        <h2>错题本（按保留卡片聚合）</h2>
        {mistakeBook.length === 0 ? (
          <EmptyState title="暂无错题" />
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th>卡片</th>
                <th>点字</th>
                <th>错题数</th>
                <th>答题数</th>
                <th>错误率</th>
              </tr>
            </thead>
            <tbody>
              {mistakeBook.map((entry: MistakeBookEntry) => (
                <tr key={entry.symbol_id}>
                  <td>{entry.symbol_letter}</td>
                  <td className="mono">{entry.cell_pattern}</td>
                  <td>{entry.mistake_count}</td>
                  <td>{entry.total_answers}</td>
                  <td>{Math.round(entry.mistake_rate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2>学习进度（按保留卡片重算）</h2>
        {progress.length === 0 ? (
          <EmptyState title="暂无课程" />
        ) : (
          <table className="stats-table">
            <thead>
              <tr>
                <th>课程</th>
                <th>卡片数</th>
                <th>已掌握</th>
                <th>掌握度</th>
                <th>练习次数</th>
                <th>平均分数</th>
              </tr>
            </thead>
            <tbody>
              {progress.map((entry: ProgressEntry) => (
                <tr key={entry.lesson_id}>
                  <td>
                    #{entry.lesson_id} {entry.lesson_title}
                  </td>
                  <td>{entry.symbol_count}</td>
                  <td>{entry.mastered_count}</td>
                  <td>{Math.round(entry.mastery_rate * 100)}%</td>
                  <td>{entry.session_count}</td>
                  <td>{Math.round(entry.average_score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
