import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, ComposedChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { DifficultyProgress, Meter, MonthlySolvedChart, Panel, StatTile } from '@/components/dashboard/widgets';
import Heatmap from '@/components/Heatmap';
import { languageLabel } from '@/lib/languages';
import { cn } from '@/lib/utils';
import type { AnalyticsSummary } from '@/hooks/useAnalytics';

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

// ── Submissions per month with acceptance rate ────────────────────────────────

const submissionsConfig = {
  accepted: { label: 'Accepted', color: 'var(--success)' },
  rejected: { label: 'Not accepted', color: 'color-mix(in oklab, var(--danger) 45%, transparent)' },
  rate: { label: 'Acceptance %', color: 'var(--primary)' },
} satisfies ChartConfig;

function SubmissionsChart({ days }: { days: AnalyticsSummary['submissionsByDay'] }) {
  const data = useMemo(() => {
    const byMonth = new Map<string, { accepted: number; total: number }>();
    for (const d of days) {
      const m = d.date.slice(0, 7);
      const cur = byMonth.get(m) ?? { accepted: 0, total: 0 };
      cur.accepted += d.accepted;
      cur.total += d.count;
      byMonth.set(m, cur);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, v]) => {
        const [y, mo] = m.split('-').map(Number);
        return {
          label: new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: 'short' }),
          accepted: v.accepted,
          rejected: v.total - v.accepted,
          rate: v.total ? Math.round((v.accepted / v.total) * 100) : null,
        };
      });
  }, [days]);

  if (data.length === 0) return <p className="text-sm text-muted-foreground">No submissions in the last year.</p>;

  return (
    <ChartContainer config={submissionsConfig} className="aspect-auto h-60 w-full">
      <ComposedChart data={data} margin={{ left: 0, right: 0, top: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis yAxisId="n" allowDecimals={false} tickLine={false} axisLine={false} width={36} />
        <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} width={46} unit="%" />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
        <Bar yAxisId="n" dataKey="accepted" stackId="s" fill="var(--color-accepted)" />
        <Bar yAxisId="n" dataKey="rejected" stackId="s" fill="var(--color-rejected)" radius={[3, 3, 0, 0]} />
        <Line yAxisId="pct" dataKey="rate" type="monotone" stroke="var(--color-rate)" strokeWidth={2} dot={false} connectNulls />
      </ComposedChart>
    </ChartContainer>
  );
}

// ── Weekday activity ──────────────────────────────────────────────────────────

const weekdayConfig = { count: { label: 'Submissions', color: 'var(--primary)' } } satisfies ChartConfig;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function WeekdayChart({ days }: { days: AnalyticsSummary['submissionsByDay'] }) {
  const data = useMemo(() => {
    const counts = Array(7).fill(0);
    for (const d of days) {
      const [y, m, day] = d.date.split('-').map(Number);
      const dow = (new Date(y, m - 1, day).getDay() + 6) % 7; // Monday = 0
      counts[dow] += d.count;
    }
    return WEEKDAYS.map((label, i) => ({ label, count: counts[i] }));
  }, [days]);

  return (
    <ChartContainer config={weekdayConfig} className="aspect-auto h-48 w-full">
      <BarChart data={data} margin={{ left: 0, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel={false} />} />
        <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

// ── Topics table ──────────────────────────────────────────────────────────────

function TopicsTable({ topics }: { topics: AnalyticsSummary['topics'] }) {
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<'solved' | 'rate'>('solved');
  const sorted = useMemo(() => {
    const rows = topics.filter((t) => t.total > 0);
    return sortBy === 'solved'
      ? [...rows].sort((a, b) => b.solved - a.solved)
      : [...rows].filter((t) => t.total >= 3).sort((a, b) => a.solved / a.total - b.solved / b.total);
  }, [topics, sortBy]);
  const visible = showAll ? sorted : sorted.slice(0, 12);

  if (sorted.length === 0) return <p className="text-sm text-muted-foreground">No topic data yet — import your history.</p>;

  return (
    <div className="space-y-3">
      <div className="flex gap-1 text-xs" role="group" aria-label="Sort topics">
        {([['solved', 'Most solved'], ['rate', 'Lowest solve rate']] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSortBy(k)}
            aria-pressed={sortBy === k}
            className={cn('rounded px-2 py-1', sortBy === k ? 'bg-surface-3 text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="space-y-2.5">
        {visible.map((t) => (
          <li key={t.tag} className="grid grid-cols-[minmax(0,10rem)_1fr_4.5rem] items-center gap-3 text-sm">
            <span className="truncate text-foreground" title={t.tag}>{t.tag}</span>
            <Meter value={t.total ? t.solved / t.total : 0} barClassName={pct(t.solved, t.total) < 60 ? 'bg-warning' : undefined} />
            <span className="text-right text-xs tabular-nums text-muted-foreground" title={`${t.solved} solved of ${t.total}`}>
              <span className="text-foreground">{t.solved}</span>/{t.total}
            </span>
          </li>
        ))}
      </ul>
      {sorted.length > 12 && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${sorted.length} topics`}
        </Button>
      )}
    </div>
  );
}

// ── Simple ranked bars (languages, verdicts) ──────────────────────────────────

function RankedBars({ rows, barClass }: { rows: { label: string; value: number; className?: string }[]; barClass?: string }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,8rem)_1fr_3.5rem] items-center gap-3 text-sm">
          <span className="truncate text-foreground">{r.label}</span>
          <Meter value={r.value / max} barClassName={r.className ?? barClass} />
          <span className="text-right text-xs tabular-nums text-muted-foreground">{r.value.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

const VERDICT_ROWS: { key: keyof AnalyticsSummary['verdicts']; label: string; className: string }[] = [
  { key: 'Accepted', label: 'Accepted', className: 'bg-success' },
  { key: 'Wrong Answer', label: 'Wrong answer', className: 'bg-danger' },
  { key: 'TLE', label: 'Time limit', className: 'bg-warning' },
  { key: 'MLE', label: 'Memory limit', className: 'bg-warning' },
  { key: 'RE', label: 'Runtime error', className: 'bg-danger' },
  { key: 'CE', label: 'Compile error', className: 'bg-subtle' },
];

// ── Activity heatmap ─────────────────────────────────────────────────────────

function ActivityPanel({ s }: { s: AnalyticsSummary }) {
  const [mode, setMode] = useState<'solved' | 'submissions'>('solved');
  const data = Object.fromEntries((mode === 'solved' ? s.solvedByDay : s.submissionsByDay).map((d) => [d.date, d.count]));
  return (
    <Panel
      title="Activity"
      action={
        <div className="flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Heatmap shows">
          {(['solved', 'submissions'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m}
              className={cn('rounded px-2 py-0.5 capitalize transition-colors',
                mode === m ? 'bg-surface-3 text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              {m}
            </button>
          ))}
        </div>
      }
    >
      <Heatmap data={data} unit={mode === 'solved' ? ['problem solved', 'problems solved'] : ['submission', 'submissions']} />
    </Panel>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export default function OverviewTab({ s }: { s: AnalyticsSummary }) {
  const t = s.totals;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Solved" value={t.solved.toLocaleString()} sub={`of ${t.problems.toLocaleString()} tracked`} />
        <StatTile label="Attempted, not solved" value={t.attempted.toLocaleString()} sub="worth another try" />
        <StatTile
          label="Acceptance"
          value={t.acceptanceRate === null ? '—' : `${Math.round(t.acceptanceRate * 100)}%`}
          sub={`${t.acceptedSubmissions.toLocaleString()} of ${t.submissions.toLocaleString()} submissions`}
        />
        <StatTile label="Longest streak" value={`${s.streak.longest} days`} sub={`Current: ${s.streak.current} day${s.streak.current === 1 ? '' : 's'}`} />
      </div>

      <ActivityPanel s={s} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Solved per month" className="lg:col-span-2">
          <MonthlySolvedChart months={s.solvedByMonth} />
        </Panel>
        <Panel title="By difficulty">
          <DifficultyProgress byDifficulty={s.byDifficulty} />
        </Panel>
      </div>

      <Panel title="Submissions and acceptance per month">
        <SubmissionsChart days={s.submissionsByDay} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Topics">
          <TopicsTable topics={s.topics} />
        </Panel>
        <div className="space-y-4">
          <Panel title="Results">
            <RankedBars rows={VERDICT_ROWS.map((v) => ({ label: v.label, value: s.verdicts[v.key] ?? 0, className: v.className })).filter((r) => r.value > 0)} />
          </Panel>
          <Panel title="Languages">
            <RankedBars rows={s.languages.slice(0, 6).map((l) => ({ label: languageLabel(l.language), value: l.count }))} />
          </Panel>
        </div>
      </div>

      <Panel title="When you practise">
        <WeekdayChart days={s.submissionsByDay} />
      </Panel>
    </div>
  );
}
