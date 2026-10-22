/**
 * problemMetaService.js — LeetCode difficulty and topic tags for problems that
 * arrive without them: ones the extension creates, imports without a session
 * cookie (LeetCode's public list has no tags) and problems past the 600 the
 * solved list returns. LeetCode's question data is public, so no session is
 * needed. Analytics' "Topics" and "By difficulty" depend on these.
 */

import Problem from '../models/Problem.js';
import { fetchQuestionMeta } from './leetcodeService.js';

/** Don't ask LeetCode again for this long about a problem it had no tags for. */
const RECHECK_MS = 7 * 24 * 60 * 60 * 1000;
/** A background fill runs at most this often per student. */
const COOLDOWN_MS = 10 * 60 * 1000;

let fetchMeta = fetchQuestionMeta;
const lastRun = new Map();
const running = new Set();

/** Tests swap in their own LeetCode lookup so they never touch the network. */
export function __setMetaFetcherForTests(fn) {
  fetchMeta = fn ?? fetchQuestionMeta;
  lastRun.clear();
  running.clear();
}

const missingQuery = (userId, now) => ({
  user: userId,
  platform: 'leetcode',
  $and: [
    { $or: [{ tags: { $size: 0 } }, { tags: { $exists: false } }] },
    { $or: [{ metaCheckedAt: null }, { metaCheckedAt: { $lt: new Date(now - RECHECK_MS) } }] },
  ],
});

/** LeetCode problems still waiting for their tags. */
export const countMissingMeta = (userId, now = Date.now()) => Problem.countDocuments(missingQuery(userId, now));

/**
 * Fills difficulty + tags from LeetCode for problems without tags. A problem
 * LeetCode answered for is marked checked (even with no tags, or if it doesn't
 * exist), so it isn't asked about again for a week; one it didn't answer
 * (blocked, network) stays missing and is retried next time. Returns how many
 * problems got tags.
 */
export async function fillMissingMeta(userId, { session = null, now = Date.now() } = {}) {
  // Repair difficulties stored as 'EASY'/'MEDIUM'/'HARD' by older imports —
  // the app only understands 'Easy'/'Medium'/'Hard'.
  for (const [raw, fixed] of [['EASY', 'Easy'], ['MEDIUM', 'Medium'], ['HARD', 'Hard']]) {
    await Problem.updateMany({ user: userId, platform: 'leetcode', difficulty: raw }, { $set: { difficulty: fixed } });
  }

  const missing = await Problem.find(missingQuery(userId, now), { platformProblemId: 1 }).lean();
  if (!missing.length) return 0;

  const meta = await fetchMeta(missing.map((p) => p.platformProblemId), session);
  const checkedAt = new Date(now);
  const ops = [];
  let tagged = 0;
  for (const [slug, m] of meta) {
    const $set = { metaCheckedAt: checkedAt };
    if (['Easy', 'Medium', 'Hard'].includes(m?.difficulty)) $set.difficulty = m.difficulty;
    if (m?.tags?.length) { $set.tags = m.tags; tagged += 1; }
    ops.push({ updateOne: { filter: { user: userId, platform: 'leetcode', platformProblemId: slug }, update: { $set } } });
  }
  if (ops.length) await Problem.bulkWrite(ops, { ordered: false });
  console.log(`[Meta] Tags for ${tagged} of ${missing.length} problems (${meta.size} answered)`);
  return tagged;
}

/** True while a background fill is running for this student. */
export const isFillingMeta = (userId) => running.has(String(userId));

/**
 * Starts fillMissingMeta in the background, unless one started for this
 * student in the last 10 minutes. Never throws; returns whether it started.
 */
export function fillMissingMetaSoon(userId) {
  const key = String(userId);
  if (running.has(key) || Date.now() - (lastRun.get(key) ?? 0) < COOLDOWN_MS) return false;
  running.add(key);
  lastRun.set(key, Date.now());
  fillMissingMeta(userId)
    .catch((err) => console.warn(`[Meta] Background fill failed: ${err.message}`))
    .finally(() => running.delete(key));
  return true;
}
