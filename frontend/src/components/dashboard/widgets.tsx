import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChevronRight } from 'lucide-react';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import DifficultyBadge from '@/components/DifficultyBadge';
import VerdictBadge from '@/components/VerdictBadge';
import { cn } from '@/lib/utils';
import { difficultyStyle } from '@/lib/difficulty';
import { relativeTime } from '@/lib/format';
import type { AnalyticsSummary } from '@/hooks/useAnalytics';
import type { ProblemListItem } from '@/hooks/useProblems';

// ── Shell ─────────────────────────────────────────────────────────────────────

export function Panel({ title, action, children, className }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-lg border border-border bg-surface-1', className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PanelLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
      {children} <ChevronRight className="size-3.5" />
    </Link>
  );
}

/** Thin progress bar. `value` is 0..1. */
export function Meter({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-surface-3', className)}>
      <div className={cn('h-full rounded-full bg-primary transition-[width] duration-500', barClassName)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── Stat tiles ────────────────────────────────────────────────────────────────

export function StatTile({ label, value, sub, children }: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      {children && <div className="mt-auto pt-2">{children}</div>}
    </div>
  );
}

// ── Monthly solved chart ──────────────────────────────────────────────────────

const LC = ['Easy', 'Medium', 'Hard'] as const;
const CF = ['Div1', 'Div2', 'Div3', 'unrated'] as const;

export function MonthlySolvedChart({ months }: { months: AnalyticsSummary['solvedByMonth'] }) {
  const hasCf = months.some((m) => CF.some((d) => (m.byDifficulty?.[d] ?? 0) > 0));
  const keys = hasCf ? [...LC, ...CF] : [...LC];
  const config = Object.fromEntries(
    keys.map((k) => [k, { label: difficultyStyle(k).label, color: difficultyStyle(k).color }])
  ) satisfies ChartConfig;

  const data = months.map((m) => {
    const [y, mo] = m.month.split('-').map(Number);
    const label = new Date(y, mo - 1, 1).toLocaleDateString(undefined, { month: 'short' });
    return { label, ...Object.fromEntries(keys.map((k) => [k, m.byDifficulty?.[k] ?? 0])) };
  });

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart data={data} margin={{ left: 0, right: 4, top: 4 }}>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            stackId="solved"
            fill={`var(--color-${k})`}
            radius={i === keys.length - 1 ? [3, 3, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

// ── Difficulty progress ───────────────────────────────────────────────────────

export function DifficultyProgress({ byDifficulty }: { byDifficulty: AnalyticsSummary['byDifficulty'] }) {
  const rows = [...LC, ...CF].filter((d) => (byDifficulty[d]?.total ?? 0) > 0);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No problems yet.</p>;
  return (
    <ul className="space-y-4">
      {rows.map((d) => {
        const { solved, total } = byDifficulty[d];
        const s = difficultyStyle(d);
        return (
          <li key={d} className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm">
              <span className={cn('font-medium', s.text)}>{s.label}</span>
              <span className="tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{solved}</span> / {total}
              </span>
            </div>
            <Meter value={total ? solved / total : 0} barClassName={s.dot} />
          </li>
        );
      })}
    </ul>
  );
}

// ── Topics ────────────────────────────────────────────────────────────────────

export function TopicList({ topics, limit = 8 }: { topics: AnalyticsSummary['topics']; limit?: number }) {
  const top = [...topics].sort((a, b) => b.solved - a.solved).slice(0, limit);
  if (top.length === 0) return <p className="text-sm text-muted-foreground">No topic data yet — import your history.</p>;
  const max = Math.max(...top.map((t) => t.solved), 1);
  return (
    <ul className="space-y-3">
      {top.map((t) => (
        <li key={t.tag} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
          <span className="truncate text-foreground" title={t.tag}>{t.tag}</span>
          <Meter value={t.solved / max} />
          <span className="tabular-nums text-xs text-muted-foreground" title={`${t.solved} solved of ${t.total} tracked`}>
            {t.solved}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Recent problems ───────────────────────────────────────────────────────────

export function RecentProblems({ items }: { items: ProblemListItem[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No submissions yet.</p>;
  return (
    <ul className="-mx-2 divide-y divide-border">
      {items.map((p) => (
        <li key={p._id}>
          <Link
            to={`/problems/${p._id}`}
            className="flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-2"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{p.title}</p>
              <p className="text-xs text-muted-foreground">{relativeTime(p.lastSubmittedAt)}</p>
            </div>
            <DifficultyBadge difficulty={p.difficulty} className="hidden sm:inline-flex" />
            {p.latestVerdict && <VerdictBadge verdict={p.latestVerdict} />}
          </Link>
        </li>
      ))}
    </ul>
  );
}
