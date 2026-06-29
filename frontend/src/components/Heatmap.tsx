import { useState, useRef } from 'react';
import { dayKey } from '../utils/stats';

interface HeatmapProps {
  /** date(YYYY-MM-DD) → count of solves and total submissions that day */
  data: Record<string, { solves: number; submissions: number }>;
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

export default function Heatmap({ data, weeks = 53 }: HeatmapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    key: string;
    date: Date;
    solves: number;
    submissions: number;
    x: number;
    y: number;
  } | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalDays = weeks * 7;
  const start = new Date(today);
  start.setDate(start.getDate() - (totalDays - 1));
  start.setDate(start.getDate() - start.getDay()); // snap back to Sunday

  const cells: { key: string; date: Date; solves: number; submissions: number }[] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const key = dayKey(cursor);
    const dayData = data[key] || { solves: 0, submissions: 0 };
    cells.push({
      key,
      date: new Date(cursor),
      solves: dayData.solves,
      submissions: dayData.submissions,
    });
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

  const totalSolves = cells.reduce((sum, c) => sum + c.solves, 0);

  return (
    <div className="space-y-3 relative">
      <div
        ref={containerRef}
        className="overflow-x-auto pb-1"
        onScroll={() => setHoveredCell(null)}
      >
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
            const x = col * STEP;
            const y = TOP_PAD + row * STEP;
            return (
              <rect
                key={c.key}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                rx={2.5}
                fill={levelColor(c.solves)}
                stroke="rgba(255,255,255,0.03)"
                onMouseEnter={() => {
                  setHoveredCell({
                    key: c.key,
                    date: c.date,
                    solves: c.solves,
                    submissions: c.submissions,
                    x,
                    y,
                  });
                }}
                onMouseLeave={() => setHoveredCell(null)}
                className="cursor-pointer hover:stroke-white/20 transition-all duration-100"
              >
                <title>
                  {c.solves} solved · {c.submissions} submissions · {c.date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </title>
              </rect>
            );
          })}
        </svg>
      </div>

      {hoveredCell && (
        <div
          className="absolute z-[100] pointer-events-none bg-slate-950/95 border border-slate-800 rounded-lg p-2.5 shadow-2xl backdrop-blur-md text-[11px] font-mono text-slate-300 w-44 transition-all duration-150 ease-out"
          style={{
            left: hoveredCell.x + CELL / 2 - (containerRef.current?.scrollLeft || 0),
            top: hoveredCell.y,
            transform: 'translate(-50%, -100%) translateY(-8px)',
          }}
        >
          <div className="space-y-1 text-center">
            <p className="font-bold text-slate-200 border-b border-slate-800/80 pb-1 mb-1.5 text-[10px]">
              {hoveredCell.date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <div className="flex justify-between items-center gap-4 text-left">
              <span className="text-slate-400">Solves:</span>
              <span className="font-extrabold text-pink-400 font-mono">{hoveredCell.solves}</span>
            </div>
            <div className="flex justify-between items-center gap-4 text-left">
              <span className="text-slate-400">Submissions:</span>
              <span className="font-extrabold text-purple-400 font-mono">{hoveredCell.submissions}</span>
            </div>
          </div>
          {/* Tooltip Arrow */}
          <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 bg-slate-950 border-r border-b border-slate-800 rotate-45" />
        </div>
      )}

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

