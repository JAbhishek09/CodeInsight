import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DifficultyBadge from '@/components/DifficultyBadge';
import { Meter, Panel, StatTile } from '@/components/dashboard/widgets';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/format';
import {
  complexityGaps, edgeCaseThemes, feedbackThemes, formatMinutes,
  type AiInsightsData, type Theme,
} from '@/lib/insights';
import type { AnalyticsSummary } from '@/hooks/useAnalytics';

// ── Expandable theme list (feedback and edge cases) ───────────────────────────

function ThemeList({ themes, total, unit, other }: { themes: Theme[]; total: number; unit: string; other: number }) {
  const [open, setOpen] = useState<string | null>(null);
  if (themes.length === 0) {
    return <p className="text-sm text-muted-foreground">No recurring patterns yet — they show up after a few more reviews.</p>;
  }
  return (
    <div className="space-y-1">
      <ul className="divide-y divide-border">
        {themes.slice(0, 8).map((t) => {
          const isOpen = open === t.label;
          return (
            <li key={t.label} className="py-1">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : t.label)}
                aria-expanded={isOpen}
                className="grid w-full grid-cols-[minmax(0,1fr)_5rem_auto_auto] items-center gap-3 rounded-md py-2 text-left text-sm"
              >
                <span className="truncate text-foreground">{t.label}</span>
                <Meter value={total ? t.problems.length / total : 0} />
                <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">
                  {t.problems.length} {t.problems.length === 1 ? unit : `${unit}s`}
                </span>
                <ChevronDown className={cn('size-4 text-subtle transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <ul className="mb-2 space-y-2 rounded-md bg-surface-2 p-3">
                  {t.problems.slice(0, 6).map((p) => (
                    <li key={p._id} className="text-sm">
                      <Link to={`/problems/${p._id}?tab=analysis`} className="font-medium text-foreground hover:text-primary">{p.title}</Link>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{p.text}</p>
                    </li>
                  ))}
                  {t.problems.length > 6 && <li className="text-xs text-subtle">and {t.problems.length - 6} more</li>}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      {other > 0 && <p className="pt-1 text-xs text-subtle">{other} more comments didn't match a common pattern.</p>}
    </div>
  );
}

// ── Topic strengths (from submissions, not AI) ────────────────────────────────

function TopicStrengths({ topics }: { topics: AnalyticsSummary['topics'] }) {
  const eligible = topics.filter((t) => t.total >= 3);
  const rate = (t: (typeof topics)[number]) => t.solved / t.total;
  const strong = [...eligible].sort((a, b) => rate(b) - rate(a) || b.solved - a.solved).slice(0, 5);
  const weak = [...eligible].sort((a, b) => rate(a) - rate(b) || b.total - a.total).slice(0, 5);
  const Row = ({ t }: { t: (typeof topics)[number] }) => (
    <li className="grid grid-cols-[minmax(0,1fr)_4rem_3rem] items-center gap-3 text-sm">
      <span className="truncate text-foreground">{t.tag}</span>
      <Meter value={rate(t)} barClassName={rate(t) < 0.6 ? 'bg-warning' : 'bg-success'} />
      <span className="text-right text-xs tabular-nums text-muted-foreground">{Math.round(rate(t) * 100)}%</span>
    </li>
  );
  if (eligible.length === 0) return <p className="text-sm text-muted-foreground">Not enough topic data yet.</p>;
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div>
        <h3 className="mb-3 text-xs font-medium text-muted-foreground">Strongest</h3>
        <ul className="space-y-2.5">{strong.map((t) => <Row key={t.tag} t={t} />)}</ul>
      </div>
      <div>
        <h3 className="mb-3 text-xs font-medium text-muted-foreground">Needs work</h3>
        <ul className="space-y-2.5">{weak.map((t) => <Row key={t.tag} t={t} />)}</ul>
      </div>
    </div>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export default function AiInsightsTab({ data, topics, nextToReviewId }: {
  data: AiInsightsData;
  topics: AnalyticsSummary['topics'];
  /** A recent solved problem with code and no review, for the call to action. */
  nextToReviewId?: string | null;
}) {
  const [gapFilter, setGapFilter] = useState<'all' | 'time' | 'space'>('all');
  const { counts, timeToAccepted, analyzed } = data;

  const gaps = useMemo(() => complexityGaps(analyzed), [analyzed]);
  const feedback = useMemo(() => feedbackThemes(analyzed), [analyzed]);
  const edges = useMemo(() => edgeCaseThemes(analyzed), [analyzed]);
  const visibleGaps = gaps.filter((g) => gapFilter === 'all' || g.kind === gapFilter || g.kind === 'both');

  const reviewCta = nextToReviewId && (
    <Button size="sm" asChild>
      <Link to={`/problems/${nextToReviewId}?tab=analysis`}><Sparkles /> Review a recent solution</Link>
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Reviewed by AI" value={<>{counts.analyzed}<span className="text-base font-normal text-muted-foreground"> / {counts.solved}</span></>}>
          <Meter value={counts.solved ? counts.analyzed / counts.solved : 0} />
        </StatTile>
        <StatTile label="Ready to review" value={counts.readyToReview.toLocaleString()} sub="solved, with code saved" />
        <StatTile label="Out of date" value={counts.stale} sub={counts.stale ? 'code changed since review' : 'all reviews current'} />
        <StatTile
          label="Time to accepted"
          value={formatMinutes(timeToAccepted.medianMinutes)}
          sub={timeToAccepted.sampleSize ? `median over ${timeToAccepted.sampleSize} problems that took >1 try` : 'not enough data yet'}
        />
      </div>

      {counts.analyzed === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <Sparkles className="size-6 text-primary" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">No AI reviews yet</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Review a few solutions and this tab will show where your complexity falls short, the feedback
              that keeps coming up, and the edge cases you tend to miss.
            </p>
          </div>
          {reviewCta}
        </div>
      ) : (
        <>
          <Panel
            title="Where you can improve complexity"
            action={
              <div className="flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Show">
                {(['all', 'time', 'space'] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setGapFilter(k)} aria-pressed={gapFilter === k}
                    className={cn('rounded px-2 py-0.5 capitalize', gapFilter === k ? 'bg-surface-3 text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    {k}
                  </button>
                ))}
              </div>
            }
          >
            {visibleGaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {gaps.length === 0 ? 'Every reviewed solution is already optimal.' : 'Nothing in this category.'}
              </p>
            ) : (
              <ul className="-mx-2 divide-y divide-border">
                {visibleGaps.slice(0, 12).map(({ problem: p }) => (
                  <li key={p._id}>
                    <Link to={`/problems/${p._id}?tab=analysis`} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md px-2 py-2.5 hover:bg-surface-2">
                      <span className="min-w-0 flex-1 basis-48 truncate text-sm font-medium text-foreground">{p.title}</span>
                      {p.difficulty && <DifficultyBadge difficulty={p.difficulty} />}
                      <span className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-muted-foreground">{p.complexity.current}</span>
                        <ArrowRight className="size-3.5 text-subtle" aria-label="could be" />
                        <span className="text-success">{p.complexity.optimal}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Feedback that keeps coming up">
              <ThemeList themes={feedback.themes} total={analyzed.length} unit="problem" other={feedback.other} />
            </Panel>
            <Panel title="Edge cases you tend to miss">
              <ThemeList themes={edges.themes} total={analyzed.length} unit="problem" other={edges.other} />
            </Panel>
          </div>

          <Panel title="Recent reviews">
            <ul className="-mx-2 divide-y divide-border">
              {analyzed.slice(0, 6).map((p) => (
                <li key={p._id}>
                  <Link to={`/problems/${p._id}?tab=analysis`} className="flex items-center gap-3 rounded-md px-2 py-2.5 hover:bg-surface-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{p.title}</span>
                    {p.isStale && <span className="text-xs text-warning">out of date</span>}
                    <span className="text-xs text-muted-foreground">{relativeTime(p.generatedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}

      <Panel title="Topic strengths" action={<span className="text-xs text-muted-foreground">solve rate, topics with 3+ problems</span>}>
        <TopicStrengths topics={topics} />
      </Panel>
    </div>
  );
}
