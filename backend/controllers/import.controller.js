/**
 * import.controller.js
 *
 * FIX: Phase 1A now uses $set for difficulty (not just $setOnInsert) so the
 *      ground-truth difficulty from userProgressQuestionList always wins.
 *
 * FIX: Phase 1B $setOnInsert no longer sets difficulty — it only fires on
 *      NEW docs. Existing docs from Phase 1A keep their real difficulty.
 *
 * NEW: repairDifficulty() — one-time endpoint to retroactively fix all
 *      problems stored as 'Medium' by the old hardcoded import bug.
 *      Calls userProgressQuestionList (session-gated) to get real difficulties
 *      and bulk-writes them back to MongoDB.
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
      message: hasSession
        ? 'No problems returned. Session may be expired.'
        : 'No problems via public API. Provide LEETCODE_SESSION for full import.' });
  }

  // FIX: use $set for difficulty/tags so Phase 1A always refreshes ground-truth
  //      data, even for docs already created by an earlier run with wrong 'Medium'.
  const upsertOps = problems.map((p) => ({
    updateOne: {
      filter: { user: userId, platform: 'leetcode', platformProblemId: p.platformProblemId },
      update: {
        $setOnInsert: {
          user: userId, platform: 'leetcode', platformProblemId: p.platformProblemId,
          title: p.title, url: p.link, status: 'Solved', submissions: [],
        },
        // Always overwrite difficulty + tags — these are the ground-truth values
        $set: {
          difficulty: p.difficulty || 'Medium',
          ...(p.tags?.length ? { tags: p.tags } : {}),
          title: p.title,
          url: p.link,
        },
      },
      upsert: true,
    },
  }));

  const bulkResult = await Problem.bulkWrite(upsertOps, { ordered: false });

  await User.findByIdAndUpdate(userId, {
    historyImportStatus: 'partial',
    historyImportCount: problems.length,
    lastHistoryImportAt: new Date(),
  });

  res.status(200).json({
    success: true,
    imported: bulkResult.upsertedCount,
    updated:  bulkResult.modifiedCount,
    total:    problems.length,
    hasSession,
    message: `Imported ${problems.length} solved problems. ${bulkResult.upsertedCount} new, ${bulkResult.modifiedCount} difficulty/tags updated.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Code coverage status
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
  const { acceptedSubmissions, acceptedWithCode } = stats;

  let status = 'none';
  if (totalProblems > 0) {
    if (acceptedSubmissions === 0) status = 'partial';
    else if (acceptedWithCode === 0) status = 'partial';
    else if (acceptedWithCode >= acceptedSubmissions) status = 'full';
    else status = 'mixed';
  }

  res.status(200).json({
    success: true, totalProblems, acceptedSubmissions, acceptedWithCode,
    missingCode: Math.max(0, acceptedSubmissions - acceptedWithCode),
    status,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1B — Submission history WITH code (REST, cursor-based)
// ─────────────────────────────────────────────────────────────────────────────

export const importLeetcodeCode = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user   = await User.findById(userId);

  const handle = parseLeetcodeHandle(user.leetcodeHandle);
  if (!handle) { res.status(400); throw new Error('No valid LeetCode handle set.'); }

  const { sessionCookie, lastKey = '' } = req.body;
  if (!sessionCookie || sessionCookie.trim().length < 10) {
    res.status(400);
    throw new Error('LEETCODE_SESSION is required.');
  }

  console.log(`[Import 1B] REST page lastKey="${lastKey}" for "${handle}"`);

  const { submissions, hasNext, nextKey } = await lc.fetchSubmissionHistoryREST(
    sessionCookie.trim(), lastKey, 20
  );
  console.log(`[Import 1B] fetched=${submissions.length} hasNext=${hasNext} nextKey="${nextKey}"`);

  let totalAttached = 0, totalBackfilled = 0;

  if (submissions.length > 0) {
    // $setOnInsert only — never overwrite difficulty set by Phase 1A
    const upsertOps = submissions.map((sub) => ({
      updateOne: {
        filter: { user: userId, platform: 'leetcode', platformProblemId: sub.platformProblemId },
        update: {
          $setOnInsert: {
            user: userId, platform: 'leetcode', platformProblemId: sub.platformProblemId,
            title: sub.title, url: sub.link,
            // 'Medium' fallback ONLY for docs not yet created by Phase 1A
            difficulty: 'Medium', tags: [], submissions: [],
            status: sub.verdict === 'Accepted' ? 'Solved' : 'Attempted',
          },
        },
        upsert: true,
      },
    }));
    await Problem.bulkWrite(upsertOps, { ordered: false });

    const subsWithCode = submissions.filter(s => s.code && s.code.trim().length > 0);
    if (subsWithCode.length > 0) {
      const backfillOps = subsWithCode.map((sub) => ({
        updateOne: {
          filter: {
            user: userId, platform: 'leetcode', platformProblemId: sub.platformProblemId,
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
          user: userId, platform: 'leetcode', platformProblemId: sub.platformProblemId,
          'submissions.submissionId': { $ne: String(sub.submissionId) },
        },
        update: {
          $push: {
            submissions: {
              $each: [{
                submittedAt: sub.submittedAt, verdict: sub.verdict, language: sub.language,
                code: sub.code || '', submissionId: String(sub.submissionId),
              }],
              $sort: { submittedAt: -1 }, $slice: 200,
            },
          },
        },
      },
    }));
    const r2 = await Problem.bulkWrite(pushOps, { ordered: false });
    totalAttached = r2.modifiedCount;
  }

  await User.findByIdAndUpdate(userId, {
    historyImportStatus: hasNext ? 'partial' : 'full',
    lastHistoryImportAt: new Date(),
  });

  res.status(200).json({
    success: true, fetched: submissions.length, attached: totalAttached,
    backfilled: totalBackfilled, hasMore: hasNext, nextKey,
    message: hasNext
      ? `Page: ${totalAttached} new, ${totalBackfilled} updated. More pages available...`
      : `Pass 1 complete. ${totalAttached} new, ${totalBackfilled} updated.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1C — Per-problem backfill for submissions still missing code
// ─────────────────────────────────────────────────────────────────────────────

export const backfillMissingCode = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { sessionCookie, skip = 0, limit = 10 } = req.body;
  if (!sessionCookie || sessionCookie.trim().length < 10) {
    res.status(400); throw new Error('LEETCODE_SESSION is required.');
  }

  const currentSkip = Number(skip);
  const pageLimit   = Math.min(Number(limit), 20);
  const session     = sessionCookie.trim();

  const needsBackfillFilter = {
    user: userId, platform: 'leetcode',
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
      success: true, processed: 0, filled: 0, skipped: 0, backfilled: 0, total: 0,
      hasMore: false, nextSkip: 0,
      message: 'All submissions already have code — nothing to backfill.',
    });
  }

  const problems = await Problem.find(needsBackfillFilter, { platformProblemId: 1, submissions: 1 })
    .skip(currentSkip).limit(pageLimit).lean();

  let filled = 0, skipped = 0;

  for (const problem of problems) {
    try {
      const result = await lc.fetchBestAcSubmissionForProblem(problem.platformProblemId, session);
      if (!result || !result.code || result.code.trim().length === 0) { skipped++; continue; }

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
      if (updated.modifiedCount > 0) filled++;
      else skipped++;
    } catch (err) {
      console.warn(`[Import 1C] ✗ "${problem.platformProblemId}": ${err.message}`);
      skipped++;
    }
    await new Promise(r => setTimeout(r, 350));
  }

  const processed = problems.length;
  const hasMore   = currentSkip + processed < total;
  await User.findByIdAndUpdate(userId, {
    historyImportStatus: hasMore ? 'partial' : 'full',
    lastHistoryImportAt: new Date(),
  });

  res.status(200).json({
    success: true, processed, filled, skipped, backfilled: filled, total,
    hasMore, nextSkip: currentSkip + processed,
    message: hasMore
      ? `Backfill: ${filled} filled, ${skipped} unavailable. ${total - currentSkip - processed} remaining.`
      : `Backfill complete. ${filled} submissions now have code.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// repairDifficulty — ONE-TIME FIX for existing wrong 'Medium' records
//
// What happened: Phase 1B used to hardcode difficulty: 'Medium' in $setOnInsert.
// If users ran Phase 1B before Phase 1A (or Phase 1A ran without a session so
// it fell back to fetchRecentAcSubmissions which also hardcodes 'Medium'),
// their problems are all stored as 'Medium' regardless of actual difficulty.
//
// This endpoint calls userProgressQuestionList with the user's session to get
// the real difficulty for every solved problem, then bulk-writes the corrections.
// It should be triggered once from the Import modal after re-entering a session.
// ─────────────────────────────────────────────────────────────────────────────

export const repairDifficulty = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user   = await User.findById(userId);

  const handle = parseLeetcodeHandle(user.leetcodeHandle);
  if (!handle) { res.status(400); throw new Error('No LeetCode handle set.'); }

  const { sessionCookie } = req.body;
  if (!sessionCookie || sessionCookie.trim().length < 10) {
    res.status(400);
    throw new Error('LEETCODE_SESSION is required. This repair needs authenticated data to get real difficulties.');
  }

  console.log(`[Repair] Fetching real difficulties for "${handle}"...`);

  // fetchAllSolvedProblems with session uses userProgressQuestionList which
  // returns the real difficulty field for every problem the user has solved.
  const problems = await lc.fetchAllSolvedProblems(handle, sessionCookie.trim());

  if (!problems.length) {
    return res.status(200).json({ success: true, fixed: 0, total: 0,
      message: 'No problems returned — session may be expired or handle incorrect.' });
  }

  // Build a map: titleSlug → real difficulty
  const diffMap = new Map();
  for (const p of problems) {
    if (p.platformProblemId && p.difficulty && p.difficulty !== 'Medium') {
      diffMap.set(p.platformProblemId, p.difficulty);
    }
    // Still include all problems for the update, even Medium ones
    diffMap.set(p.platformProblemId, p.difficulty || 'Medium');
  }

  console.log(`[Repair] Got ${diffMap.size} real difficulties. Building bulk ops...`);

  // Bulk-write: update every leetcode problem for this user with real difficulty
  const ops = [];
  for (const [slug, diff] of diffMap.entries()) {
    ops.push({
      updateOne: {
        filter: { user: userId, platform: 'leetcode', platformProblemId: slug },
        update: { $set: { difficulty: diff } },
      },
    });
  }

  if (!ops.length) {
    return res.status(200).json({ success: true, fixed: 0, total: 0,
      message: 'No operations to perform.' });
  }

  const result = await Problem.bulkWrite(ops, { ordered: false });
  const fixed  = result.modifiedCount;

  console.log(`[Repair] Done. ${fixed}/${ops.length} records updated.`);

  res.status(200).json({
    success: true,
    fixed,
    total: ops.length,
    message: `Difficulty repair complete. Updated ${fixed} of ${ops.length} problems with real LeetCode difficulties.`,
  });
});
