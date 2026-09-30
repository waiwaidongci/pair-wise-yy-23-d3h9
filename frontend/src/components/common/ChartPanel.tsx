interface ChartPoint {
  label: string;
  value: number;
}

interface ChartPanelProps {
  title?: string;
  points?: ChartPoint[];
}

/** 轻量得分趋势图（纯 div 柱状，不引第三方图表库） */
export function ChartPanel({ title = "ChartPanel", points = [] }: ChartPanelProps) {
  const max = Math.max(100, ...points.map((point) => point.value));
  return (
    <div className="panel chart-panel">
      <h2>{title}</h2>
      {points.length === 0 ? <p className="hint">暂无完成的会话</p> : (
        <div className="chart-bars">
          {points.map((point) => (
            <div key={point.label} className="chart-col" title={`${new Date(point.label).toLocaleDateString("zh-CN")}：${point.value}`}>
              <span className="chart-bar" style={{ height: `${(point.value / max) * 100}%` }} />
              <small>{new Date(point.label).toLocaleDateString("zh-CN").slice(5)}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
