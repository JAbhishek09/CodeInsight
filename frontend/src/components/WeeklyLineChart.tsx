interface WeeklyLineChartProps {
  /** Array of 7 data points — Sunday first */
  data: { day: string; count: number }[];
}

export default function WeeklyLineChart({ data }: WeeklyLineChartProps) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const W = 340;
  const H = 100;
  const PAD = 10;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  const points = data.map((d, i) => ({
    x: PAD + (i / (data.length - 1)) * innerW,
    y: PAD + innerH - (d.count / max) * innerH,
    ...d,
  }));

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Build filled area path
  const areaPath =
    `M ${points[0].x},${H - PAD} ` +
    points.map((p) => `L ${p.x},${p.y}`).join(' ') +
    ` L ${points[points.length - 1].x},${H - PAD} Z`;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible">
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ec4899" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Fill area */}
        <path d={areaPath} fill="url(#lineGrad)" />

        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="#ec4899"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots + labels */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#ec4899" />
            {p.count > 0 && (
              <text
                x={p.x}
                y={p.y - 8}
                textAnchor="middle"
                fontSize="8"
                fill="#ec4899"
                fontFamily="monospace"
              >
                {p.count}
              </text>
            )}
            <text
              x={p.x}
              y={H}
              textAnchor="middle"
              fontSize="8"
              fill="#64748b"
              fontFamily="monospace"
            >
              {p.day}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
