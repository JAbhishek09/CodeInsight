import { dayKey } from '../lib/format';

interface HeatmapProps {
  /** date(YYYY-MM-DD) → count of solves that day */
  data: Record<string, number>;
  /** how many weeks of history to render (default ~1 year) */
  weeks?: number;
  /** What a count means, e.g. ['problem solved', 'problems solved']. */
  unit?: [singular: string, plural: string];
  /** Square size in px (larger squares suit fewer weeks). */
  cellSize?: number;
}

const LEVELS = [
  { max: 0, color: 'var(--heat-0)' },
  { max: 1, color: 'var(--heat-1)' },
  { max: 2, color: 'var(--heat-2)' },
  { max: 4, color: 'var(--heat-3)' },
  { max: Infinity, color: 'var(--heat-4)' },
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
 * Takes per-day counts keyed by local date (YYYY-MM-DD), e.g. solvedByDay or
 * submissionsByDay from GET /api/analytics/summary. Days with no activity
 * render at the lowest intensity, so new accounts get an empty grid.
 */
export default function Heatmap({ data, weeks = 53, unit = ['problem solved', 'problems solved'], cellSize = 11 }: HeatmapProps) {
  const label = (n: number) => `${n} ${n === 1 ? unit[0] : unit[1]}`;
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
  const CELL = cellSize;
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
              fill="var(--text-muted)"
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
                fill="var(--text-muted)"
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
                style={{ fill: levelColor(c.count) }}
                
              >
                <title>
                  {label(c.count)} · {c.date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </title>
              </rect>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center justify-between text-[10px] text-subtle">
        <span><span className="tabular-nums">{label(totalSolves)}</span> {weeks >= 53 ? 'in the last year' : `in the last ${weeks} weeks`}</span>
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
