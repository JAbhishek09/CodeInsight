import { Link } from 'react-router-dom';
import {
  ArrowRight, CalendarClock, CheckCircle2, ExternalLink, EyeOff, Loader2, RotateCcw, Sparkles, Target,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../hooks/useAuth';
import { useCompleteReview, useToday } from '../hooks/usePractice';
import QueryError from '../components/QueryError';
import DifficultyBadge from '../components/DifficultyBadge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { patternStyle } from '@/lib/patterns';
import type { PlanItem, TodayPlan } from '@/types/pattern';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)}%`);

const KIND: Record<PlanItem['kind'], { label: string; Icon: typeof RotateCcw; className: string }> = {
  review: { label: 'Review', Icon: CalendarClock, className: 'bg-warning/15 text-warning' },
  retry: { label: 'Retry', Icon: RotateCcw, className: 'bg-danger/15 text-danger' },
  new: { label: 'New', Icon: Sparkles, className: 'bg-primary/15 text-primary' },
};

/** Reviews and retries hide the pattern: recognising it is the exercise. */
const hidesPattern = (it: PlanItem) => it.kind !== 'new';

function PlanCard({ it, index }: { it: PlanItem; index: number }) {
  const k = KIND[it.kind];
  const complete = useCompleteReview();
  const markReview = (result: 'easy' | 'hard') =>
    complete.mutate({ id: it.reviewId!, result }, {
      onSuccess: () => toast.success(result === 'easy' ? 'Nice — pushed further out.' : 'Back in 2 days. You’ll get it.'),
      onError: (e) => toast.error(e.message),
    });

  return (
    <li className="flex gap-4 rounded-xl border border-border bg-surface-1 p-4 transition-colors hover:border-border-strong">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold tabular-nums text-muted-foreground" aria-hidden>
        {index + 1}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium', k.className)}>
            <k.Icon className="size-3" aria-hidden /> {k.label}
          </span>
          <DifficultyBadge difficulty={it.difficulty} />
          {hidesPattern(it) ? (
            <span className="inline-flex items-center gap-1 text-subtle"><EyeOff className="size-3" /> pattern hidden — guess first</span>
          ) : (
            <span style={patternStyle(it.pattern.key)} className="inline-flex items-center gap-1.5 pat-text">
              <span className="size-2 rounded-full" style={{ background: 'var(--pc)' }} aria-hidden /> {it.pattern.name}
            </span>
          )}
        </div>
        <p className="text-base font-semibold leading-snug text-foreground">
          {it.problemId ? <Link to={`/problems/${it.problemId}`} className="hover:underline">{it.title}</Link> : it.title}
        </p>
        <p className="text-sm text-muted-foreground">{it.reason}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant={it.kind === 'review' ? 'outline' : 'default'} asChild>
            <a href={it.url} target="_blank" rel="noopener noreferrer">Solve on LeetCode <ExternalLink /></a>
          </Button>
          {it.kind === 'review' && it.reviewId && (
            <>
              <span className="ml-1 text-xs text-muted-foreground">After solving:</span>
              <Button size="sm" variant="outline" onClick={() => markReview('easy')} disabled={complete.isPending}>
                {complete.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="text-success" />} Got it
              </Button>
              <Button size="sm" variant="ghost" onClick={() => markReview('hard')} disabled={complete.isPending}>Struggled</Button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function FocusCard({ focus }: { focus: NonNullable<TodayPlan['focus']> }) {
  const ratio = focus.total ? focus.solved / focus.total : 0;
  return (
    <Link
      to={`/patterns/${focus.key}`}
      style={patternStyle(focus.key)}
      className="group relative block overflow-hidden rounded-2xl border p-5 pat-border pat-tint transition-[filter] hover:brightness-110"
    >
      <span className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full opacity-30 blur-3xl" style={{ background: 'var(--pc)' }} aria-hidden />
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide pat-text"><Target className="size-3.5" /> Focus pattern</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{focus.name}</p>
      <p className="mt-1 max-w-md text-sm text-foreground/75">{focus.short}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-background/60">
            <div className="h-full rounded-full" style={{ width: `${Math.round(ratio * 100)}%`, background: 'var(--pc)' }} />
          </div>
          <span className="tabular-nums text-foreground">{focus.solved}/{focus.total} solved</span>
        </div>
        {focus.recognition && <span className="tabular-nums text-foreground">{pct(focus.recognition.accuracy)} spotted</span>}
        <span className="ml-auto inline-flex items-center gap-1 font-medium text-foreground">Open guide <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
      </div>
    </Link>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your plan">
      <Skeleton className="h-36 rounded-2xl" />
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const q = useToday();
  const d = q.data;
  const startedAny = d?.patterns.some((p) => p.solved > 0) ?? false;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{greeting()}, {(user?.name || 'there').split(' ')[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Here’s today’s practice. Guess the pattern before you code.</p>
        </div>
        {d && (
          <dl className="flex gap-6 sm:text-right">
            <div>
              <dt className="text-xs text-muted-foreground">Recognition</dt>
              <dd className="text-xl font-semibold tabular-nums text-foreground">{pct(d.recognition.accuracy)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Reviews due</dt>
              <dd className="text-xl font-semibold tabular-nums text-foreground">{d.reviews.due}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Done today</dt>
              <dd className="text-xl font-semibold tabular-nums text-foreground">{d.doneToday.length}</dd>
            </div>
          </dl>
        )}
      </div>

      {q.error && <QueryError title="Couldn't load today's plan" message={q.error.message} onRetry={() => q.refetch()} />}

      {!d && !q.error ? <HomeSkeleton /> : d && (
        <>
          {!startedAny && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-border-strong p-4">
              <p className="text-sm text-muted-foreground">Import your LeetCode history so the plan knows what you’ve already solved.</p>
              <Button size="sm" variant="outline" asChild><Link to="/profile?tab=import">Import history</Link></Button>
            </div>
          )}

          {d.focus && <FocusCard focus={d.focus} />}

          <section aria-labelledby="plan-title" className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 id="plan-title" className="text-lg font-semibold text-foreground">Today’s plan</h2>
              {d.reviews.upcomingThisWeek > 0 && (
                <span className="text-xs text-muted-foreground">{d.reviews.upcomingThisWeek} more reviews this week</span>
              )}
            </div>
            {d.plan.length === 0 ? (
              <p className="rounded-xl border border-border bg-surface-1 p-6 text-center text-sm text-muted-foreground">
                Nothing left in the map for now — you’ve covered every key problem. New patterns are coming.
              </p>
            ) : (
              <ol className="space-y-3">{d.plan.map((it, i) => <PlanCard key={it.slug} it={it} index={i} />)}</ol>
            )}
          </section>

          {d.doneToday.length > 0 && (
            <section aria-labelledby="done-title" className="space-y-2">
              <h2 id="done-title" className="text-sm font-semibold text-foreground">Done today</h2>
              <ul className="flex flex-wrap gap-2">
                {d.doneToday.map((x) => (
                  <li key={x.slug}>
                    <Link to={`/problems/${x.problemId}`} style={x.pattern ? patternStyle(x.pattern) : undefined}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-3 py-1 text-sm text-foreground hover:border-border-strong">
                      <CheckCircle2 className="size-4 text-success" /> {x.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="patterns-title" className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 id="patterns-title" className="text-sm font-semibold text-foreground">Your patterns</h2>
              <Link to="/patterns" className="text-xs text-muted-foreground hover:text-foreground">Pattern map →</Link>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {d.patterns.map((p) => {
                const r = p.total ? p.solved / p.total : 0;
                return (
                  <li key={p.key}>
                    <Link to={`/patterns/${p.key}`} style={patternStyle(p.key)}
                      className={cn('block rounded-lg border border-border bg-surface-1 p-3 transition-colors hover:border-[color-mix(in_oklab,var(--pc)_55%,transparent)]', p.key === d.focus?.key && 'pat-border')}>
                      <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full rounded-full" style={{ width: `${Math.round(r * 100)}%`, background: 'var(--pc)' }} />
                      </div>
                      <p className="mt-1.5 text-xs tabular-nums text-muted-foreground">
                        {p.solved}/{p.total}{p.accuracy != null && <> · {pct(p.accuracy)} spotted</>}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
