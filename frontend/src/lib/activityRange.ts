/**
 * activityRange.ts — fits Analytics' time charts to the student's own history:
 * they start at the first active day instead of always covering a year, and
 * go day by day for a new student, week by week for the first months, and
 * month by month after that.
 *
 * No imports: activityRange.test.ts runs this file directly under Node.
 */

export type Grain = 'day' | 'week' | 'month';

export interface ActivityRange {
  grain: Grain;
  /** First day shown (YYYY-MM-DD); the range always ends today. */
  from: string;
  to: string;
  /** Weeks for the activity heatmap: back to the first active week, 13 to 53. */
  heatmapWeeks: number;
}

export interface Bucket { key: string; start: string; end: string }

/** Day by day for up to this many days of history, then week by week up to 26 weeks. */
export const DAILY_UP_TO = 31;
export const WEEKLY_UP_TO = 26 * 7;

const DAY_MS = 86_400_000;
const toMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const addDays = (day: string, n: number) => fromMs(toMs(day) + n * DAY_MS);
const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY_MS);
/** Monday of the week containing `day`. */
export const weekStart = (day: string) => addDays(day, -((new Date(toMs(day)).getUTCDay() + 6) % 7));
/** 'YYYY-MM' n months after `month`. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
const lastDayOf = (month: string) => addDays(`${addMonths(month, 1)}-01`, -1);

/** First day with any activity across day series (each sorted oldest first). */
export function firstActiveDay(...series: { date: string; count: number }[][]): string | null {
  let first: string | null = null;
  for (const days of series) {
    const d = days.find((x) => x.count > 0);
    if (d && (!first || d.date < first)) first = d.date;
  }
  return first;
}

/** The chart range for a history starting on `first` (null: nothing in the last year). */
export function fitRange(first: string | null, today: string): ActivityRange | null {
  if (!first) return null;
  const span = daysBetween(first, today) + 1;
  const heatmapWeeks = Math.min(53, Math.max(13, Math.ceil((daysBetween(weekStart(first), today) + 1) / 7)));

  // At least two weeks of days, six weeks of weeks
  if (span <= DAILY_UP_TO) return { grain: 'day', from: addDays(today, -(Math.max(span, 14) - 1)), to: today, heatmapWeeks };
  if (span <= WEEKLY_UP_TO) {
    const from = [weekStart(first), addDays(weekStart(today), -7 * 5)].sort()[0];
    return { grain: 'week', from, to: today, heatmapWeeks };
  }
  // Months: from the first active one, at most twelve
  const earliest = `${addMonths(today.slice(0, 7), -11)}-01`;
  const from = [`${first.slice(0, 7)}-01`, earliest].sort()[1];
  return { grain: 'month', from, to: today, heatmapWeeks };
}

/** The range's buckets, oldest first: days, Monday-start weeks or months. */
export function buckets(range: ActivityRange): Bucket[] {
  const out: Bucket[] = [];
  if (range.grain === 'day') {
    for (let d = range.from; d <= range.to; d = addDays(d, 1)) out.push({ key: d, start: d, end: d });
  } else if (range.grain === 'week') {
    for (let d = weekStart(range.from); d <= range.to; d = addDays(d, 7)) out.push({ key: d, start: d, end: addDays(d, 6) });
  } else {
    for (let m = range.from.slice(0, 7); m <= range.to.slice(0, 7); m = addMonths(m, 1)) {
      out.push({ key: m, start: `${m}-01`, end: lastDayOf(m) });
    }
  }
  return out;
}

/** Adds up day rows (sorted oldest first) into the range's buckets. */
export function sumByBucket<T extends { date: string }, V>(
  rows: T[], range: ActivityRange, init: () => V, add: (value: V, row: T) => void,
): (Bucket & { value: V })[] {
  const out = buckets(range).map((b) => ({ ...b, value: init() }));
  let i = 0;
  for (const row of rows) {
    if (row.date < range.from || row.date > range.to) continue;
    while (i < out.length && row.date > out[i].end) i += 1;
    if (i < out.length && row.date >= out[i].start) add(out[i].value, row);
  }
  return out;
}

/** "per day" / "per week" / "per month", for chart titles. */
export const perGrain = (g: Grain) => `per ${g}`;
