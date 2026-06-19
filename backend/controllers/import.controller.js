/**
 * import.controller.js
 */

import asyncHandler from '../utils/asyncHandler.js';
import Problem from '../models/Problem.js';
import User from '../models/User.js';
import { parseLeetcodeHandle } from '../utils/parseHandle.js';
import * as lc from '../services/leetcodeService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1A — Import solved problem list
// ─────────────────────────────────────────────────────────────────────────────

export const importLeetcodeProblems = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user   = await User.findById(userId);

  const handle = parseLeetcodeHandle(user.leetcodeHandle);
  if (!handle) { res.status(400); throw new Error('No valid LeetCode handle set.'); }

  const { sessionCookie } = req.body;
  const hasSession = sessionCookie && typeof sessionCookie === 'string' && sessionCookie.trim().length > 10;

  console.log(`[Import] Problem list for "${handle}" — session: ${hasSession ? 'yes' : 'no'}`);

  const problems = await lc.fetchAllSolvedProblems(handle, hasSession ? sessionCookie.trim() : null);

  if (problems.length === 0) {
    await User.findByIdAndUpdate(userId, { historyImportStatus: 'partial', lastHistoryImportAt: new Date() });
    return res.status(200).json({ success: true, imported: 0, total: 0,
      message: hasSession ? 'No problems returned. Session may be expired.' : 'No problems via public API. Provide LEETCODE_SESSION.' });
  }

  const upsertOps = problems.map((p) => ({
    updateOne: {
      filter: { user: userId, platform: 'leetcode', platformProblemId: p.platformProblemId },
      update: { $setOnInsert: { user: userId, platform: 'leetcode', platformProblemId: p.platformProblemId,
          title: p.title, url: p.link, difficulty: p.difficulty || 'Medium',
          tags: p.tags || [], status: 'Solved', submissions: [] } },
      upsert: true,
    },
  }));

  const bulkResult = await Problem.bulkWrite(upsertOps, { ordered: false });
  await User.findByIdAndUpdate(userId, { historyImportStatus: 'partial',
    historyImportCount: problems.length, lastHistoryImportAt: new Date() });

  res.status(200).json({ success: true, imported: bulkResult.upsertedCount,
    total: problems.length, hasSession,
    message: `Imported ${problems.length} solved problems. ${bulkResult.upsertedCount} were new.` });
});

// ─────────────────────────────────────────────────────────────────────────────
// Code coverage status — computed live from actual submission data, not from
// the static User.historyImportStatus flag.
//
// WHY THIS EXISTS: historyImportStatus is set unconditionally to 'partial' by
// Step 1 (importLeetcodeProblems) and to 'full' only once Step 2/1C finishes
// every page. It has no idea whether individual problems already have code —
// e.g. from the Chrome extension's live sync, which writes code directly via
// extension.controller.js and never touches historyImportStatus at all.
//
// This endpoint counts, across all of the user's LeetCode problems, how many
// Accepted submissions actually have a non-empty `code` field right now in
// MongoDB. The frontend badge should use this instead of the static enum so
// it always reflects ground truth.
// ─────────────────────────────────────────────────────────────────────────────

export const getCodeCoverageStatus = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const result = await Problem.aggregate([
    { $match: { user: userId, platform: 'leetcode' } },
    { $unwind: { path: '$submissions', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        totalProblems: { $addToSet: '$_id' },
        acceptedSubmissions: {
          $sum: { $cond: [{ $eq: ['$submissions.verdict', 'Accepted'] }, 1, 0] },
        },
        acceptedWithCode: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$submissions.verdict', 'Accepted'] },
                  { $ne: ['$submissions.code', null] },
                  { $ne: ['$submissions.code', ''] },
                ],
              },
              1, 0,
            ],
          },
        },
      },
    },
  ]);

  const stats = result[0] || { totalProblems: [], acceptedSubmissions: 0, acceptedWithCode: 0 };
  const totalProblems = stats.totalProblems.length;
  const acceptedSubmissions = stats.acceptedSubmissions;
  const acceptedWithCode = stats.acceptedWithCode;

  let status = 'none';
  if (totalProblems > 0) {
    if (acceptedSubmissions === 0) status = 'partial';        // problems imported, no submissions yet
    else if (acceptedWithCode === 0) status = 'partial';      // no code at all
    else if (acceptedWithCode >= acceptedSubmissions) status = 'full';
    else status = 'mixed';                                    // some have code, some don't
  }

  res.status(200).json({
    success: true,
    totalProblems,
    acceptedSubmissions,
    acceptedWithCode,
    missingCode: Math.max(0, acceptedSubmissions - acceptedWithCode),
    status, // 'none' | 'partial' | 'mixed' | 'full'
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1B — One page of submission history WITH code (REST, cursor-based)
// FIX 1: Uses fetchSubmissionHistoryREST() not fetchSubmissionHistory().
// FIX 2: Pagination via lastKey cursor string, not integer offset.
// ─────────────────────────────────────────────────────────────────────────────

export const importLeetcodeCode = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user   = await User.findById(userId);

  const handle = parseLeetcodeHandle(user.leetcodeHandle);
  if (!handle) { res.status(400); throw new Error('No valid LeetCode handle set.'); }

  const { sessionCookie, lastKey = '' } = req.body;
  if (!sessionCookie || sessionCookie.trim().length < 10) {
    res.status(400);
    throw new Error('LEETCODE_SESSION is required. Open leetcode.com -> DevTools -> Application -> Cookies -> copy LEETCODE_SESSION.');
  }

  console.log(`[Import 1B] REST page lastKey="${lastKey}" for "${handle}"`);

  const { submissions, hasNext, nextKey } = await lc.fetchSubmissionHistoryREST(
    sessionCookie.trim(), lastKey, 20
  );
  console.log(`[Import 1B] fetched=${submissions.length} hasNext=${hasNext} nextKey="${nextKey}"`);

  let totalAttached = 0, totalBackfilled = 0;

  if (submissions.length > 0) {
    const upsertOps = submissions.map((sub) => ({
      updateOne: {
        filter: { user: userId, platform: 'leetcode', platformProblemId: sub.platformProblemId },
        update: { $setOnInsert: { user: userId, platform: 'leetcode',
            platformProblemId: sub.platformProblemId, title: sub.title, url: sub.link,
            difficulty: 'Medium', tags: [], submissions: [],
            status: sub.verdict === 'Accepted' ? 'Solved' : 'Attempted' } },
        upsert: true,
      },
    }));
    await Problem.bulkWrite(upsertOps, { ordered: false });

    const subsWithCode = submissions.filter(s => s.code && s.code.trim().length > 0);
    console.log(`[Import 1B] ${subsWithCode.length}/${submissions.length} have code`);

    if (subsWithCode.length > 0) {
      const backfillOps = subsWithCode.map((sub) => ({
        updateOne: {
          filter: {
            user: userId, platform: 'leetcode',
            platformProblemId: sub.platformProblemId,
            'submissions.submissionId': String(sub.submissionId),
            'submissions.code': { $in: ['', null] },
          },
          update: { $set: { 'submissions.$[elem].code': sub.code } },
          arrayFilters: [{ 'elem.submissionId': String(sub.submissionId), 'elem.code': { $in: ['', null] } }],
        },
      }));
      const r = await Problem.bulkWrite(backfillOps, { ordered: false });
      totalBackfilled = r.modifiedCount;
    }

    const pushOps = submissions.map((sub) => ({
      updateOne: {
        filter: {
          user: userId, platform: 'leetcode',
          platformProblemId: sub.platformProblemId,
          'submissions.submissionId': { $ne: String(sub.submissionId) },
        },
        update: { $push: { submissions: { $each: [{
              submittedAt: sub.submittedAt, verdict: sub.verdict, language: sub.language,
              code: sub.code || '', submissionId: String(sub.submissionId) }],
            $sort: { submittedAt: -1 }, $slice: 200 } } },
      },
    }));
    const r2 = await Problem.bulkWrite(pushOps, { ordered: false });
    totalAttached = r2.modifiedCount;
    console.log(`[Import 1B] new=${totalAttached} backfilled=${totalBackfilled}`);
  }

  await User.findByIdAndUpdate(userId, {
    historyImportStatus: hasNext ? 'partial' : 'full',
    lastHistoryImportAt: new Date(),
  });

  res.status(200).json({
    success: true,
    fetched: submissions.length,
    attached: totalAttached,
    backfilled: totalBackfilled,
    hasMore: hasNext,
    nextKey,
    message: hasNext
      ? `Page: ${totalAttached} new, ${totalBackfilled} updated. More pages available...`
      : `Pass 1 complete. ${totalAttached} new, ${totalBackfilled} updated.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1C — Per-problem backfill for submissions still missing code after 1B
// FIX 3: Calls lc.fetchBestAcSubmissionForProblem() which EXISTS.
//   Previous version called lc.fetchSubmissionCodePublic() which does NOT exist
//   and caused every backfill call to 500-error with "is not a function".
// FIX 4: Response returns { processed, filled, skipped, total, hasMore, nextSkip }
//   matching what HistoryImport.tsx reads.
// ─────────────────────────────────────────────────────────────────────────────

export const backfillMissingCode = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const { sessionCookie, skip = 0, limit = 10 } = req.body;
  if (!sessionCookie || sessionCookie.trim().length < 10) {
    res.status(400);
    throw new Error('LEETCODE_SESSION is required.');
  }

  const currentSkip = Number(skip);
  const pageLimit   = Math.min(Number(limit), 20);
  const session     = sessionCookie.trim();

  const needsBackfillFilter = {
    user: userId,
    platform: 'leetcode',
    submissions: {
      $elemMatch: {
        verdict: 'Accepted',
        $or: [{ code: '' }, { code: null }, { code: { $exists: false } }],
      },
    },
  };

  const total = await Problem.countDocuments(needsBackfillFilter);

  if (total === 0) {
    return res.status(200).json({
      success: true,
      processed: 0, filled: 0, skipped: 0, backfilled: 0, total: 0,
      hasMore: false, nextSkip: 0,
      message: 'All submissions already have code — nothing to backfill.',
    });
  }

  const problems = await Problem.find(needsBackfillFilter, { platformProblemId: 1, submissions: 1 })
    .skip(currentSkip)
    .limit(pageLimit)
    .lean();

  console.log(`[Import 1C] skip=${currentSkip} limit=${pageLimit} total=${total} batch=${problems.length}`);

  let filled = 0, skipped = 0;

  for (const problem of problems) {
    try {
      const result = await lc.fetchBestAcSubmissionForProblem(problem.platformProblemId, session);

      if (!result || !result.code || result.code.trim().length === 0) {
        console.warn(`[Import 1C] No code for "${problem.platformProblemId}" — purged by LeetCode`);
        skipped++;
        continue;
      }

      const updated = await Problem.updateOne(
        { _id: problem._id },
        { $set: { 'submissions.$[elem].code': result.code } },
        {
          arrayFilters: [{
            'elem.verdict': 'Accepted',
            $or: [{ 'elem.code': '' }, { 'elem.code': null }, { 'elem.code': { $exists: false } }],
          }],
        }
      );

      if (updated.modifiedCount > 0) {
        filled++;
        console.log(`[Import 1C] ✓ "${problem.platformProblemId}": ${result.code.length} chars`);
      } else {
        skipped++;
      }
    } catch (err) {
      console.warn(`[Import 1C] ✗ "${problem.platformProblemId}": ${err.message}`);
      skipped++;
    }

    await new Promise(r => setTimeout(r, 350));
  }

  const processed = problems.length;
  const hasMore   = currentSkip + processed < total;

  console.log(`[Import 1C] processed=${processed} filled=${filled} skipped=${skipped} hasMore=${hasMore}`);

  await User.findByIdAndUpdate(userId, {
    historyImportStatus: hasMore ? 'partial' : 'full',
    lastHistoryImportAt: new Date(),
  });

  res.status(200).json({
    success: true,
    processed,
    filled,
    skipped,
    backfilled: filled,
    total,
    hasMore,
    nextSkip: currentSkip + processed,
    message: hasMore
      ? `Backfill: ${filled} filled, ${skipped} unavailable. ${total - currentSkip - processed} remaining.`
      : `Backfill complete. ${filled} submissions now have code.`,
  });
});
