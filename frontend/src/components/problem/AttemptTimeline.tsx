import { useEffect, useMemo, useRef } from 'react';
import { AlertTriangle, Check, CircleDashed, Timer, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { relativeTime, shortDate } from '@/lib/format';
import { buildTimeline, laterLabel, type AttemptKind } from '@/lib/attempts';
import type { Submission } from '@/types/problem';

/** Verdicts are states: status colour + icon + a text label, never colour alone. */
const KIND: Record<AttemptKind, { Icon: typeof Check; dot: string; text: string }> = {
  ok: { Icon: Check, dot: 'border-success bg-success/15 text-success', text: 'text-success' },
  wrong: { Icon: X, dot: 'border-danger/70 bg-danger/10 text-danger', text: 'text-danger' },
  slow: { Icon: Timer, dot: 'border-warning/70 bg-warning/10 text-warning', text: 'text-warning' },
  crash: { Icon: AlertTriangle, dot: 'border-danger/60 bg-danger/10 text-danger', text: 'text-danger' },
  pending: { Icon: CircleDashed, dot: 'border-border bg-surface-2 text-muted-foreground', text: 'text-muted-foreground' },
};

const SHORT: Record<string, string> = {
  Accepted: 'AC', 'Wrong Answer': 'WA', TLE: 'TLE', MLE: 'MLE', RE: 'RE', CE: 'CE', Pending: '…',
};

/**
 * Every try at a problem in time order: what each verdict was, how long
 * between tries, where it was first accepted, and gaps between sittings.
 * Clicking a try shows its code (onSelect).
 */
export default function AttemptTimeline({ submissions, selectedId, onSelect }: {
  submissions: Submission[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const tl = useMemo(() => buildTimeline(submissions), [submissions]);
  const scroller = useRef<HTMLDivElement>(null);
  const accepted = tl.attempts.filter((a) => a.kind === 'ok').length;
  const last = tl.attempts[tl.attempts.length - 1];
  const firstAc = tl.firstAcceptedIndex >= 0 ? tl.attempts[tl.firstAcceptedIndex] : null;

  // Long histories scroll sideways: keep the selected try in view
  useEffect(() => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (box && el && box.scrollWidth > box.clientWidth) {
      box.scrollLeft = el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2;
    }
  }, [selectedId]);

  return (
    <section aria-labelledby="attempts-title" className="rounded-xl border border-border bg-surface-1 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-0 max-w-2xl">
          <h2 id="attempts-title" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your attempts</h2>
          <p className="mt-1 text-base font-semibold text-foreground">{tl.summary}</p>
          {tl.detail && <p className="mt-0.5 text-sm text-muted-foreground">{tl.detail}</p>}
        </div>
        {tl.attempts.length > 0 && (
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Acceptance</dt>
              <dd className="font-semibold text-foreground" title={`${accepted} accepted of ${tl.attempts.length}`}>
                {Math.round((accepted / tl.attempts.length) * 100)}%
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">First solved</dt>
              <dd className="font-semibold text-foreground">{firstAc ? shortDate(firstAc.at) : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last try</dt>
              <dd className="font-semibold text-foreground">{relativeTime(last.at)}</dd>
            </div>
          </dl>
        )}
      </div>

      {tl.attempts.length > 0 && (
        <div ref={scroller} className="-mx-4 mt-4 overflow-x-auto px-4 sm:-mx-5 sm:px-5">
          <ol className="flex w-max items-start pb-1" aria-label="Attempts, oldest first">
            {tl.attempts.map((a, i) => {
              const k = KIND[a.kind];
              const selected = a.id === selectedId;
              return (
                <li key={a.id} className="flex items-start">
                  {i > 0 && (a.breakMs !== null ? (
                    <span className="mx-1 mt-[34px] flex items-center gap-1.5 text-[10px] whitespace-nowrap text-subtle" aria-hidden>
                      <span className="h-px w-3 bg-border" />{laterLabel(a.breakMs)}<span className="h-px w-3 bg-border" />
                    </span>
                  ) : (
                    <span className="mt-[41px] h-0.5 w-4 shrink-0 bg-border sm:w-7" aria-hidden />
                  ))}
                  <button
                    type="button"
                    onClick={() => onSelect(a.id)}
                    aria-pressed={selected}
                    aria-label={`Try ${a.n}: ${a.verdict}, ${new Date(a.at).toLocaleString()}${a.firstAccepted ? ', first accepted' : ''}${a.hasCode ? '' : ', no code saved'}`}
                    className="group flex w-12 flex-col items-center gap-1 rounded-lg py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className={cn('h-4 text-[10px] font-semibold leading-4', a.firstAccepted ? 'text-success' : 'text-transparent')} aria-hidden>
                      {a.firstAccepted ? 'solved' : '·'}
                    </span>
                    <span className={cn(
                      'flex size-9 items-center justify-center rounded-full border-2 transition-transform group-hover:scale-110',
                      k.dot,
                      a.firstAccepted && 'shadow-[0_0_14px_color-mix(in_oklab,var(--success)_45%,transparent)]',
                      selected && 'ring-2 ring-foreground ring-offset-2 ring-offset-surface-1',
                    )}>
                      <k.Icon className="size-4" strokeWidth={2.5} aria-hidden />
                    </span>
                    <span className={cn('text-[11px] font-semibold', k.text)} aria-hidden>{SHORT[a.verdict] ?? a.verdict}</span>
                    <span className="text-[10px] tabular-nums text-subtle" aria-hidden>{a.gap ?? shortDate(a.at)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      {tl.attempts.length > 1 && <p className="mt-2 text-xs text-subtle">Select a try to see its code.</p>}
    </section>
  );
}
