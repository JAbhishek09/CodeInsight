import { Link } from 'react-router-dom';
import { CheckCircle2, CircleHelp, Loader2, Network, XCircle } from 'lucide-react';
import { useGuessPattern, useLatestFeedback } from '@/hooks/usePredictions';
import { cn } from '@/lib/utils';
import ContrastTip from '@/components/ContrastTip';
import { patternStyle, PATTERN_OPTIONS } from '@/lib/patterns';
import type { PatternFeedback, ProblemPattern } from '@/types/pattern';

const OUTCOME: Record<PatternFeedback['outcome'], { Icon: typeof CheckCircle2; className: string }> = {
  recognised: { Icon: CheckCircle2, className: 'text-success' },
  'right-pattern-bug': { Icon: CheckCircle2, className: 'text-warning' },
  missed: { Icon: XCircle, className: 'text-danger' },
  'wrong-approach': { Icon: XCircle, className: 'text-danger' },
  unsure: { Icon: CircleHelp, className: 'text-primary' },
  unmapped: { Icon: CircleHelp, className: 'text-muted-foreground' },
};

/** Card shown after a guess resolves (in the app, or from the extension after submitting). */
export function FeedbackCard({ feedback }: { feedback: PatternFeedback }) {
  const o = OUTCOME[feedback.outcome] ?? OUTCOME.unsure;
  const p = feedback.pattern;
  return (
    <div role="status" style={p ? patternStyle(p.key) : undefined} className={cn('rounded-lg border px-4 py-3', p ? 'pat-border pat-tint' : 'border-border bg-surface-1')}>
      <div className="flex items-start gap-3">
        <o.Icon className={cn('mt-0.5 size-5 shrink-0', o.className)} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{feedback.title}</p>
          <p className="mt-0.5 text-sm text-foreground/80">{feedback.message}</p>
          {p && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              <Link to={`/patterns/${p.key}`} className="font-medium pat-text hover:underline">{p.name}</Link>
              {' '}· optimal {p.complexity}
              {feedback.verdict && <> · your submission: {feedback.verdict}</>}
              {feedback.source === 'extension' && <> · guessed in LeetCode</>}
            </p>
          )}
          {p && feedback.contrast && (
            <ContrastTip compact className="mt-2" actual={{ key: p.key, name: p.name }} other={feedback.contrast} tip={feedback.contrast.tip} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * "Which pattern is this?" on a problem page. Unsolved problems ask for a
 * guess first (it counts toward recognition accuracy); solved ones show the
 * pattern straight away. A guess made in the extension shows its feedback.
 */
export default function PatternGuess({ pattern, slug, solved }: { pattern: ProblemPattern; slug: string; solved: boolean }) {
  const latest = useLatestFeedback(slug);
  const guess = useGuessPattern(slug);

  if (latest.isPending) return <div className="h-12 animate-pulse rounded-lg bg-surface-1" aria-hidden />;

  if (latest.data) return <FeedbackCard feedback={latest.data} />;

  if (solved) {
    return (
      <div style={patternStyle(pattern.key)} className="flex flex-wrap items-start gap-3 rounded-lg border px-3 py-2.5 pat-border pat-tint">
        <Network className="mt-0.5 size-4 shrink-0 pat-text" aria-hidden />
        <div className="min-w-0 flex-1 text-sm">
          <Link to={`/patterns/${pattern.key}`} className="font-semibold pat-text hover:underline">{pattern.name}</Link>
          {pattern.secondary && <span className="text-muted-foreground"> + {pattern.secondary.name}</span>}
          <p className="mt-0.5 text-foreground/80">Clue: {pattern.cue} · optimal {pattern.complexity}</p>
        </div>
      </div>
    );
  }

  return (
    <section aria-label="Guess the pattern" className="rounded-lg border border-dashed border-border-strong p-3">
      <p className="text-sm font-medium text-foreground">Which pattern is this?</p>
      <p className="text-xs text-muted-foreground">Read the problem, decide, then check. Your guesses build your recognition score.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PATTERN_OPTIONS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => guess.mutate(p.key)}
            disabled={guess.isPending}
            style={patternStyle(p.key)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-1 px-2.5 py-1 text-xs text-foreground transition-colors hover:border-[color-mix(in_oklab,var(--pc)_55%,transparent)] hover:bg-[color-mix(in_oklab,var(--pc)_14%,transparent)] disabled:opacity-50"
          >
            <span className="size-2 rounded-full" style={{ background: 'var(--pc)' }} aria-hidden />
            {p.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => guess.mutate('unsure')}
          disabled={guess.isPending}
          className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Not sure
        </button>
        {guess.isPending && <Loader2 className="size-4 animate-spin self-center text-muted-foreground" aria-label="Checking" />}
      </div>
      {guess.error && <p role="alert" className="mt-2 text-xs text-danger">{guess.error.message}</p>}
    </section>
  );
}
