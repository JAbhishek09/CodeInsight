/**
 * attempts.ts — a problem's submissions as a story: each try in order, how
 * long between tries, where it was first accepted, and a one-line summary.
 * Used by the attempt timeline on the problem page.
 *
 * No imports: attempts.test.ts runs this file directly under Node.
 */

export type AttemptKind = 'ok' | 'wrong' | 'slow' | 'crash' | 'pending';

export interface AttemptInput {
  _id: string;
  submittedAt: string;
  verdict: string;
  code?: string;
}

export interface Attempt {
  id: string;
  /** Try number, 1-based, in time order. */
  n: number;
  verdict: string;
  kind: AttemptKind;
  at: number;
  /** "+4m" since the previous try in the same sitting; null at the start of one. */
  gap: string | null;
  /** Time since the previous try when it starts a new sitting (> 2 hours later). */
  breakMs: number | null;
  hasCode: boolean;
  firstAccepted: boolean;
}

export interface Timeline {
  attempts: Attempt[];
  firstAcceptedIndex: number;
  summary: string;
  detail: string | null;
}

/** Tries further apart than this start a new sitting on the timeline. */
export const SITTING_GAP_MS = 2 * 60 * 60 * 1000;

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function verdictKind(verdict: string): AttemptKind {
  if (verdict === 'Accepted') return 'ok';
  if (verdict === 'Wrong Answer') return 'wrong';
  if (verdict === 'TLE' || verdict === 'MLE') return 'slow';
  if (verdict === 'RE' || verdict === 'CE') return 'crash';
  return 'pending';
}

/** Short gap between tries: +45s, +4m, +2h, +3d. */
export function shortGap(ms: number): string {
  if (ms < MIN) return `+${Math.max(1, Math.round(ms / SEC))}s`;
  if (ms < HOUR) return `+${Math.round(ms / MIN)}m`;
  if (ms < 2 * DAY) return `+${Math.round(ms / HOUR)}h`;
  return `+${Math.round(ms / DAY)}d`;
}

/** A readable duration: 40 sec, 38 min, 2 h 5 min, 3 days. */
export function duration(ms: number): string {
  if (ms < MIN) return `${Math.max(1, Math.round(ms / SEC))} sec`;
  if (ms < HOUR) return `${Math.round(ms / MIN)} min`;
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR);
    const m = Math.round((ms - h * HOUR) / MIN);
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const d = Math.round(ms / DAY);
  return `${d} day${d === 1 ? '' : 's'}`;
}

/** How much later a new sitting started: 3 hours later, 2 days later, 3 weeks later… */
export function laterLabel(ms: number): string {
  const unit = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'} later`;
  if (ms < DAY) return unit(Math.max(1, Math.round(ms / HOUR)), 'hour');
  if (ms < 14 * DAY) return unit(Math.round(ms / DAY), 'day');
  if (ms < 60 * DAY) return unit(Math.round(ms / (7 * DAY)), 'week');
  if (ms < 365 * DAY) return unit(Math.round(ms / (30 * DAY)), 'month');
  return unit(Math.round(ms / (365 * DAY)), 'year');
}

const FAILURE_WORDS: Record<Exclude<AttemptKind, 'ok' | 'pending'>, [string, string]> = {
  wrong: ['wrong answer', 'wrong answers'],
  slow: ['time or memory limit', 'time or memory limits'],
  crash: ['runtime or compile error', 'runtime or compile errors'],
};

/** "2 wrong answers and 1 time or memory limit" (null if no failures). */
function failureList(attempts: Attempt[]): string | null {
  const parts = (['wrong', 'slow', 'crash'] as const)
    .map((k) => [k, attempts.filter((a) => a.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${FAILURE_WORDS[k][n === 1 ? 0 : 1]}`);
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

const times = (n: number) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);

export function buildTimeline(subs: AttemptInput[]): Timeline {
  const sorted = [...subs].sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());
  const firstAcceptedIndex = sorted.findIndex((s) => s.verdict === 'Accepted');

  const attempts: Attempt[] = sorted.map((s, i) => {
    const at = new Date(s.submittedAt).getTime();
    const prev = i > 0 ? new Date(sorted[i - 1].submittedAt).getTime() : null;
    const since = prev === null ? null : at - prev;
    const newSitting = since === null || since > SITTING_GAP_MS;
    return {
      id: s._id,
      n: i + 1,
      verdict: s.verdict,
      kind: verdictKind(s.verdict),
      at,
      gap: newSitting ? null : shortGap(since as number),
      breakMs: since !== null && since > SITTING_GAP_MS ? since : null,
      hasCode: !!s.code?.trim(),
      firstAccepted: i === firstAcceptedIndex,
    };
  });

  if (!attempts.length) return { attempts, firstAcceptedIndex: -1, summary: 'No attempts recorded yet.', detail: null };

  if (firstAcceptedIndex === -1) {
    return {
      attempts,
      firstAcceptedIndex,
      summary: `Not accepted yet — ${attempts.length} ${attempts.length === 1 ? 'try' : 'tries'} so far.`,
      detail: failureList(attempts),
    };
  }

  const first = attempts[firstAcceptedIndex];
  const before = attempts.slice(0, firstAcceptedIndex);
  const after = attempts.slice(firstAcceptedIndex + 1);
  const summary = firstAcceptedIndex === 0
    ? 'Accepted on the first try.'
    : `Accepted on try ${first.n}, ${duration(first.at - attempts[0].at)} after your first try.`;

  const notes: string[] = [];
  const failed = failureList(before);
  if (failed) notes.push(`Before that: ${failed}.`);
  const resolves = after.filter((a) => a.kind === 'ok').length;
  if (resolves) notes.push(`Re-solved ${times(resolves)} since.`);
  else if (after.length) notes.push(`${after.length} more ${after.length === 1 ? 'try' : 'tries'} since, none accepted.`);

  return { attempts, firstAcceptedIndex, summary, detail: notes.length ? notes.join(' ') : null };
}
