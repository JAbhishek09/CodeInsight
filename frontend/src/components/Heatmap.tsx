import { dayKey } from '../utils/stats';

interface HeatmapProps {
  /** date(YYYY-MM-DD) → count of solves that day */
  data: Record<string, number>;
  /** how many weeks of history to render (default ~1 year) */
  weeks?: number;
}

const LEVELS = [
  { max: 0, color: '#0f1420' },
  { max: 1, color: '#4a1942' },
  { max: 2, color: '#831843' },
  { max: 4, color: '#db2777' },
  { max: Infinity, color: '#f472b6' },
];

function levelColor(count: number): string {
  for (const l of LEVELS) {
    if (count <= l.max) return l.color;
  }
  return LEVELS[LEVELS.length - 1].color;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

/**
 * GitHub-style contribution heatmap.
 *
 * Built entirely from `submissions[].submittedAt` already returned by
 * `GET /api/problems` — no dedicated backend endpoint required. Cells with
 * no recorded activity simply render at the lowest intensity (empty), so
 * this degrades gracefully to an all-empty grid for brand-new accounts.
 */
export default function Heatmap({ data, weeks = 53 }: HeatmapProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalDays = weeks * 7;
  const start = new Date(today);
  start.setDate(start.getDate() - (totalDays - 1));
  start.setDate(start.getDate() - start.getDay()); // snap back to Sunday

  const cells: { key: string; date: Date; count: number }[] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const key = dayKey(cursor);
    cells.push({ key, date: new Date(cursor), count: data[key] || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  const colCount = Math.ceil(cells.length / 7);
  const CELL = 11;
  const GAP = 3;
  const STEP = CELL + GAP;
  const TOP_PAD = 16;
  const width = colCount * STEP;
  const height = TOP_PAD + 7 * STEP;

  // Month labels: place a label above the first column whose week contains
  // the 1st of a new month.
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let col = 0; col < colCount; col++) {
    const cellIdx = col * 7;
    const cellDate = cells[cellIdx]?.date;
    if (!cellDate) continue;
    const m = cellDate.getMonth();
    if (m !== lastMonth) {
      monthLabels.push({ col, label: MONTHS[m] });
      lastMonth = m;
    }
  }

  const totalSolves = cells.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto pb-1">
        <svg width={width} height={height} className="overflow-visible">
          {monthLabels.map(({ col, label }) => (
            <text
              key={`${col}-${label}`}
              x={col * STEP}
              y={10}
              fontSize="9"
              fill="#64748b"
              fontFamily="monospace"
            >
              {label}
            </text>
          ))}
          {DAY_LABELS.map((label, row) =>
            label ? (
              <text
                key={row}
                x={-4}
                y={TOP_PAD + row * STEP + CELL - 1}
                textAnchor="end"
                fontSize="8"
                fill="#475569"
                fontFamily="monospace"
              >
                {label}
              </text>
            ) : null
          )}
          {cells.map((c, i) => {
            const col = Math.floor(i / 7);
            const row = i % 7;
            return (
              <rect
                key={c.key}
                x={col * STEP}
                y={TOP_PAD + row * STEP}
                width={CELL}
                height={CELL}
                rx={2.5}
                fill={levelColor(c.count)}
                stroke="rgba(255,255,255,0.03)"
              >
                <title>
                  {c.count} solved · {c.date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </title>
              </rect>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
        <span>{totalSolves} solves in the last {weeks} weeks</span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          {LEVELS.map((l, i) => (
            <span key={i} className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
