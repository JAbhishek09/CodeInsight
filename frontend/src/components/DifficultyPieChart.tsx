import { difficultyStyle } from '../lib/difficulty';

interface DifficultyPieChartProps {
  easy: number;
  medium: number;
  hard: number;
}

export default function DifficultyPieChart({ easy, medium, hard }: DifficultyPieChartProps) {
  const total = easy + medium + hard || 1;
  const easyPct   = Math.round((easy   / total) * 100);
  const mediumPct = Math.round((medium / total) * 100);
  const hardPct   = Math.round((hard   / total) * 100);

  // Build SVG conic segments via stroke-dasharray trick on a circle
  const R = 60;
  const CIRC = 2 * Math.PI * R;
  const segments = [
    { pct: easyPct,   color: difficultyStyle('Easy').color, label: 'Easy'   },
    { pct: mediumPct, color: difficultyStyle('Medium').color, label: 'Medium' },
    { pct: hardPct,   color: difficultyStyle('Hard').color, label: 'Hard'   },
  ];

  let offset = 0;
  const arcs = segments.map((s) => {
    const dash = (s.pct / 100) * CIRC;
    const gap  = CIRC - dash;
    const arc  = { ...s, dash, gap, offset };
    offset += dash;
    return arc;
  });

  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="20" />
        {total > 1 && arcs.map((a, i) => (
          <circle
            key={i}
            cx="70" cy="70" r={R}
            fill="none"
            style={{ stroke: a.color }}
            strokeWidth="20"
            strokeDasharray={`${a.dash} ${a.gap}`}
            strokeDashoffset={-a.offset}
            strokeLinecap="butt"
          />
        ))}
        {total === 1 && (
          <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="20" />
        )}
      </svg>

      <div className="space-y-3">
        {[
          { ...difficultyStyle('Easy'),   count: easy },
          { ...difficultyStyle('Medium'), count: medium },
          { ...difficultyStyle('Hard'),   count: hard },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${item.dot} flex-shrink-0`} />
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <span className={`text-xs  font-bold ${item.text} ml-auto tabular-nums`}>{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
