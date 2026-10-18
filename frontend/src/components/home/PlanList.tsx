import { Link } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Clock, ExternalLink, EyeOff, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useCompleteReview } from '@/hooks/usePractice';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { difficultyStyle } from '@/lib/difficulty';
import { patternStyle } from '@/lib/patterns';
import type { PlanItem } from '@/types/pattern';

/** Rough solve time, for the day's estimate. */
export const MINUTES: Record<PlanItem['difficulty'], number> = { Easy: 15, Medium: 25, Hard: 40 };

const KIND: Record<PlanItem['kind'], { label: string; Icon: typeof RotateCcw; tone: string }> = {
  review: { label: 'Review', Icon: CalendarClock, tone: 'text-warning bg-warning/12 ring-warning/25' },
  retry: { label: 'Retry', Icon: RotateCcw, tone: 'text-danger bg-danger/12 ring-danger/25' },
  new: { label: 'New', Icon: Sparkles, tone: 'text-primary bg-primary/12 ring-primary/25' },
};

/** Reviews and retries hide the pattern: recognising it is the exercise. */
const hidesPattern = (it: PlanItem) => it.kind !== 'new';

function ReviewButtons({ id }: { id: string }) {
  const complete = useCompleteReview();
  const mark = (result: 'easy' | 'hard') =>
    complete.mutate({ id, result }, {
      onSuccess: () => toast.success(result === 'easy' ? 'Nice — pushed further out.' : 'Back in 2 days. You’ll get it.'),
      onError: (e) => toast.error(e.message),
    });
  return (
    <div className="flex items-center gap-1.5">
      <span className="hidden text-xs text-subtle sm:inline">After solving</span>
      <Button size="sm" variant="outline" onClick={() => mark('easy')} disabled={complete.isPending}>
        {complete.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 className="text-success" />} Got it
      </Button>
      <Button size="sm" variant="ghost" onClick={() => mark('hard')} disabled={complete.isPending}>Struggled</Button>
    </div>
  );
}

function PlanRow({ it, index, last }: { it: PlanItem; index: number; last: boolean }) {
  const k = KIND[it.kind];
  const d = difficultyStyle(it.difficulty);
  const next = index === 0;
  return (
    <li className="relative flex gap-4">
      {/* Step rail */}
      <div className="flex flex-col items-center">
        <span className={cn(
          'z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ring-1',
          next ? 'bg-primary text-primary-foreground ring-primary shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)]' : 'bg-surface-2 text-muted-foreground ring-border'
        )}>
          {index + 1}
        </span>
        {!last && <span className="w-px flex-1 bg-border" aria-hidden />}
      </div>

      <div className={cn(
        'mb-3 min-w-0 flex-1 rounded-xl border p-4 transition-colors sm:p-5',
        next ? 'border-primary/40 bg-surface-1 shadow-[0_1px_0_0_color-mix(in_oklab,var(--primary)_25%,transparent)_inset]' : 'border-border bg-surface-1 hover:border-border-strong'
      )}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
          <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ring-1 ring-inset', k.tone)}>
            <k.Icon className="size-3" aria-hidden /> {k.label}
          </span>
          <span className={cn('font-medium', d.text)}>{d.label}</span>
          <span className="inline-flex items-center gap-1 text-subtle"><Clock className="size-3" aria-hidden /> ~{MINUTES[it.difficulty]} min</span>
          {hidesPattern(it) ? (
            <span className="inline-flex items-center gap-1 text-subtle"><EyeOff className="size-3" aria-hidden /> Pattern hidden</span>
          ) : (
            <span style={patternStyle(it.pattern.key)} className="inline-flex items-center gap-1.5 font-medium pat-text">
              <span className="size-1.5 rounded-full" style={{ background: 'var(--pc)' }} aria-hidden /> {it.pattern.name}
            </span>
          )}
          {next && <span className="ml-auto rounded-full bg-primary/12 px-2 py-0.5 font-medium text-primary">Up next</span>}
        </div>

        <h3 className="mt-2.5 text-[17px] font-semibold leading-snug tracking-tight text-foreground">
          {it.problemId ? <Link to={`/problems/${it.problemId}`} className="hover:underline">{it.title}</Link> : it.title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{it.reason}</p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button size="sm" variant={next ? 'default' : 'outline'} asChild>
            <a href={it.url} target="_blank" rel="noopener noreferrer">Solve on LeetCode <ExternalLink /></a>
          </Button>
          {it.kind === 'review' && it.reviewId && <ReviewButtons id={it.reviewId} />}
        </div>
      </div>
    </li>
  );
}

export default function PlanList({ plan }: { plan: PlanItem[] }) {
  if (plan.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong p-8 text-center">
        <p className="text-sm font-medium text-foreground">You’ve covered every problem in the map.</p>
        <p className="mt-1 text-sm text-muted-foreground">Keep sharp with a drill — new patterns are on the way.</p>
      </div>
    );
  }
  return <ol>{plan.map((it, i) => <PlanRow key={it.slug} it={it} index={i} last={i === plan.length - 1} />)}</ol>;
}
