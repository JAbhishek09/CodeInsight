/**
 * drillService.js — guess-the-pattern mode: short decks of problem prompts
 * (title hidden) for quick recognition practice. Answers go through
 * POST /api/predictions with source 'drill', so they count toward
 * recognition accuracy. See docs/PATTERN_MVP_PLAN.md.
 */

import Prediction from '../models/Prediction.js';
import { PATTERNS, patternByKey } from '../data/patterns.js';
import { PROBLEM_PATTERNS } from '../data/problemPatterns.js';
import { PROBLEM_PROMPTS } from '../data/problemPrompts.js';

export const DECK_SIZE = 10;
const RECENT_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Deck order: problems the student got wrong (or was unsure about) last time
 * first, then ones never guessed, then ones guessed right — skipping those
 * guessed right in the last 3 days unless the pool runs dry. Within a tier,
 * weaker patterns come first. A mixed deck caps each pattern at a third so
 * the answer isn't predictable from the previous card.
 */
export async function drillDeck(userId, { pattern = null, size = DECK_SIZE, now = Date.now(), rng = Math.random } = {}) {
  const pool = PROBLEM_PATTERNS.filter((m) => PROBLEM_PROMPTS[m.slug] && (!pattern || m.pattern === pattern));

  // Latest resolved guess per slug, and accuracy per pattern
  const preds = await Prediction.find(
    { user: userId, resolvedAt: { $ne: null }, actual: { $ne: null } },
    { slug: 1, actual: 1, isCorrect: 1, resolvedAt: 1 }
  ).sort({ resolvedAt: -1 }).lean();
  const last = new Map();
  const tally = new Map();
  for (const p of preds) {
    if (!last.has(p.slug)) last.set(p.slug, p);
    const t = tally.get(p.actual) ?? { n: 0, ok: 0 };
    t.n += 1; if (p.isCorrect) t.ok += 1;
    tally.set(p.actual, t);
  }
  const weakness = (key) => { const t = tally.get(key); return t ? 1 - t.ok / t.n : 0.5; };

  const tierOf = (slug) => {
    const p = last.get(slug);
    if (!p) return 1;
    if (!p.isCorrect) return 0;
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
    cards: picked.map(({ m, tier }) => ({
      slug: m.slug,
      difficulty: m.difficulty,
      prompt: PROBLEM_PROMPTS[m.slug],
      missedBefore: tier === 0,
    })),
    options: PATTERNS.map((p) => ({ key: p.key, name: p.name })),
  };
}
