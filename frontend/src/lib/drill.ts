/**
 * drill.ts — scoring and the hint for guess-the-pattern drills.
 * A right answer after the hint is worth half (same as the server's
 * HINT_CREDIT in predictionService.js).
 *
 * No imports: drill.test.ts runs this file directly under Node.
 */

export type DrillResult = 'right' | 'hinted' | 'wrong' | 'unsure';

export const HINT_CREDIT = 0.5;

export function drillResult(a: { predicted: string; hinted: boolean; isCorrect?: boolean | null }): DrillResult {
  if (a.predicted === 'unsure') return 'unsure';
  if (a.isCorrect) return a.hinted ? 'hinted' : 'right';
  return 'wrong';
}

export function deckScore(results: DrillResult[]): number {
  return results.reduce((n, r) => n + (r === 'right' ? 1 : r === 'hinted' ? HINT_CREDIT : 0), 0);
}

/** 6.5 → "6½", 0.5 → "½", 7 → "7". */
export function formatScore(n: number): string {
  const whole = Math.floor(n);
  if (n - whole < 0.5) return String(whole);
  return whole ? `${whole}½` : '½';
}

export interface Segment { text: string; clue: boolean }

/**
 * Split a prompt into plain text and clue words (the first place each clue
 * appears; overlapping clues merge). Clues not found are skipped.
 */
export function markClues(prompt: string, clues: string[]): Segment[] {
  const ranges = clues
    .map((c) => [prompt.indexOf(c), prompt.indexOf(c) + c.length] as const)
    .filter(([start]) => start >= 0)
    .sort((a, b) => a[0] - b[0]);

  const merged: [number, number][] = [];
  for (const [start, end] of ranges) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }

  const out: Segment[] = [];
  let at = 0;
  for (const [start, end] of merged) {
    if (start > at) out.push({ text: prompt.slice(at, start), clue: false });
    out.push({ text: prompt.slice(start, end), clue: true });
    at = end;
  }
  if (at < prompt.length) out.push({ text: prompt.slice(at), clue: false });
  return out;
}
