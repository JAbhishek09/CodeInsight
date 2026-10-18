/**
 * pilotService.js — what the pilot measures (recognition accuracy week over
 * week) and what a new student still has to set up. See
 * docs/PATTERN_MVP_PLAN.md (phase 6) and docs/PILOT.md.
 */

import Prediction from '../models/Prediction.js';
import Problem from '../models/Problem.js';
import User from '../models/User.js';
import { addDays, dayInZone } from './analyticsService.js';

export const DEFAULT_WEEKS = 8;

/** Monday (YYYY-MM-DD) of the week containing `day`. */
export function weekStartOf(day) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}

const ratio = (c, n) => (n ? c / n : null);

/**
 * Recognition accuracy per week (Monday start, student's time zone) for the
 * last `weeks` weeks, oldest first, including empty weeks.
 *
 * `firstTry` counts only the first-ever guess on each problem: repeat drills
 * of a problem already seen inflate "all guesses", so firstTry is the fairer
 * week-over-week measure for the pilot. "Not sure" counts as a wrong guess.
 */
export async function weeklyRecognition(userId, { tz = 'UTC', weeks = DEFAULT_WEEKS, now = new Date() } = {}) {
  const thisWeek = weekStartOf(dayInZone(now, tz));
  const first = addDays(thisWeek, -7 * (weeks - 1));
  const rows = new Map();
  for (let i = 0; i < weeks; i += 1) {
    rows.set(addDays(first, 7 * i), {
      weekStart: addDays(first, 7 * i), attempts: 0, correct: 0,
      firstTry: { attempts: 0, correct: 0 }, bySource: { drill: 0, extension: 0, app: 0 }, days: new Set(),
    });
  }

  const preds = await Prediction.find(
    { user: userId, resolvedAt: { $ne: null }, actual: { $ne: null } },
    { slug: 1, source: 1, isCorrect: 1, resolvedAt: 1 }
  ).sort({ resolvedAt: 1 }).lean();

  const seen = new Set();
  for (const p of preds) {
    const isFirst = !seen.has(p.slug);
    seen.add(p.slug);
    const day = dayInZone(p.resolvedAt, tz);
    const row = rows.get(weekStartOf(day));
    if (!row) continue;
    const ok = p.isCorrect === true;
    row.attempts += 1;
    if (ok) row.correct += 1;
    if (isFirst) { row.firstTry.attempts += 1; if (ok) row.firstTry.correct += 1; }
    row.bySource[p.source] = (row.bySource[p.source] ?? 0) + 1;
    row.days.add(day);
  }

  return [...rows.values()].map(({ days, ...r }) => ({
    ...r,
    accuracy: ratio(r.correct, r.attempts),
    firstTry: { ...r.firstTry, accuracy: ratio(r.firstTry.correct, r.firstTry.attempts) },
    activeDays: days.size,
  }));
}

/** Getting-started steps for a new student; `done` once all are complete. */
export async function onboardingStatus(userId) {
  const [user, imported, drilled, extensionGuess] = await Promise.all([
    User.findById(userId, { leetcodeHandle: 1, extensionSeenAt: 1 }).lean(),
    Problem.exists({ user: userId, platform: 'leetcode' }),
    Prediction.exists({ user: userId, source: 'drill' }),
    Prediction.exists({ user: userId, source: 'extension' }),
  ]);
  const steps = {
    leetcodeLinked: Boolean(user?.leetcodeHandle),
    imported: Boolean(imported),
    drilled: Boolean(drilled),
    extension: Boolean(user?.extensionSeenAt || extensionGuess),
  };
  return { ...steps, done: Object.values(steps).every(Boolean) };
}
