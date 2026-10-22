/**
 * drillService.js — guess-the-pattern mode: short decks of problem prompts
 * (title hidden) for quick recognition practice. Answers go through
 * POST /api/predictions with source 'drill', so they count toward
 * recognition accuracy. See docs/PATTERN_MVP_PLAN.md.
 */

import Prediction from '../models/Prediction.js';
import { PATTERNS, patternByKey } from '../data/patterns.js';
import { PROBLEM_PATTERNS } from '../data/problemPatterns.js';
import { PROBLEM_PROMPTS, PROMPT_CLUES } from '../data/problemPrompts.js';
import { creditOf } from './predictionService.js';
import { computeStreak, dayInZone } from './analyticsService.js';

export const DECK_SIZE = 10;
/** Cards to answer in a day (any decks) for the day to count toward the drill streak. */
export const DAILY_CARDS = DECK_SIZE;
const RECENT_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Deck order: problems the student got wrong, was unsure about or needed the
 * hint for last time first, then ones never guessed, then ones guessed right —
 * skipping those guessed right in the last 3 days unless the pool runs dry.
 * Within a tier, weaker patterns come first. A mixed deck caps each pattern at
 * a third so the answer isn't predictable from the previous card.
 */
export async function drillDeck(userId, { pattern = null, size = DECK_SIZE, now = Date.now(), rng = Math.random } = {}) {
  const pool = PROBLEM_PATTERNS.filter((m) => PROBLEM_PROMPTS[m.slug] && (!pattern || m.pattern === pattern));

  // Latest resolved guess per slug, and accuracy per pattern
  const preds = await Prediction.find(
    { user: userId, resolvedAt: { $ne: null }, actual: { $ne: null } },
    { slug: 1, actual: 1, isCorrect: 1, hinted: 1, resolvedAt: 1 }
  ).sort({ resolvedAt: -1 }).lean();
  const last = new Map();
  const tally = new Map();
  for (const p of preds) {
    if (!last.has(p.slug)) last.set(p.slug, p);
    const t = tally.get(p.actual) ?? { n: 0, ok: 0 };
    t.n += 1; t.ok += creditOf(p);
    tally.set(p.actual, t);
  }
  const weakness = (key) => { const t = tally.get(key); return t ? 1 - t.ok / t.n : 0.5; };

  const tierOf = (slug) => {
    const p = last.get(slug);
    if (!p) return 1;
    if (!p.isCorrect || p.hinted) return 0;
    return now - new Date(p.resolvedAt).getTime() < RECENT_MS ? 3 : 2;
  };
  const ranked = pool
    .map((m) => ({ m, tier: tierOf(m.slug), score: weakness(m.pattern) + rng() * 0.6 }))
    .sort((a, b) => a.tier - b.tier || b.score - a.score);

  const cap = pattern ? Infinity : Math.max(1, Math.ceil(size / 3));
  const notRecent = ranked.filter((x) => x.tier < 3).length;
  const perPattern = new Map();
  const picked = [];
  for (const r of ranked) {
    if (picked.length >= size) break;
    if (r.tier === 3 && notRecent >= size) break;
    const n = perPattern.get(r.m.pattern) ?? 0;
    if (n >= cap) continue;
    perPattern.set(r.m.pattern, n + 1);
    picked.push(r);
  }

  // Shuffle so tiers and patterns aren't in a guessable order
  for (let i = picked.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }

  return {
    pattern: pattern ? { key: pattern, name: patternByKey.get(pattern)?.name ?? pattern } : null,
    cards: picked.map(({ m, tier }) => {
      const hinted = tier === 0 && Boolean(last.get(m.slug).hinted);
      return {
        slug: m.slug,
        difficulty: m.difficulty,
        prompt: PROBLEM_PROMPTS[m.slug],
        // The hint: words in the prompt to highlight
        clues: PROMPT_CLUES[m.slug] ?? [],
        missedBefore: tier === 0 && !hinted,
        hintedBefore: hinted,
      };
    }),
    options: PATTERNS.map((p) => ({ key: p.key, name: p.name })),
  };
}

/**
 * The daily drill: a day counts once DAILY_CARDS cards are answered that day
 * (student's time zone, any decks, "not sure" included). The streak is the run
 * of such days and, like the solving streak, stays alive until today ends.
 */
export async function drillStreak(userId, { tz = 'UTC', now = new Date() } = {}) {
  const today = dayInZone(now, tz);
  const days = await Prediction.aggregate([
    { $match: { user: userId, source: 'drill', resolvedAt: { $ne: null } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$resolvedAt', timezone: tz } }, cards: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const cards = days.find((d) => d._id === today)?.cards ?? 0;
  return {
    target: DAILY_CARDS,
    today: { date: today, cards, done: cards >= DAILY_CARDS },
    streak: computeStreak(days.filter((d) => d.cards >= DAILY_CARDS).map((d) => d._id), today),
  };
}
