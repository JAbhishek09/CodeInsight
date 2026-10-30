import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, ComposedChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Button } from '@/components/ui/button';
import { DifficultyProgress, Meter, Panel, SolvedChart, StatTile, tipLabel, type SolvedRow } from '@/components/dashboard/widgets';
import Heatmap from '@/components/Heatmap';
import { languageLabel } from '@/lib/languages';
import { cn } from '@/lib/utils';
import { addDays, firstActiveDay, fitRange, perGrain, sumByBucket, weekStart, type ActivityRange, type Grain } from '@/lib/activityRange';
import type { AnalyticsSummary, Difficulty } from '@/hooks/useAnalytics';

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

// ── Labels for days, weeks and months ─────────────────────────────────────────

const localDate = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fmt = (day: string, o: Intl.DateTimeFormatOptions) => localDate(day).toLocaleDateString(undefined, o);

/** Short axis label and the tooltip's fuller one for a bucket starting on `start`. */
function labels(start: string, grain: Grain): { label: string; tip: string } {
  const monthDay = fmt(start, { month: 'short', day: 'numeric' });
  if (grain === 'day') return { label: monthDay, tip: fmt(start, { weekday: 'short', month: 'short', day: 'numeric' }) };
  if (grain === 'week') return { label: monthDay, tip: `Week of ${monthDay}` };
  return { label: fmt(start, { month: 'short' }), tip: fmt(start, { month: 'long', year: 'numeric' }) };
}

/** Solved per bucket, by difficulty. Months use the server's monthly totals. */
function solvedRows(s: AnalyticsSummary, range: ActivityRange): SolvedRow[] {
  if (range.grain === 'month') {
    return s.solvedByMonth
      .filter((m) => m.month >= range.from.slice(0, 7))
      .map((m) => ({ ...labels(`${m.month}-01`, 'month'), byDifficulty: m.byDifficulty }));
  }
  return sumByBucket(s.solvedByDay, range, (): Partial<Record<Difficulty, number>> => ({}), (v, d) => {
    for (const [k, n] of Object.entries(d.byDifficulty ?? {}) as [Difficulty, number][]) v[k] = (v[k] ?? 0) + n;
  }).map((b) => ({ ...labels(b.start, range.grain), byDifficulty: b.value }));
}

// ── Submissions with acceptance rate ──────────────────────────────────────────

const submissionsConfig = {
  accepted: { label: 'Accepted', color: 'var(--success)' },
  rejected: { label: 'Not accepted', color: 'color-mix(in oklab, var(--danger) 45%, transparent)' },
  rate: { label: 'Acceptance %', color: 'var(--primary)' },
} satisfies ChartConfig;

function SubmissionsChart({ days, range }: { days: AnalyticsSummary['submissionsByDay']; range: ActivityRange }) {
  const data = useMemo(
    () => sumByBucket(days, range, () => ({ accepted: 0, total: 0 }), (v, d) => { v.accepted += d.accepted; v.total += d.count; })
      .map((b) => ({
        ...labels(b.start, range.grain),
        accepted: b.value.accepted,
        rejected: b.value.total - b.value.accepted,
        rate: b.value.total ? Math.round((b.value.accepted / b.value.total) * 100) : null,
      })),
    [days, range]
  );

  if (data.every((d) => d.accepted + d.rejected === 0)) return <p className="text-sm text-muted-foreground">No submissions in this period.</p>;

  return (
    <ChartContainer config={submissionsConfig} className="aspect-auto h-60 w-full">
      <ComposedChart data={data} margin={{ left: 0, right: 0, top: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={12} />
        <YAxis yAxisId="n" allowDecimals={false} tickLine={false} axisLine={false} width={36} />
        <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} width={46} unit="%" />
        <ChartTooltip cursor={false} content={<ChartTooltipContent labelFormatter={tipLabel} />} />
        <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
        <Bar yAxisId="n" dataKey="accepted" stackId="s" fill="var(--color-accepted)" />
        <Bar yAxisId="n" dataKey="rejected" stackId="s" fill="var(--color-rejected)" radius={[3, 3, 0, 0]} />
        <Line yAxisId="pct" dataKey="rate" type="monotone" stroke="var(--color-rate)" strokeWidth={2} dot={range.grain !== 'day'} connectNulls />
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
      const dow = (localDate(d.date).getDay() + 6) % 7; // Monday = 0
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

function TopicsTable({ topics, loading }: { topics: AnalyticsSummary['topics']; loading: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const [sortBy, setSortBy] = useState<'solved' | 'rate'>('solved');
  const sorted = useMemo(() => {
    const rows = topics.filter((t) => t.total > 0);
    return sortBy === 'solved'
      ? [...rows].sort((a, b) => b.solved - a.solved)
      : [...rows].filter((t) => t.total >= 3).sort((a, b) => a.solved / a.total - b.solved / b.total);
  }, [topics, sortBy]);
  const visible = showAll ? sorted : sorted.slice(0, 12);
  const fetching = (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <Loader2 className="size-4 animate-spin" aria-hidden /> Getting topic tags from LeetCode…
    </p>
  );

  if (topics.length === 0) {
    if (loading) return fetching;
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>No topic tags yet. They come from LeetCode for the problems you import or solve with the extension.</p>
        <Button size="sm" variant="outline" asChild><Link to="/profile?tab=import">Import history</Link></Button>
      </div>
    );
  }

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
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No topic has 3 or more problems yet.</p>
      ) : (
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
      )}
      {sorted.length > 12 && (
        <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${sorted.length} topics`}
        </Button>
      )}
      {loading && fetching}
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

/** Beside the heatmap: active days, this week and the best day, over the weeks shown. */
function ActivityStats({ days, today, weeks, solved }: { days: { date: string; count: number }[]; today: string; weeks: number; solved: boolean }) {
  const from = addDays(today, -(weeks * 7 - 1));
  const shown = days.filter((d) => d.date >= from && d.date <= today);
  const active = shown.filter((d) => d.count > 0).length;
  const monday = weekStart(today);
  const thisWeek = shown.filter((d) => d.date >= monday).reduce((n, d) => n + d.count, 0);
  const best = shown.reduce<{ date: string; count: number } | null>((b, d) => (d.count > (b?.count ?? 0) ? d : b), null);
  const stats = [
    { label: 'Active days', value: active, sub: weeks >= 53 ? 'in the last year' : `in the last ${weeks} weeks` },
    { label: 'This week', value: thisWeek, sub: solved ? 'problems solved' : 'submissions' },
    { label: 'Best day', value: best?.count ?? 0, sub: best ? fmt(best.date, { month: 'short', day: 'numeric' }) : 'no activity yet' },
  ];
  return (
    <dl className="grid shrink-0 grid-cols-3 gap-4 lg:w-40 lg:grid-cols-1 lg:gap-5">
      {stats.map((x) => (
        <div key={x.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{x.label}</dt>
          <dd className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{x.value}</dd>
          <dd className="truncate text-xs text-subtle">{x.sub}</dd>
        </div>
      ))}
    </dl>
  );
}

function ActivityPanel({ s, weeks }: { s: AnalyticsSummary; weeks: number }) {
  const [mode, setMode] = useState<'solved' | 'submissions'>('solved');
  const days = mode === 'solved' ? s.solvedByDay : s.submissionsByDay;
  const data = Object.fromEntries(days.map((d) => [d.date, d.count]));
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
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-12">
        <div className="min-w-0">
          {/* Fewer weeks for a short history, with bigger squares */}
          <Heatmap data={data} weeks={weeks} cellSize={weeks <= 26 ? 14 : 11}
            unit={mode === 'solved' ? ['problem solved', 'problems solved'] : ['submission', 'submissions']} />
        </div>
        <ActivityStats days={days} today={s.range.to} weeks={weeks} solved={mode === 'solved'} />
      </div>
    </Panel>
  );
}

/** No dated activity in the last year: say why, and how to get the charts going. */
function NoHistory({ undated }: { undated: number }) {
  return (
    <div className="space-y-3 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Nothing solved or submitted in the last year yet.</p>
      <p>
        {undated > 0
          ? `${undated} solved ${undated === 1 ? 'problem was' : 'problems were'} imported without dates, so they can’t go on a timeline. Importing with your LeetCode session brings in their dates and code.`
          : 'Your charts start from your first submission. Import your LeetCode history, or solve a problem with the extension on.'}
      </p>
      <Button size="sm" variant="outline" asChild><Link to="/profile?tab=import">Import history</Link></Button>
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export default function OverviewTab({ s }: { s: AnalyticsSummary }) {
  const t = s.totals;
  // Charts start at the student's first activity: days, then weeks, then months
  const range = useMemo(() => fitRange(firstActiveDay(s.solvedByDay, s.submissionsByDay), s.range.to), [s]);
  const solved = useMemo(() => (range ? solvedRows(s, range) : []), [s, range]);

  // Topic tags arrive in the background for new problems; look again shortly
  const qc = useQueryClient();
  useEffect(() => {
    if (!s.topicsLoading) return;
    const timer = setTimeout(() => qc.invalidateQueries({ queryKey: ['analytics', 'summary'] }), 4000);
    return () => clearTimeout(timer);
  }, [s.topicsLoading, s.generatedAt, qc]);

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

      {range && <ActivityPanel s={s} weeks={range.heatmapWeeks} />}

      <div className="grid gap-4 lg:grid-cols-3">
        {range ? (
          <Panel title={`Solved ${perGrain(range.grain)}`} className="lg:col-span-2">
            <SolvedChart rows={solved} />
          </Panel>
        ) : (
          <Panel title="Activity" className="lg:col-span-2">
            <NoHistory undated={t.solvedUndated} />
          </Panel>
        )}
        <Panel title="By difficulty">
          <DifficultyProgress byDifficulty={s.byDifficulty} />
        </Panel>
      </div>

      {range && (
        <Panel title={`Submissions and acceptance ${perGrain(range.grain)}`}>
          <SubmissionsChart days={s.submissionsByDay} range={range} />
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Topics">
          <TopicsTable topics={s.topics} loading={!!s.topicsLoading} />
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

      {range && (
        <Panel title="When you practise">
          <WeekdayChart days={s.submissionsByDay} />
        </Panel>
      )}
    </div>
  );
}
