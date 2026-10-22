import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Onboarding } from '@/types/pattern';

const HIDE_KEY = 'ci_onboarding_hidden';

const STEPS: { key: keyof Omit<Onboarding, 'done'>; title: string; detail: string; to: string }[] = [
  { key: 'leetcodeLinked', title: 'Add your LeetCode username', detail: 'So we know which account is yours.', to: '/profile?tab=connections' },
  { key: 'imported', title: 'Import what you’ve solved', detail: 'Your plan starts from where you are.', to: '/profile?tab=import' },
  { key: 'drilled', title: 'Try a 2-minute pattern drill', detail: 'Ten cards, no coding.', to: '/drill' },
  { key: 'extension', title: 'Connect the browser extension', detail: 'Guess the pattern right on LeetCode.', to: '/profile?tab=connections#extension' },
];

/** First-run checklist on Home; disappears once every step is done (or hidden). */
export default function GetStarted({ status }: { status: Onboarding }) {
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } });
  if (status.done || hidden) return null;
  const doneCount = STEPS.filter((s) => status[s.key]).length;
  const next = STEPS.find((s) => !status[s.key]);
  const hide = () => { setHidden(true); try { localStorage.setItem(HIDE_KEY, '1'); } catch { /* ignore */ } };

  return (
    <section aria-labelledby="start-title" className="rounded-xl border border-border bg-surface-1 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h2 id="start-title" className="text-sm font-semibold text-foreground">Get set up</h2>
          <p className="text-xs tabular-nums text-muted-foreground">{doneCount} of {STEPS.length}</p>
        </div>
        <button type="button" onClick={hide} aria-label="Hide getting started" className="rounded-md p-1 text-muted-foreground hover:bg-surface-2 hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((s, i) => {
          const done = status[s.key];
          const isNext = s === next;
          return (
            <li key={s.key} className={cn(!isNext && 'hidden sm:block')}>
              <Link
                to={s.to}
                aria-disabled={done}
                tabIndex={done ? -1 : undefined}
                className={cn(
                  'group flex h-full items-center gap-3 rounded-lg border p-3 transition-colors',
                  done ? 'pointer-events-none border-transparent bg-surface-2/60' : 'border-border bg-surface-2 hover:border-primary/50',
                  isNext && 'border-primary/50'
                )}
              >
                <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  done ? 'bg-success/15 text-success' : isNext ? 'bg-primary text-primary-foreground' : 'bg-surface-3 text-muted-foreground')}>
                  {done ? <Check className="size-3.5" aria-label="done" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm font-medium', done ? 'text-muted-foreground line-through' : 'text-foreground')}>{s.title}</span>
                  {!done && <span className="block text-xs text-muted-foreground">{s.detail}</span>}
                </span>
                {!done && <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />}
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
