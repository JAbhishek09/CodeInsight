import { useState as useReactState } from 'react';
import { TrendSeries } from '../utils/stats';

interface TrendChartProps {
  series: TrendSeries[];
  height?: number;
  yLabel?: string;
}

/**
 * Multi-series line/area SVG chart.
 *
 * FIXES:
 * 1. "Stacked dots" bug — when all Y values are 0 (no data yet), the old
 *    code set max=1 and still rendered a polyline, so all dots collapsed to
 *    the bottom-left. Now we detect the all-zero case early and show a
 *    beautiful empty state instead of a broken chart.
 * 2. No area fill — added per-series gradient fill so series are visually
 *    distinct even when they overlap.
 * 3. No tooltips — SVG <title> tags work but are invisible. Added a proper
 *    hover tooltip with month + value.
 * 4. Y-axis labels — shows 0 / mid / max so the chart reads at a glance.
 */
export default function TrendChart({ series, height = 180, yLabel }: TrendChartProps) {
  const [tooltip, setTooltip] = useReactState<{ x: number; y: number; label: string } | null>(null);

  const W = 560;
  const H = height;
  const PAD_L = 32;   // left padding for Y-axis labels
  const PAD_R = 12;
  const PAD_T = 16;
  const PAD_B = 22;   // bottom padding for X-axis labels
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const max  = Math.max(...allY, 0);
  const count = series[0]?.points.length || 0;

  // ── Empty state: no series, no points, or all-zero data ──────────────────
  const allZero = max === 0;
  if (count === 0 || series.length === 0 || allZero) {
    return (
      <div className="relative w-full" style={{ height: H }}>
        {/* Ghost chart in the background */}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full opacity-5">
          {[0, 1, 2].map((i) => (
            <line key={i} x1={PAD_L} x2={W - PAD_R}
              y1={PAD_T + innerH * (1 - i / 2)} y2={PAD_T + innerH * (1 - i / 2)}
              stroke="var(--chart-grid)" strokeWidth="1" />
          ))}
          <polyline
            points={`${PAD_L},${PAD_T + innerH} ${PAD_L + innerW * 0.3},${PAD_T + innerH * 0.6} ${PAD_L + innerW * 0.6},${PAD_T + innerH * 0.4} ${PAD_L + innerW},${PAD_T + innerH * 0.7}`}
            fill="none" stroke="var(--primary)" strokeWidth="2" />
        </svg>
        {/* Centered message */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <p className="text-xs text-subtle text-center leading-relaxed max-w-[200px]">
            Not enough data yet.<br />Keep solving to generate trends!
          </p>
        </div>
      </div>
    );
  }

  const toSVG = (i: number, y: number) => ({
    sx: PAD_L + (count > 1 ? (i / (count - 1)) * innerW : innerW / 2),
    sy: PAD_T + innerH - (y / max) * innerH,
  });

  const midVal  = Math.round(max / 2);
  const gridYs  = [0, midVal, max];

  return (
    <div className="w-full space-y-3">
      {/* Legend */}
      {series.length > 1 && (
        <div className="flex flex-wrap items-center gap-4">
          {series.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              {s.label}
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto overflow-visible"
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.label} id={`grad-${s.label.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   style={{ stopColor: s.color }} stopOpacity="0.2" />
                <stop offset="100%" style={{ stopColor: s.color }} stopOpacity="0.0"  />
              </linearGradient>
            ))}
          </defs>

          {/* Y-axis gridlines + labels */}
          {gridYs.map((v) => {
            const sy = PAD_T + innerH - (v / max) * innerH;
            return (
              <g key={v}>
                <line x1={PAD_L} x2={W - PAD_R} y1={sy} y2={sy} stroke="var(--chart-grid)" strokeWidth="1" />
                <text x={PAD_L - 4} y={sy + 3} textAnchor="end" fontSize="8" fill="var(--text-muted)" className="tabular-nums">
                  {v}
                </text>
              </g>
            );
          })}

          {/* Series: area fill + polyline + dots */}
          {series.map((s) => {
            const pts = s.points.map((p, i) => ({ ...toSVG(i, p.y), label: p.x, value: p.y }));
            const polyline = pts.map((p) => `${p.sx},${p.sy}`).join(' ');
            const areaPath =
              `M ${pts[0].sx},${PAD_T + innerH} ` +
              pts.map((p) => `L ${p.sx},${p.sy}`).join(' ') +
              ` L ${pts[pts.length - 1].sx},${PAD_T + innerH} Z`;
            const gradId = `grad-${s.label.replace(/\s+/g, '')}`;

            return (
              <g key={s.label}>
                <path d={areaPath} fill={`url(#${gradId})`} />
                <polyline
                  points={polyline}
                  fill="none"
                  style={{ stroke: s.color }}
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {pts.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.sx} cy={p.sy} r="4"
                    style={{ fill: p.value > 0 ? s.color : 'var(--surface-1)', stroke: s.color }}
                    strokeWidth="1.5"
                    className="cursor-pointer"
                    onMouseEnter={() =>
                      setTooltip({
                        x: p.sx,
                        y: p.sy,
                        label: series.length > 1
                          ? `${p.label} · ${s.label}: ${p.value}`
                          : `${p.label}: ${p.value}`,
                      })
                    }
                  />
                ))}
              </g>
            );
          })}

          {/* X-axis month labels */}
          {series[0].points.map((p, i) => {
            const { sx } = toSVG(i, 0);
            return (
              <text key={p.x + i} x={sx} y={H - 4} textAnchor="middle" fontSize="8" fill="var(--text-muted)">
                {p.x}
              </text>
            );
          })}
        </svg>

        {/* Floating tooltip */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-10 px-2.5 py-1.5 bg-card border border-border-strong rounded-lg text-[10px] text-foreground shadow-xl whitespace-nowrap"
            style={{
              left: `${(tooltip.x / W) * 100}%`,
              top:  `${(tooltip.y / H) * 100}%`,
              transform: 'translate(-50%, -130%)',
            }}
          >
            {tooltip.label}
          </div>
        )}
      </div>
    </div>
  );
}
