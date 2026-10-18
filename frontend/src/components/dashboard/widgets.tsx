import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import { difficultyStyle } from '@/lib/difficulty';
import type { AnalyticsSummary } from '@/hooks/useAnalytics';

export { Panel, PanelLink, Meter, StatTile } from '@/components/panel';
import { Meter } from '@/components/panel';

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
