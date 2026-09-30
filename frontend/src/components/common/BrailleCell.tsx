import { useMemo } from "react";

interface BrailleCellProps {
  /** 凸点编号，如 "1-4-5" 表示第 1、4、5 点凸起（标准六点：左列 1,2,3 / 右列 4,5,6） */
  pattern?: string;
  letter?: string;
  size?: number;
  title?: string;
  /** 兼容旧桩调用 */
  value?: string;
}

const DOT_POSITIONS: Record<number, { col: number; row: number }> = {
  1: { col: 0, row: 0 },
  2: { col: 0, row: 1 },
  3: { col: 0, row: 2 },
  4: { col: 1, row: 0 },
  5: { col: 1, row: 1 },
  6: { col: 1, row: 2 }
};

export function parseCellPattern(pattern: string | undefined): Set<number> {
  if (!pattern) return new Set();
  const dots = new Set<number>();
  for (const part of pattern.split(/[^\d]+/)) {
    const dot = Number(part);
    if (dot >= 1 && dot <= 6) dots.add(dot);
  }
  return dots;
}

export function BrailleCell({ pattern = "", letter, size = 64, title, value }: BrailleCellProps) {
  const raised = useMemo(() => parseCellPattern(pattern || value), [pattern, value]);
  const dotSize = Math.round(size * 0.22);
  return (
    <div className="braille-cell" title={title ?? letter} role="img" aria-label={`盲文字符 ${letter ?? pattern}`}>
      <div className="braille-grid" style={{ width: size, height: size * 1.25 }}>
        {[1, 2, 3, 4, 5, 6].map((dot) => {
          const position = DOT_POSITIONS[dot];
          return (
            <span
              key={dot}
              className={raised.has(dot) ? "dot raised" : "dot"}
              style={{
                width: dotSize,
                height: dotSize,
                left: position.col === 0 ? size * 0.18 : size * 0.55,
                top: position.row * size * 0.36 + size * 0.08
              }}
            />
          );
        })}
      </div>
      {letter ? <span className="braille-letter">{letter}</span> : null}
    </div>
  );
}
