/**
 * reviewService.js — spaced re-solving of problems a student found hard.
 *
 * Scheduled automatically when a guess misses the pattern (due in 2 days) or a
 * problem took 4+ tries to accept (due a week after). "Got it" stretches the
 * interval (≈ ×2.5), "struggled" brings it back in 2 days; after a long enough
 * interval the review is retired.
 */

import Review from '../models/Review.js';
import Problem from '../models/Problem.js';
import { problemPatternBySlug, PROBLEM_PATTERNS } from '../data/problemPatterns.js';
import { diagnoseProblem } from './diagnosisService.js';

const DAY = 24 * 60 * 60 * 1000;
const RETIRE_AFTER_DAYS = 60;
const SEED_LIMIT = 20;

/** Queue (or pull earlier) a review. Mapped problems only — reviews are about patterns. */
export async function scheduleReview(userId, slug, reason, dueAt) {
  if (!problemPatternBySlug.has(slug)) return null;
  const due = new Date(dueAt);
  const existing = await Review.findOne({ user: userId, slug });
  if (!existing) {
    return Review.create({ user: userId, slug, reason, dueAt: due, intervalDays: Math.max(1, Math.round((due - Date.now()) / DAY)) });
  }
  if (existing.done || due < existing.dueAt) {
    existing.done = false;
    existing.dueAt = due;
    existing.reason = reason;
    await existing.save();
  }
  return existing;
}

export async function completeReview(userId, reviewId, result) {
  const r = await Review.findOne({ _id: reviewId, user: userId });
  if (!r) return null;
  const now = new Date();
  if (result === 'easy') {
    r.intervalDays = Math.max(3, Math.round(r.intervalDays * 2.5));
    r.reps += 1;
  } else {
    r.intervalDays = 2;
  }
  r.lastResult = result;
  r.lastReviewedAt = now;
  r.done = r.intervalDays > RETIRE_AFTER_DAYS;
  r.dueAt = new Date(now.getTime() + r.intervalDays * DAY);
  await r.save();
  return r;
}

/**
 * First time only: queue problems from the student's history that took 4+
 * tries. Overdue ones are spread one per day from today so the queue isn't
 * flooded. Returns how many were queued.
 */
export async function seedReviewsFromHistory(userId, now = new Date()) {
  if (await Review.exists({ user: userId })) return 0;
  const docs = await Problem.find(
    { user: userId, platform: 'leetcode', platformProblemId: { $in: PROBLEM_PATTERNS.map((p) => p.slug) } },
    { platformProblemId: 1, platform: 1, 'submissions.verdict': 1, 'submissions.submittedAt': 1 }
  ).lean();

  const struggles = docs
    .map((d) => ({ slug: d.platformProblemId, dx: diagnoseProblem(d) }))
    .filter((x) => x.dx.status === 'solved-with-struggle' && x.dx.reviewOn)
    .sort((a, b) => new Date(b.dx.reviewOn) - new Date(a.dx.reviewOn))
    .slice(0, SEED_LIMIT);

  let overdue = 0;
  const startOfToday = new Date(now); startOfToday.setUTCHours(0, 0, 0, 0);
  const rows = struggles.map(({ slug, dx }) => {
    let due = new Date(dx.reviewOn);
    if (due < now) due = new Date(startOfToday.getTime() + overdue++ * DAY);
    return { user: userId, slug, reason: 'struggle', dueAt: due, intervalDays: 7 };
  });
  if (rows.length) await Review.insertMany(rows, { ordered: false }).catch(() => {});
  return rows.length;
}

export async function reviewQueue(userId, now = new Date()) {
  const endOfToday = new Date(now); endOfToday.setUTCHours(23, 59, 59, 999);
  const weekAhead = new Date(endOfToday.getTime() + 7 * DAY);
  const [due, upcoming] = await Promise.all([
    Review.find({ user: userId, done: false, dueAt: { $lte: endOfToday } }).sort({ dueAt: 1 }).lean(),
    Review.countDocuments({ user: userId, done: false, dueAt: { $gt: endOfToday, $lte: weekAhead } }),
  ]);
  return { due, upcoming };
}
