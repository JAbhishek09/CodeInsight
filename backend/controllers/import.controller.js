/**
 * import.controller.js
 *
 * FIX: Phase 1A now uses $set for difficulty (not just $setOnInsert) so the
 *      ground-truth difficulty from userProgressQuestionList always wins.
 *
 * FIX: Phase 1B $setOnInsert no longer sets difficulty — it only fires on
 *      NEW docs. Existing docs from Phase 1A keep their real difficulty.
 *
 * FIX (July 2026): Phase 1C now uses submission IDs already stored in MongoDB
 *      to call submissionDetails GraphQL directly — the fast path. Previously
 *      it always called the REST per-problem endpoint first, which also has the
 *      code-purge problem for old submissions (same bug as Phase 1B).
 *
 * FIX (July 2026): Phase 1C filter now also catches problems with ZERO
 *      submission records (Phase 1A creates problems with empty submissions[])
 *      so they get backfilled even when Phase 1B's REST cursor didn't reach them.
 *
 * NEW: repairDifficulty() — one-time endpoint to retroactively fix all
 *      problems stored as 'Medium' by the old hardcoded import bug.
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

  const upsertOps = problems.map((p) => ({
    updateOne: {
      filter: { user: userId, platform: 'leetcode', platformProblemId: p.platformProblemId },
      update: {
        $setOnInsert: {
          user: userId, platform: 'leetcode', platformProblemId: p.platformProblemId,
          title: p.title, url: p.link, status: 'Solved', submissions: [],
        },
        $set: {
          difficulty: p.difficulty || 'Medium',
          ...(p.tags?.length ? { tags: p.tags } : {}),
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
//
// NOTE (July 2026): fetchSubmissionHistoryREST now enriches each AC submission
// via submissionDetails GraphQL internally before returning, so the `code`
// field on returned submissions is populated even for old submissions where
// LeetCode's REST endpoint purges the code field.
// ─────────────────────────────────────────────────────────────────────────────

export const importLeetcodeCode = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user   = await User.findById(userId);

  const handle = parseLeetcodeHandle(user.leetcodeHandle);
  if (!handle) { res.status(400); throw new Error('No valid LeetCode handle set.'); }

  const { sessionCookie, offset = 0 } = req.body;
  if (!sessionCookie || sessionCookie.trim().length < 10) {
    res.status(400);
    throw new Error('LEETCODE_SESSION is required.');
  }

  console.log(`[Import 1B] REST offset=${offset} for "${handle}"`);

  const { submissions, hasNext, nextOffset } = await lc.fetchSubmissionHistoryREST(
    sessionCookie.trim(), Number(offset), 20
  );
  console.log(`[Import 1B] fetched=${submissions.length} hasNext=${hasNext} nextOffset=${nextOffset}`);

  let totalAttached = 0, totalBackfilled = 0;

  if (submissions.length > 0) {
    // Upsert problem docs — $setOnInsert only, never overwrite Phase 1A difficulty
    const upsertOps = submissions.map((sub) => ({
      updateOne: {
        filter: { user: userId, platform: 'leetcode', platformProblemId: sub.platformProblemId },
        update: {
          $setOnInsert: {
            user: userId, platform: 'leetcode', platformProblemId: sub.platformProblemId,
            title: sub.title, url: sub.link,
            difficulty: 'Medium', tags: [], submissions: [],
            status: sub.verdict === 'Accepted' ? 'Solved' : 'Attempted',
          },
        },
        upsert: true,
      },
    }));
    await Problem.bulkWrite(upsertOps, { ordered: false });

    // Update code on existing submission records that already exist but have empty code
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

    // Push new submission records (only for submissions not already in the array)
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

  // Surface *why* code enrichment failed, if it did, instead of leaving the
  // caller staring at zeros with no diagnostic path. This was previously
  // only visible in server console logs.
  const acSubsThisPage = submissions.filter(s => s.verdict === 'Accepted').length;
  const acWithCodeThisPage = submissions.filter(s => s.verdict === 'Accepted' && s.code).length;
  const lastError = (acSubsThisPage > 0 && acWithCodeThisPage === 0) ? lc.getLastCodeFetchError() : null;

  res.status(200).json({
    success: true, fetched: submissions.length, attached: totalAttached,
    backfilled: totalBackfilled, hasMore: hasNext, nextOffset,
    ...(lastError ? { codeEnrichmentError: lastError } : {}),
    message: hasNext
      ? `Page: ${totalAttached} new, ${totalBackfilled} updated. More pages available...`
      : `Pass 1 complete. ${totalAttached} new, ${totalBackfilled} updated.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1C — Per-problem backfill for submissions still missing code
//
// FIX (July 2026 — fast path via existing submissionIds):
// Phase 1B now pushes submission records with submissionIds (but possibly empty
// code if submissionDetails GraphQL failed for that ID). Rather than always
// going back to the REST per-problem endpoint (which also returns empty code
// for old submissions), Phase 1C now:
//   1. Checks if the problem already has an AC submission record with a
//      submissionId in MongoDB → calls submissionDetails directly (fast, 1 req)
//   2. Falls back to fetchBestAcSubmissionForProblem for problems with no
//      submission records at all (Phase 1A-only problems, or problems where
//      Phase 1B's REST cursor window didn't reach them)
//
// The filter also now includes problems with status='Solved' but ZERO submission
// records (Phase 1A creates these; Phase 1B may not reach old ones).
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

  // Match problems that still need code:
  //  Case A — has AC submission(s) with empty/null/missing code
  //  Case B — status=Solved but no submission records at all (Phase 1A-only)
  const needsBackfillFilter = {
    user: userId, platform: 'leetcode', status: 'Solved',
    $or: [
      {
        submissions: {
          $elemMatch: {
            verdict: 'Accepted',
            $or: [{ code: '' }, { code: null }, { code: { $exists: false } }],
          },
        },
      },
      { submissions: { $size: 0 } },
      { submissions: { $exists: false } },
    ],
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
      // Fast path: if we already have an AC submissionId in MongoDB, call
      // submissionDetails directly — 1 GraphQL request, no REST discovery needed.
      const existingAcSub = (problem.submissions ?? []).find(s =>
        s.verdict === 'Accepted' &&
        s.submissionId &&
        String(s.submissionId).length > 0 &&
        (!s.code || s.code.trim().length === 0)
      );

      let result = null;

      if (existingAcSub?.submissionId) {
        console.log(`[Import 1C] Fast path: submissionDetails for ${existingAcSub.submissionId} ("${problem.platformProblemId}")`);
        const code = await lc.fetchSubmissionCodeById(existingAcSub.submissionId, session);
        if (code && code.trim().length > 0) {
          result = { submissionId: String(existingAcSub.submissionId), code, verdict: 'Accepted' };
        } else {
          console.warn(`[Import 1C] submissionDetails empty for ${existingAcSub.submissionId} — trying discovery`);
        }
      }

      // Slow path: no usable submissionId in MongoDB — discover via REST + submissionDetails
      if (!result) {
        result = await lc.fetchBestAcSubmissionForProblem(problem.platformProblemId, session);
      }

      if (!result || !result.code || result.code.trim().length === 0) {
        skipped++;
        continue;
      }

      // Write the code back to MongoDB
      let updated;
      const targetId = result.submissionId || existingAcSub?.submissionId;

      if (targetId) {
        // Target the specific submission record by ID (positional $ operator)
        updated = await Problem.updateOne(
          { _id: problem._id, 'submissions.submissionId': String(targetId) },
          { $set: { 'submissions.$.code': result.code } }
        );
        // If that record wasn't found (ID mismatch), fall back to updating any empty AC sub
        if (updated.modifiedCount === 0) {
          updated = await Problem.updateOne(
            { _id: problem._id },
            { $set: { 'submissions.$[elem].code': result.code } },
            {
              arrayFilters: [{
                'elem.verdict': 'Accepted',
                $or: [{ 'elem.code': '' }, { 'elem.code': null }, { 'elem.code': { $exists: false } }],
              }],
            }
          );
        }
      } else {
        // No submissionId at all — push a brand new submission record
        updated = await Problem.updateOne(
          { _id: problem._id },
          {
            $push: {
              submissions: {
                $each: [{
                  submittedAt:  result.submittedAt ?? new Date(),
                  verdict:      'Accepted',
                  language:     result.language ?? '',
                  code:         result.code,
                  submissionId: String(result.submissionId ?? ''),
                }],
                $sort: { submittedAt: -1 },
                $slice: 200,
              },
            },
          }
        );
      }

      if (updated.modifiedCount > 0) filled++;
      else skipped++;

    } catch (err) {
      console.warn(`[Import 1C] ✗ "${problem.platformProblemId}": ${err.message}`);
      skipped++;
    }

    // Randomised delay — each iteration makes 1-2 LeetCode requests (fast path = 1)
    const baseDelay = 400;
    const jitter = baseDelay * 0.4 * (Math.random() * 2 - 1);
    await new Promise(r => setTimeout(r, baseDelay + jitter));
  }

  const processed = problems.length;
  const hasMore   = currentSkip + processed < total;
  await User.findByIdAndUpdate(userId, {
    historyImportStatus: hasMore ? 'partial' : 'full',
    lastHistoryImportAt: new Date(),
  });

  const backfillError = (filled === 0 && skipped > 0) ? lc.getLastCodeFetchError() : null;

  res.status(200).json({
    success: true, processed, filled, skipped, backfilled: filled, total,
    hasMore, nextSkip: currentSkip + processed,
    ...(backfillError ? { codeEnrichmentError: backfillError } : {}),
    message: hasMore
      ? `Backfill: ${filled} filled, ${skipped} unavailable. ${total - currentSkip - processed} remaining.`
      : `Backfill complete. ${filled} submissions now have code.`,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// repairDifficulty — ONE-TIME FIX for existing wrong 'Medium' records
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
  const problems = await lc.fetchAllSolvedProblems(handle, sessionCookie.trim());

  if (!problems.length) {
    return res.status(200).json({ success: true, fixed: 0, total: 0,
      message: 'No problems returned — session may be expired or handle incorrect.' });
  }

  const diffMap = new Map();
  for (const p of problems) {
    diffMap.set(p.platformProblemId, p.difficulty || 'Medium');
  }

  console.log(`[Repair] Got ${diffMap.size} real difficulties. Building bulk ops...`);
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
    return res.status(200).json({ success: true, fixed: 0, total: 0, message: 'No operations to perform.' });
  }

  const result = await Problem.bulkWrite(ops, { ordered: false });
  const fixed  = result.modifiedCount;

  console.log(`[Repair] Done. ${fixed}/${ops.length} records updated.`);
  res.status(200).json({
    success: true, fixed, total: ops.length,
    message: `Difficulty repair complete. Updated ${fixed} of ${ops.length} problems with real LeetCode difficulties.`,
  });
});
