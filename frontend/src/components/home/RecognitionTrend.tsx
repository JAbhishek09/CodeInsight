import { useWeeklyRecognition } from '@/hooks/usePredictions';
import { cn } from '@/lib/utils';
import type { RecognitionWeek } from '@/types/pattern';

const MIN = 3; // fewer first-try guesses than this is too noisy to compare

const label = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function change(weeks: RecognitionWeek[]) {
  const ok = weeks.filter((w) => w.firstTry.attempts >= MIN);
  if (ok.length < 2) return null;
  return Math.round(((ok[ok.length - 1].firstTry.accuracy ?? 0) - (ok[0].firstTry.accuracy ?? 0)) * 100);
}

/**
 * First-try recognition accuracy per week — the number the pilot tracks.
 * Hidden until the student has made a guess.
 */
export default function RecognitionTrend() {
  const q = useWeeklyRecognition(8);
  const weeks = q.data;
  if (!weeks || weeks.every((w) => w.attempts === 0)) return null;
  const delta = change(weeks);

  return (
    <section aria-labelledby="trend-title" className="space-y-3 rounded-xl border border-border bg-surface-1 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="trend-title" className="text-sm font-semibold text-foreground">Recognition by week</h2>
          <p className="text-xs text-muted-foreground">Your first guess on each problem — how often it was right</p>
        </div>
        {delta !== null && (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
            delta > 0 ? 'bg-success/15 text-success' : delta < 0 ? 'bg-danger/15 text-danger' : 'bg-surface-3 text-muted-foreground')}>
            {delta > 0 ? '+' : ''}{delta} pts since you started
          </span>
        )}
      </div>
      <ol className="flex h-32 items-end gap-1.5 sm:gap-2" aria-label="Accuracy per week">
        {weeks.map((w) => {
          const acc = w.firstTry.accuracy;
          const thin = w.firstTry.attempts < MIN;
          const text = acc == null
            ? `Week of ${label(w.weekStart)}: no new guesses`
            : `Week of ${label(w.weekStart)}: ${Math.round(acc * 100)}% of ${w.firstTry.attempts} first guesses`;
          return (
            <li key={w.weekStart} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={text} aria-label={text}>
              {acc != null && <span className="text-[10px] tabular-nums text-muted-foreground">{Math.round(acc * 100)}</span>}
              <span
                className={cn('w-full rounded-t-sm transition-[height] duration-500', acc == null ? 'bg-surface-3' : thin ? 'bg-primary/40' : 'bg-primary')}
                style={{ height: acc == null ? 3 : `${Math.max(4, acc * 100)}%` }}
              />
              <span className="w-full truncate text-center text-[10px] text-subtle">{label(w.weekStart)}</span>
            </li>
          );
        })}
      </ol>
      <p className="text-[11px] text-subtle">Faded bars: fewer than {MIN} new guesses that week.</p>
    </section>
  );
}
