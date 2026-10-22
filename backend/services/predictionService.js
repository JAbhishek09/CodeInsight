/**
 * predictionService.js — the predict → solve → feedback loop.
 * See docs/PATTERN_MVP_PLAN.md.
 */

import Prediction from '../models/Prediction.js';
import { PATTERNS, PATTERN_KEYS, patternByKey } from '../data/patterns.js';
import { problemPatternBySlug } from '../data/problemPatterns.js';
import { scheduleReview } from './reviewService.js';
import { contrastTip } from '../data/patternContrasts.js';

const RECOGNITION_REVIEW_DAYS = 2;
/** A missed or unsure guess means the pattern isn't recognised yet — re-solve soon. */
async function queueIfMissed(userId, pred) {
  if (!pred?.actual) return;
  if (pred.isCorrect === false || pred.predicted === UNSURE) {
    await scheduleReview(userId, pred.slug, 'recognition', Date.now() + RECOGNITION_REVIEW_DAYS * 24 * 60 * 60 * 1000);
  }
}

export const UNSURE = 'unsure';
// An extension prediction older than this no longer belongs to "this attempt".
const OPEN_WINDOW_MS = 24 * 60 * 60 * 1000;
const SLOW_VERDICTS = new Set(['TLE', 'MLE']);

export const isValidPrediction = (p) => p === UNSURE || PATTERN_KEYS.includes(p);
export const isValidSlug = (s) => typeof s === 'string' && /^[a-z0-9-]{1,120}$/.test(s);

const nameOf = (key) => patternByKey.get(key)?.name ?? key;

/**
 * What the student sees after a prediction resolves. Built from stored facts,
 * so it can be re-sent later (duplicate uploads, app reloads).
 */
export function buildFeedback(pred) {
  if (!pred) return null;
  const map = problemPatternBySlug.get(pred.slug);
  const base = {
    predictionId: String(pred._id),
    slug: pred.slug,
    predicted: pred.predicted,
    predictedName: pred.predicted === UNSURE ? 'Not sure' : nameOf(pred.predicted),
    verdict: pred.verdict ?? null,
    source: pred.source,
    createdAt: pred.createdAt,
  };

  if (!map) {
    return { ...base, mapped: false, outcome: 'unmapped', title: 'Not in the pattern map yet', message: 'We’ll add this problem soon — your guess is saved.' };
  }

  const pattern = { key: map.pattern, name: nameOf(map.pattern), short: patternByKey.get(map.pattern)?.short ?? '', cue: map.cue, complexity: map.complexity };
  const secondary = map.secondary ? { key: map.secondary, name: nameOf(map.secondary) } : null;
  const accepted = pred.verdict === 'Accepted';
  const failed = pred.verdict && !accepted;
  let outcome, title, message, contrast = null;

  if (pred.predicted === UNSURE) {
    outcome = 'unsure';
    title = `It’s ${pattern.name}`;
    message = `The clue: ${pattern.cue}.`;
  } else if (pred.isCorrect) {
    if (failed) {
      outcome = 'right-pattern-bug';
      title = 'Right pattern';
      message = SLOW_VERDICTS.has(pred.verdict)
        ? `You picked the right idea, but the solution is too slow (${pred.verdict}). The optimal is ${pattern.complexity} — check for repeated work.`
        : `You picked the right idea — the ${pred.verdict} is in the implementation. Check edge cases and boundaries.`;
    } else {
      outcome = 'recognised';
      title = `Right — ${pattern.name}`;
      message = accepted ? 'You spotted it and solved it.' : `You spotted it. The clue: ${pattern.cue}.`;
    }
  } else {
    outcome = SLOW_VERDICTS.has(pred.verdict) ? 'wrong-approach' : 'missed';
    title = `This is ${pattern.name}, not ${base.predictedName}`;
    message = `The clue: ${pattern.cue}.` + (outcome === 'wrong-approach' ? ' That’s likely why it timed out.' : '');
    const tip = contrastTip(map.pattern, pred.predicted);
    if (tip) contrast = { key: pred.predicted, name: base.predictedName, tip };
  }

  return {
    ...base, mapped: true, pattern, secondary, isCorrect: pred.isCorrect, outcome, title, message, contrast,
    problem: { title: map.title, difficulty: map.difficulty, url: `https://leetcode.com/problems/${pred.slug}/` },
  };
}

/**
 * Save a guess. Extension guesses replace an earlier open guess for the same
 * problem (the student changed their mind); app guesses resolve immediately.
 */
export async function recordPrediction({ userId, slug, predicted, source }) {
  const map = problemPatternBySlug.get(slug);
  const actual = map?.pattern ?? null;
  const isCorrect = !actual || predicted === UNSURE ? null : predicted === actual || predicted === map.secondary;

  if (source === 'app' || source === 'drill') {
    const pred = await Prediction.create({ user: userId, slug, source, predicted, actual, isCorrect, resolvedAt: new Date() });
    // Drills re-show misses in the next deck; the review queue is for re-solving.
    if (source === 'app') await queueIfMissed(userId, pred);
    return { prediction: pred, feedback: buildFeedback(pred) };
  }

  const since = new Date(Date.now() - OPEN_WINDOW_MS);
  const pred = await Prediction.findOneAndUpdate(
    { user: userId, slug, source: 'extension', resolvedAt: null, createdAt: { $gte: since } },
    { $set: { predicted, actual, isCorrect } },
    { new: true, sort: { createdAt: -1 } }
  ) ?? await Prediction.create({ user: userId, slug, source, predicted, actual, isCorrect });

  // Don't reveal the answer before they submit.
  return { prediction: pred, feedback: null };
}

/**
 * Called when a submission is ingested: closes the open extension guess for
 * that problem. A re-sent submission returns the feedback it produced before.
 */
export async function resolveOnSubmission({ userId, slug, submissionId, verdict }) {
  const sid = String(submissionId);
  const already = await Prediction.findOne({ user: userId, slug, submissionId: sid });
  if (already) return buildFeedback(already);

  const since = new Date(Date.now() - OPEN_WINDOW_MS);
  const pred = await Prediction.findOneAndUpdate(
    { user: userId, slug, source: 'extension', resolvedAt: null, createdAt: { $gte: since } },
    { $set: { verdict, submissionId: sid, resolvedAt: new Date() } },
    { new: true, sort: { createdAt: -1 } }
  );
  await queueIfMissed(userId, pred);
  return buildFeedback(pred);
}

/** The most recent resolved guess for a problem, for the app's problem page (drills excluded). */
export async function latestFeedback(userId, slug) {
  const pred = await Prediction.findOne({ user: userId, slug, resolvedAt: { $ne: null }, source: { $ne: 'drill' } }).sort({ resolvedAt: -1 });
  return buildFeedback(pred);
}

/**
 * Recognition accuracy overall and per pattern. "Not sure" guesses count as
 * attempts but not as correct; unmapped problems are ignored.
 */
export async function predictionStats(userId) {
  const rows = await Prediction.aggregate([
    { $match: { user: userId, resolvedAt: { $ne: null }, actual: { $ne: null } } },
    {
      $group: {
        _id: '$actual',
        attempts: { $sum: 1 },
        correct: { $sum: { $cond: ['$isCorrect', 1, 0] } },
        unsure: { $sum: { $cond: [{ $eq: ['$predicted', UNSURE] }, 1, 0] } },
      },
    },
  ]);
  const byKey = new Map(rows.map((r) => [r._id, r]));
  const perPattern = PATTERNS.map((p) => {
    const r = byKey.get(p.key) ?? { attempts: 0, correct: 0, unsure: 0 };
    return { key: p.key, attempts: r.attempts, correct: r.correct, unsure: r.unsure, accuracy: r.attempts ? r.correct / r.attempts : null };
  });
  const attempts = rows.reduce((n, r) => n + r.attempts, 0);
  const correct = rows.reduce((n, r) => n + r.correct, 0);

  // Which wrong guesses are most common: actual → predicted
  const confusions = await Prediction.aggregate([
    { $match: { user: userId, resolvedAt: { $ne: null }, actual: { $ne: null }, isCorrect: false } },
    { $group: { _id: { actual: '$actual', predicted: '$predicted' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);

  return {
    attempts,
    correct,
    accuracy: attempts ? correct / attempts : null,
    perPattern,
    confusions: confusions.map((c) => ({
      actual: c._id.actual, actualName: nameOf(c._id.actual),
      predicted: c._id.predicted, predictedName: nameOf(c._id.predicted),
      count: c.count,
      tip: contrastTip(c._id.actual, c._id.predicted),
    })),
  };
}
