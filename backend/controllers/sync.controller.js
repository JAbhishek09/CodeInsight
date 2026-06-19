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

// ─────────────────────────────────────────────────────────────────────────────
// triggerSync — LEGACY full sync (kept for backward-compatibility)
//
// This route is kept for existing callers but is superseded by
// triggerRecoverySync below.  See audit recommendation: the sync controller
// should be converted to a Recovery/Fallback Sync.
//
// BUG-SYNC-002 FIX: Wrapped sync logic in try/finally so syncStatus is
// ALWAYS reset even when an unhandled exception occurs mid-sync.
// ─────────────────────────────────────────────────────────────────────────────

export const triggerSync = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);

  await User.findByIdAndUpdate(userId, { syncStatus: 'syncing' });

  const results = { leetcode: 0, codeforces: 0, errors: [] };

  try {
    // ── LeetCode Sync ────────────────────────────────────────────────────────
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
      console.warn(`[Sync] Could not resolve LeetCode handle: "${user.leetcodeHandle}"`);
      results.errors.push({
        platform: 'leetcode',
        message: `Could not parse LeetCode username from "${user.leetcodeHandle}". Please update your handle on the Profile page.`,
      });
    }

    // ── Codeforces Sync ──────────────────────────────────────────────────────
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
    // BUG-SYNC-002: Always reset syncStatus, even on unexpected exception
    await User.findByIdAndUpdate(userId, {
      lastSyncedAt: new Date(),
      syncStatus: results.errors.length > 0 ? 'error' : 'idle',
    }).catch(e => console.error('[Sync] Failed to reset syncStatus:', e.message));
  }

  res.status(200).json({ success: true, synced: results });
});

// ─────────────────────────────────────────────────────────────────────────────
// triggerRecoverySync — RECOMMENDED replacement for triggerSync
//
// Audit recommendation: Convert sync to Recovery/Fallback Sync.
//
// Key differences from triggerSync:
//
//  1. LeetCode sync is OPT-IN via { "forceLC": true } in the request body.
//     By default it is SKIPPED because the Chrome Extension captures LeetCode
//     submissions in real-time with source code.  Running sync for LC without
//     being asked would overwrite problem documents with code-less submissions
//     and is wasteful.
//
//  2. Codeforces sync always runs unconditionally.  There is no extension for
//     Codeforces — this is the ONLY path for CF data.
//
//  3. A warning is always added to the response when LeetCode sync runs,
//     reminding callers that no source code is captured (AI analysis
//     requires the extension).
//
//  4. syncStatus lifecycle is identical to triggerSync: 'syncing' →
//     try { ... } finally { 'idle' | 'error' }.
//
// Frontend integration:
//  - Default "Sync" button: POST /api/sync/recovery  (no body — CF only)
//  - "Recover missed LC" button: POST /api/sync/recovery  { forceLC: true }
//    (show only when lastSyncedAt > 24 h ago or after extension reports failure)
// ─────────────────────────────────────────────────────────────────────────────

export const triggerRecoverySync = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId);

  // forceLC: true → also sync LeetCode (recovery mode for missed submissions)
  // forceLC: false (default) → Codeforces only
  const { forceLC = false } = req.body;

  await User.findByIdAndUpdate(userId, { syncStatus: 'syncing' });

  const results = {
    leetcode: 0,
    codeforces: 0,
    errors: [],
    warnings: [],
  };

  try {
    // ── Codeforces Sync (always runs — no extension exists for CF) ────────────
    const cfHandle = resolveHandle(user.codeforcesHandle, 'codeforces');
    if (cfHandle) {
      try {
        console.log(`[RecoverySync] Codeforces handle: "${cfHandle}"`);
        const subs = await cf.fetchSubmissions(cfHandle);
        console.log(`[RecoverySync] CF fetched ${subs.length} submissions`);
        if (subs.length > 0) {
          await upsertSubmissions(userId, 'codeforces', subs);
          results.codeforces = subs.length;
        }
      } catch (e) {
        console.error('[RecoverySync] Codeforces error:', e.message);
        results.errors.push({ platform: 'codeforces', message: e.message });
      }
    } else if (user.codeforcesHandle) {
      results.errors.push({
        platform: 'codeforces',
        message: `Could not parse Codeforces handle from "${user.codeforcesHandle}". Please update your handle on the Profile page.`,
      });
    }

    // ── LeetCode Sync (opt-in recovery only) ─────────────────────────────────
    if (forceLC) {
      const lcHandle = resolveHandle(user.leetcodeHandle, 'leetcode');
      if (lcHandle) {
        try {
          console.log(`[RecoverySync] LeetCode recovery sync for "${lcHandle}"`);
          const subs = await lc.fetchSubmissions(lcHandle);
          console.log(`[RecoverySync] LC fetched ${subs.length} submissions`);
          if (subs.length > 0) {
            await upsertSubmissions(userId, 'leetcode', subs);
            results.leetcode = subs.length;
          }
          // Always warn: LC sync does NOT capture source code
          results.warnings.push(
            'LeetCode recovery sync captured submissions without source code. ' +
            'AI analysis is only available for submissions captured by the Chrome Extension.'
          );
        } catch (e) {
          console.error('[RecoverySync] LeetCode error:', e.message);
          results.errors.push({ platform: 'leetcode', message: e.message });
        }
      } else if (user.leetcodeHandle) {
        results.errors.push({
          platform: 'leetcode',
          message: `Could not parse LeetCode username from "${user.leetcodeHandle}". Please update your handle on the Profile page.`,
        });
      }
    } else {
      // LC sync skipped — inform the caller why
      results.warnings.push(
        'LeetCode sync skipped (extension handles real-time LC capture). ' +
        'Pass { "forceLC": true } to recover submissions missed while the extension was offline.'
      );
    }

  } finally {
    // Always reset syncStatus
    await User.findByIdAndUpdate(userId, {
      lastSyncedAt: new Date(),
      syncStatus: results.errors.length > 0 ? 'error' : 'idle',
    }).catch(e => console.error('[RecoverySync] Failed to reset syncStatus:', e.message));
  }

  res.status(200).json({
    success: true,
    synced: results,
    warnings: results.warnings,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// upsertSubmissions — shared helper
//
// Phase 1: bulkWrite upsert to ensure problem documents exist.
// Phase 2: atomic push per-submission gated by submissionId $ne filter
//          (no-op if already present — duplicate-safe, race-condition-free).
// ─────────────────────────────────────────────────────────────────────────────

async function upsertSubmissions(userId, platform, subs) {
  // Phase 1: Ensure problem documents exist
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
              submittedAt:  sub.submittedAt,
              verdict:      sub.verdict,
              language:     sub.language,
              code:         sub.code || '',
              submissionId: String(sub.submissionId),
            }],
            $sort:  { submittedAt: -1 },
            $slice: 200,  // cap per-problem; oldest pruned first
          },
        },
      },
    },
  }));

  await Problem.bulkWrite(pushOps, { ordered: false });
}
