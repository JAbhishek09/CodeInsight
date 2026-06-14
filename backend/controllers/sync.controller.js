import asyncHandler from '../utils/asyncHandler.js';
import Problem from '../models/Problem.js';
import User from '../models/User.js';
import * as lc from '../services/leetcodeService.js';
import * as cf from '../services/codeforcesService.js';
import { parseLeetcodeHandle, parseCodeforcesHandle } from '../utils/parseHandle.js';

/**
 * Resolve a stored handle value to a clean username.
 *
 * FIX BUG-SYNC-001: The old sanitizeHandle() used a character-whitelist regex
 * that strips slashes and colons — it turned a full URL like
 * "https://leetcode.com/u/krishna_rathi66/" into the garbage string
 * "httpsleetcodecomukrish…", which LeetCode's GraphQL API doesn't recognise,
 * returning recentSubmissionList: null → 0 submissions synced.
 *
 * The new approach:
 *  1. Run the appropriate URL parser (same logic as saveHandles).
 *  2. Fall back to a simple alphanumeric sanitise for handles that are
 *     already clean (the common case after this fix ships).
 *  3. Return null if we cannot extract a usable username.
 *
 * @param {string} raw     - Value stored in user.leetcodeHandle / codeforcesHandle
 * @param {'leetcode'|'codeforces'} platform
 * @returns {string|null}
 */
function resolveHandle(raw, platform) {
  if (!raw || typeof raw !== 'string') return null;

  if (platform === 'leetcode') return parseLeetcodeHandle(raw);
  if (platform === 'codeforces') return parseCodeforcesHandle(raw);
  return null;
}

/**
 * @desc    Trigger platform sync for the logged-in user
 * @route   POST /api/sync
 * @access  Private (protect applied in sync.routes.js)
 *
 * FIX BUG-004: Use $addToSet-equivalent logic to prevent duplicate submissions.
 * FIX BUG-006: Use bulkWrite for N+1 reduction.
 * FIX BUG-013: Resolve handles via URL-aware parser before external API calls.
 */
export const triggerSync = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);

  await User.findByIdAndUpdate(userId, { syncStatus: 'syncing' });

  const results = { leetcode: 0, codeforces: 0, errors: [] };

  // BUG-SYNC-002 FIX: Wrap sync logic in try/finally so syncStatus is ALWAYS
  // reset — even if an unhandled exception occurs mid-sync.
  try {

    // ── LeetCode Sync ──────────────────────────────────────────────────────────
    const lcHandle = resolveHandle(user.leetcodeHandle, 'leetcode');
    if (lcHandle) {
      try {
        console.log(`[Sync] LeetCode handle resolved: "${user.leetcodeHandle}" → "${lcHandle}"`);
        const subs = await lc.fetchSubmissions(lcHandle);
        console.log(`[Sync] LeetCode fetched ${subs.length} submissions for "${lcHandle}"`);
        if (subs.length > 0) {
          await upsertSubmissions(userId, 'leetcode', subs);
          results.leetcode = subs.length;
        }
      } catch (e) {
        console.error('[Sync] LeetCode error:', e.message);
        results.errors.push({ platform: 'leetcode', message: e.message });
      }
    } else if (user.leetcodeHandle) {
      // Handle was set but could not be resolved — tell the user explicitly
      console.warn(`[Sync] Could not resolve LeetCode handle: "${user.leetcodeHandle}"`);
      results.errors.push({
        platform: 'leetcode',
        message: `Could not parse LeetCode username from "${user.leetcodeHandle}". Please update your handle on the Profile page.`,
      });
    }

    // ── Codeforces Sync ────────────────────────────────────────────────────────
    const cfHandle = resolveHandle(user.codeforcesHandle, 'codeforces');
    if (cfHandle) {
      try {
        console.log(`[Sync] Codeforces handle resolved: "${user.codeforcesHandle}" → "${cfHandle}"`);
        const subs = await cf.fetchSubmissions(cfHandle);
        console.log(`[Sync] Codeforces fetched ${subs.length} submissions for "${cfHandle}"`);
        if (subs.length > 0) {
          await upsertSubmissions(userId, 'codeforces', subs);
          results.codeforces = subs.length;
        }
      } catch (e) {
        console.error('[Sync] Codeforces error:', e.message);
        results.errors.push({ platform: 'codeforces', message: e.message });
      }
    } else if (user.codeforcesHandle) {
      console.warn(`[Sync] Could not resolve Codeforces handle: "${user.codeforcesHandle}"`);
      results.errors.push({
        platform: 'codeforces',
        message: `Could not parse Codeforces handle from "${user.codeforcesHandle}". Please update your handle on the Profile page.`,
      });
    }

  } finally {
    // Always reset syncStatus — even if an unexpected exception was thrown above.
    // .catch() ensures a DB failure here doesn't mask the original error.
    await User.findByIdAndUpdate(userId, {
      lastSyncedAt: new Date(),
      syncStatus: results.errors.length > 0 ? 'error' : 'idle',
    }).catch(e => console.error('[Sync] Failed to reset syncStatus:', e.message));
  }

  res.status(200).json({ success: true, synced: results });
});

/**
 * Upsert submissions using bulkWrite for performance.
 * Each operation:
 *  1. Creates the problem document if it doesn't exist ($setOnInsert)
 *  2. Only pushes the submission if the submissionId is NOT already present
 *     using $addToSet equivalent: $push with $elemMatch filter doesn't work
 *     directly, so we do a conditional update via the filter itself.
 *
 * Strategy: We use two-phase:
 *   Phase 1: bulkWrite upsert to ensure problem documents exist
 *   Phase 2: For each submission, add only if submissionId not present
 *
 * This reduces 100 sequential writes to 2 batch operations.
 */
async function upsertSubmissions(userId, platform, subs) {
  // Phase 1: Ensure problem documents exist (upsert, no submission writes yet)
  const upsertOps = subs.map((sub) => ({
    updateOne: {
      filter: {
        user: userId,
        platform,
        platformProblemId: sub.platformProblemId,
      },
      update: {
        $setOnInsert: {
          user: userId,
          platform,
          platformProblemId: sub.platformProblemId,
          title: sub.title,
          url: sub.link,
          ...(sub.difficulty && { difficulty: sub.difficulty }),
          ...(sub.tags?.length && { tags: sub.tags }),
        },
      },
      upsert: true,
    },
  }));

  await Problem.bulkWrite(upsertOps, { ordered: false });

  // Phase 2: Push submission only if submissionId not already in array
  // We use the filter `submissions.submissionId: { $ne: sub.submissionId }` to
  // make the update a no-op if it's already there — this is the safest approach.
  const pushOps = subs.map((sub) => ({
    updateOne: {
      filter: {
        user: userId,
        platform,
        platformProblemId: sub.platformProblemId,
        'submissions.submissionId': { $ne: String(sub.submissionId) },
      },
      update: {
        $push: {
          submissions: {
            $each: [{
              submittedAt: sub.submittedAt,
              verdict: sub.verdict,
              language: sub.language,
              code: sub.code || '',
              submissionId: String(sub.submissionId),
            }],
            $sort: { submittedAt: -1 },
            $slice: 200, // Cap at 200 submissions per problem
          },
        },
      },
    },
  }));

  await Problem.bulkWrite(pushOps, { ordered: false });
}
