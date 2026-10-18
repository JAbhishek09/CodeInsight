/**
 * practiceService.js — "what should I practise today?"
 *
 * Builds a short daily plan from the knowledge base, the student's progress,
 * their recognition accuracy and the review queue:
 *   1. up to 2 due reviews (spaced re-solving)
 *   2. 1 retry of an attempted-but-unsolved problem (focus pattern first)
 *   3. new problems in the focus pattern, easiest first, to fill the plan
 * See docs/PATTERN_MVP_PLAN.md.
 */

import Problem from '../models/Problem.js';
import { PATTERNS, patternByKey } from '../data/patterns.js';
import { PROBLEM_PATTERNS, problemPatternBySlug } from '../data/problemPatterns.js';
import { listPatterns, progressBySlug } from './patternService.js';
import { predictionStats } from './predictionService.js';
import { reviewQueue, seedReviewsFromHistory } from './reviewService.js';
import { dayInZone } from './analyticsService.js';
import { onboardingStatus } from './pilotService.js';

const PLAN_SIZE = 4;
const MAX_REVIEWS = 2;
const MASTERED = 0.7;
const DIFF_ORDER = { Easy: 0, Medium: 1, Hard: 2 };

/**
 * Weakest pattern worth working on now. Weakness blends how much of the
 * pattern is unsolved with how often the student fails to recognise it
 * (once they have 3+ guesses on it). Only patterns whose prerequisites are
 * at least started, and that aren't mastered, are candidates.
 */
export function chooseFocus(patterns, perPatternAccuracy = new Map()) {
  const byKey = new Map(patterns.map((p) => [p.key, p]));
  const started = (p) => p.solved + p.attempted > 0;
  const ratio = (p) => (p.total ? p.solved / p.total : 0);
  const ready = (p) => p.requires.every((r) => byKey.get(r) && started(byKey.get(r)));

  const weakness = (p) => {
    const acc = perPatternAccuracy.get(p.key);
    const unsolved = 1 - ratio(p);
    return acc && acc.attempts >= 3 ? 0.5 * unsolved + 0.5 * (1 - acc.accuracy) : unsolved;
  };

  const candidates = patterns.filter((p) => ready(p) && (ratio(p) < MASTERED || (perPatternAccuracy.get(p.key)?.attempts >= 3 && perPatternAccuracy.get(p.key).accuracy < MASTERED)));
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => weakness(b) - weakness(a) || a.level - b.level)[0];
}

const item = (kind, m, progress, reason, extra = {}) => ({
  kind,
  slug: m.slug,
  title: m.title,
  difficulty: m.difficulty,
  pattern: { key: m.pattern, name: patternByKey.get(m.pattern)?.name ?? m.pattern },
  url: `https://leetcode.com/problems/${m.slug}/`,
  problemId: progress?.problemId ?? null,
  reason,
  ...extra,
});

export async function todayPlan(userId, { tz = 'UTC', now = new Date() } = {}) {
  await seedReviewsFromHistory(userId, now);

  const [overview, stats, queue, onboarding] = await Promise.all([
    listPatterns(userId), predictionStats(userId), reviewQueue(userId, now), onboardingStatus(userId),
  ]);
  const accMap = new Map(stats.perPattern.filter((p) => p.accuracy !== null).map((p) => [p.key, p]));
  const focus = chooseFocus(overview.patterns, accMap);
  const progress = await progressBySlug(userId, PROBLEM_PATTERNS.map((p) => p.slug));

  const plan = [];
  const used = new Set();
  const push = (x) => { plan.push(x); used.add(x.slug); };

  // 1. Due reviews
  for (const r of queue.due.slice(0, MAX_REVIEWS)) {
    const m = problemPatternBySlug.get(r.slug);
    if (!m) continue;
    push(item('review', m, progress.get(r.slug),
      r.reason === 'recognition' ? 'You didn’t spot the pattern last time — try again without hints.' : 'This one took several tries — re-solve it from scratch.',
      { reviewId: String(r._id), dueAt: r.dueAt }));
  }

  // 2. One retry: attempted but not solved, focus pattern first
  const attempted = PROBLEM_PATTERNS
    .filter((m) => progress.get(m.slug)?.status === 'attempted' && !used.has(m.slug))
    .sort((a, b) => Number(b.pattern === focus?.key) - Number(a.pattern === focus?.key) || DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]);
  if (attempted[0]) push(item('retry', attempted[0], progress.get(attempted[0].slug), 'You started this but haven’t got it accepted yet.'));

  // 3. New problems in the focus pattern, easiest first (then any pattern)
  const fresh = (pred) => PROBLEM_PATTERNS
    .filter((m) => pred(m) && !progress.get(m.slug) && !used.has(m.slug))
    .sort((a, b) => DIFF_ORDER[a.difficulty] - DIFF_ORDER[b.difficulty]);
  for (const m of [...fresh((x) => x.pattern === focus?.key), ...fresh((x) => x.pattern !== focus?.key)]) {
    if (plan.length >= PLAN_SIZE) break;
    if (used.has(m.slug)) continue;
    push(item('new', m, null, m.pattern === focus?.key ? `New ${patternByKey.get(m.pattern).name} problem — guess the pattern before you start.` : 'A new problem to keep your range wide.'));
  }

  // Done today: mapped problems whose first accept falls on today (student's time zone)
  const today = dayInZone(now, tz);
  const docs = await Problem.find(
    { user: userId, platform: 'leetcode', platformProblemId: { $in: PROBLEM_PATTERNS.map((p) => p.slug) }, 'submissions.verdict': 'Accepted' },
    { platformProblemId: 1, title: 1, 'submissions.verdict': 1, 'submissions.submittedAt': 1 }
  ).lean();
  const doneToday = docs
    .filter((d) => {
      const firstAc = (d.submissions ?? []).filter((s) => s.verdict === 'Accepted').map((s) => new Date(s.submittedAt)).sort((a, b) => a - b)[0];
      return firstAc && dayInZone(firstAc, tz) === today;
    })
    .map((d) => ({ slug: d.platformProblemId, title: d.title, problemId: String(d._id), pattern: problemPatternBySlug.get(d.platformProblemId)?.pattern ?? null }));

  const focusSummary = focus && {
    key: focus.key,
    name: focus.name,
    short: focus.short,
    solved: focus.solved,
    total: focus.total,
    recognition: accMap.get(focus.key) ? { attempts: accMap.get(focus.key).attempts, accuracy: accMap.get(focus.key).accuracy } : null,
  };

  return {
    date: today,
    focus: focusSummary,
    plan,
    doneToday,
    reviews: { due: queue.due.length, upcomingThisWeek: queue.upcoming },
    recognition: { attempts: stats.attempts, accuracy: stats.accuracy },
    patterns: overview.patterns.map((p) => ({
      key: p.key, name: p.name, solved: p.solved, total: p.total,
      accuracy: accMap.get(p.key)?.accuracy ?? null,
    })),
    allPatterns: PATTERNS.length,
    onboarding,
  };
}
