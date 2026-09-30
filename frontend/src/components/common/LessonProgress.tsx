interface LessonProgressProps {
  title?: string;
  value?: string;
  /** 0~1 的课程完成度 */
  progress?: number;
}

export function LessonProgress({ title = "LessonProgress", value = "0/0", progress = 0 }: LessonProgressProps) {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div className="lesson-progress shared-widget">
      <div className="lesson-progress-head">
        <strong>{title}</strong>
        <span className="hint">{value}</span>
      </div>
      <div className="progress-bar" aria-label={`完成度 ${percent}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
