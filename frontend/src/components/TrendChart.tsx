import { TrendSeries } from '../utils/stats';

interface TrendChartProps {
  series: TrendSeries[];
  height?: number;
}

/**
 * Generic multi-series line/area trend chart — same hand-rolled SVG approach
 * as WeeklyLineChart, generalized to N points and N series so it can power
 * Solving Trends, Difficulty Trends, and Acceptance Rate Trends on the
 * Analytics page without pulling in a charting library.
 */
export default function TrendChart({ series, height = 200 }: TrendChartProps) {
  const W = 600;
  const H = height;
  const PAD = 26;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const max = Math.max(...allY, 1);
  const count = series[0]?.points.length || 1;

  const toXY = (i: number, y: number) => ({
    x: PAD + (count > 1 ? (i / (count - 1)) * innerW : innerW / 2),
    y: PAD + innerH - (y / max) * innerH,
  });

  if (count === 0 || series.length === 0) {
    return <div className="text-center py-10 text-slate-600 text-xs font-mono">No trend data yet</div>;
  }

  return (
    <div className="w-full space-y-3">
      {series.length > 1 && (
        <div className="flex flex-wrap items-center gap-4">
          {series.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible">
        {/* horizontal gridlines */}
        {[0, 0.5, 1].map((f) => (
          <line
            key={f}
            x1={PAD}
            x2={W - PAD}
            y1={PAD + innerH * (1 - f)}
            y2={PAD + innerH * (1 - f)}
            stroke="#0f172a"
            strokeWidth="1"
          />
        ))}

        {series.map((s) => {
          const pts = s.points.map((p, i) => ({ ...toXY(i, p.y), ...p }));
          const polyline = pts.map((p) => `${p.x},${p.y}`).join(' ');
          return (
            <g key={s.label}>
              <polyline
                points={polyline}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill={s.color}>
                  <title>{`${p.x}: ${p.y}`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {series[0].points.map((p, i) => {
          const { x } = toXY(i, p.y);
          return (
            <text key={p.x + i} x={x} y={H - 6} textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="monospace">
              {p.x}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
