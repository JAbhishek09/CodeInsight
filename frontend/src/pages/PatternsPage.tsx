import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { usePatterns } from '../hooks/usePatterns';
import { usePredictionStats } from '../hooks/usePredictions';
import QueryError from '../components/QueryError';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { masteryOf, patternStyle } from '@/lib/patterns';
import type { PatternSummary } from '@/types/pattern';

const LEVEL_LABEL: Record<number, string> = { 1: 'Foundations', 2: 'Core', 3: 'Advanced' };

/** The pattern to work on next: an unfinished one whose prerequisites are started. */
function pickFocus(patterns: PatternSummary[]): PatternSummary | null {
  const byKey = new Map(patterns.map((p) => [p.key, p]));
  const ready = (p: PatternSummary) => p.requires.every((r) => {
    const q = byKey.get(r);
    return q && masteryOf(q.solved, q.attempted, q.total) !== 'new';
  });
  const open = patterns.filter((p) => masteryOf(p.solved, p.attempted, p.total) !== 'mastered' && ready(p));
  if (open.length === 0) return null;
  return [...open].sort((a, b) => a.level - b.level || a.solved / a.total - b.solved / b.total)[0];
}

/** Circular progress node for one pattern. */
function PatternNode({ p, focus, recognition }: { p: PatternSummary; focus: boolean; recognition?: { attempts: number; accuracy: number | null } }) {
  const state = masteryOf(p.solved, p.attempted, p.total);
  const pct = p.total ? p.solved / p.total : 0;
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <Link
      to={`/patterns/${p.key}`}
      style={patternStyle(p.key)}
      className="group flex w-28 flex-col items-center gap-2 rounded-xl p-2 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-32"
      aria-label={`${p.name}: ${p.solved} of ${p.total} solved${focus ? ', current focus' : ''}`}
    >
      <span
        className={cn(
          'relative flex size-20 items-center justify-center rounded-full bg-surface-1 transition-transform duration-200 group-hover:scale-105',
          state === 'mastered' && 'pat-glow',
          focus && 'pat-pulse',
          state === 'new' && 'opacity-60'
        )}
      >
        <svg viewBox="0 0 80 80" className="absolute inset-0 size-20 -rotate-90" aria-hidden>
          <circle cx="40" cy="40" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
          <circle
            cx="40" cy="40" r={R} fill="none" stroke="var(--pc)" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <span className="relative text-sm font-semibold tabular-nums pat-text">
          {state === 'mastered' ? <Check className="size-6" /> : `${Math.round(pct * 100)}%`}
        </span>
      </span>
      <span className="text-sm font-medium leading-tight text-foreground">{p.name}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{p.solved}/{p.total} solved</span>
      {recognition && recognition.attempts > 0 && recognition.accuracy !== null && (
        <span className="text-[11px] tabular-nums pat-text">{Math.round(recognition.accuracy * 100)}% spotted</span>
      )}
    </Link>
  );
}

function TreeSkeleton() {
  return (
    <div className="space-y-10" aria-busy="true" aria-label="Loading patterns">
      {[2, 3, 3].map((n, i) => (
        <div key={i} className="flex justify-center gap-6">
          {Array.from({ length: n }).map((_, j) => <Skeleton key={j} className="size-20 rounded-full" />)}
        </div>
      ))}
    </div>
  );
}

export default function PatternsPage() {
  const q = usePatterns();
  const stats = usePredictionStats().data;
  const data = q.data;
  const accuracyOf = (key: string) => stats?.perPattern.find((p) => p.key === key);
  const focus = data ? pickFocus(data.patterns) : null;
  const mastered = data?.patterns.filter((p) => masteryOf(p.solved, p.attempted, p.total) === 'mastered').length ?? 0;
  const levels = data ? [...new Set(data.patterns.map((p) => p.level))].sort() : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Patterns</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Interviews test whether you can spot the approach. Learn each pattern’s clues, then practise
            recognising it on real problems.
          </p>
        </div>
        {data && (
          <dl className="flex gap-6 text-right">
            <div>
              <dt className="text-xs text-muted-foreground">Recognition</dt>
              <dd className="text-xl font-semibold tabular-nums text-foreground">
                {stats?.accuracy != null ? `${Math.round(stats.accuracy * 100)}%` : '—'}
                {stats && stats.attempts > 0 && <span className="text-sm font-normal text-muted-foreground"> of {stats.attempts}</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Mastered</dt>
              <dd className="text-xl font-semibold tabular-nums text-foreground">{mastered}<span className="text-sm font-normal text-muted-foreground"> / {data.patterns.length}</span></dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Key problems solved</dt>
              <dd className="text-xl font-semibold tabular-nums text-foreground">{data.totals.solved}<span className="text-sm font-normal text-muted-foreground"> / {data.totals.problems}</span></dd>
            </div>
          </dl>
        )}
      </div>

      {q.error && <QueryError title="Couldn't load patterns" message={q.error.message} onRetry={() => q.refetch()} />}

      {focus && (
        <Link
          to={`/patterns/${focus.key}`}
          style={patternStyle(focus.key)}
          className="flex flex-wrap items-center gap-4 rounded-xl border p-4 transition-colors pat-border pat-tint hover:brightness-110"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-background pat-text">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium uppercase tracking-wide pat-text">Focus now</span>
            <span className="block text-base font-semibold text-foreground">{focus.name}</span>
            <span className="block text-sm text-muted-foreground">{focus.short}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
            Practise <ArrowRight className="size-4" />
          </span>
        </Link>
      )}

      <section aria-label="Pattern map" className="rounded-xl border border-border bg-surface-1 px-4 py-8 sm:px-8">
        {!data ? <TreeSkeleton /> : (
          <div className="flex flex-col items-center">
            {levels.map((lvl, i) => (
              <Fragment key={lvl}>
                {i > 0 && <span className="my-2 h-8 w-px bg-gradient-to-b from-border-strong to-transparent" aria-hidden />}
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-subtle">{LEVEL_LABEL[lvl] ?? `Level ${lvl}`}</p>
                <div className="flex flex-wrap justify-center gap-x-4 gap-y-6 sm:gap-x-10">
                  {data.patterns.filter((p) => p.level === lvl).map((p) => (
                    <PatternNode key={p.key} p={p} focus={focus?.key === p.key} recognition={accuracyOf(p.key)} />
                  ))}
                </div>
              </Fragment>
            ))}
          </div>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Check className="size-3.5 text-success" /> Mastered — 70%+ solved</span>
          <span>Ring = share of key problems solved</span>
          <span>Pulsing = focus now</span>
        </div>
      </section>

      {stats && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-surface-1 p-4">
            <h2 className="text-sm font-semibold text-foreground">Patterns you mix up</h2>
            {stats.confusions.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {stats.attempts === 0 ? 'Guess the pattern on a few problems to see this.' : 'No mix-ups yet — nice.'}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {stats.confusions.map((c) => (
                  <li key={c.actual + c.predicted} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <Link to={`/patterns/${c.actual}`} style={patternStyle(c.actual)} className="font-medium pat-text hover:underline">{c.actualName}</Link>
                      <span className="text-muted-foreground"> guessed as </span>
                      <span className="text-foreground">{c.predictedName}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{c.count}×</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-border bg-surface-1 p-4">
            <h2 className="text-sm font-semibold text-foreground">How recognition works</h2>
            <ol className="mt-2 list-inside list-decimal space-y-1.5 text-sm text-muted-foreground">
              <li>Open a problem — on LeetCode with the extension, or here.</li>
              <li>Pick the pattern <em>before</em> you code.</li>
              <li>Submit (or check here) to see if you spotted it, and the clue you needed.</li>
            </ol>
          </div>
        </section>
      )}

      {data && data.totals.solved === 0 && (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">Import your LeetCode history to see which patterns you already know.</p>
          <Button variant="outline" size="sm" asChild><Link to="/profile?tab=import">Import history</Link></Button>
        </div>
      )}
    </div>
  );
}
