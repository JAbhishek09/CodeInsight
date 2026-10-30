import type { RecognitionWeek } from '@/types/pattern';

/** Guesses pooled at each end before a change is worth showing. */
export const MIN_POOLED = 8;

/**
 * How much first-try recognition has moved: your earliest guesses vs your
 * latest ones, each pooled across weeks until there are MIN_POOLED of them.
 * One week with two lucky guesses no longer reads as "+50 pts".
 * Null when there aren't enough guesses for two separate groups.
 */
export function recognitionChange(weeks: RecognitionWeek[] | undefined) {
  const active = (weeks ?? []).filter((w) => w.firstTry.attempts > 0);
  const pool = (list: RecognitionWeek[]) => {
    let n = 0, ok = 0, used = 0;
    for (const w of list) {
      if (n >= MIN_POOLED) break;
      n += w.firstTry.attempts; ok += w.firstTry.correct; used += 1;
    }
    return { n, ok, used };
  };
  const early = pool(active);
  const late = pool([...active].reverse());
  if (early.n < MIN_POOLED || late.n < MIN_POOLED || early.used + late.used > active.length) return null;
  const from = early.ok / early.n;
  const to = late.ok / late.n;
  return { from, to, delta: Math.round((to - from) * 100) };
}
