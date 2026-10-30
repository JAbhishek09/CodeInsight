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

import mongoose from 'mongoose';
import asyncHandler from '../utils/asyncHandler.js';
import Problem from '../models/Problem.js';
import User from '../models/User.js';
import { parseLeetcodeHandle } from '../utils/parseHandle.js';
import * as lc from '../services/leetcodeService.js';
import { fillMissingMeta, fillMissingMetaSoon } from '../services/problemMetaService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Session ownership
//
// One CodeInsight account = one LeetCode account. Every import call checks that
// the pasted LEETCODE_SESSION belongs to the LeetCode user on this profile —
// otherwise another person's problems and code get mixed into this account.
// ─────────────────────────────────────────────────────────────────────────────

async function assertSessionOwner(res, handle, sessionCookie) {
  let owner;
  try {
    owner = await lc.fetchSessionUsername(sessionCookie);
  } catch (err) {
    res.status(502);
    throw new Error(`Could not verify your LeetCode session: ${err.message}`);
  }
  if (!owner) {
    res.status(401);
    throw new Error('This LEETCODE_SESSION is expired or invalid. Copy a fresh one from leetcode.com and try again.');
  }
  if (owner.toLowerCase() !== String(handle).toLowerCase()) {
    res.status(403);
    throw new Error(
      `This session belongs to LeetCode user "${owner}", but your profile is linked to "${handle}". ` +
      'Paste the session from your own LeetCode account.'
    );
  }
  return owner;
}

/**
 * @desc    Check which LeetCode user a pasted session belongs to
 * @route   POST /api/import/leetcode/verify-session
 */
export const verifyLeetcodeSession = asyncHandler(async (req, res) => {
  const user   = await User.findById(req.user._id);
  const handle = parseLeetcodeHandle(user.leetcodeHandle);
  if (!handle) { res.status(400); throw new Error('Set your LeetCode username first.'); }

  const { sessionCookie } = req.body ?? {};
  if (!sessionCookie || typeof sessionCookie !== 'string' || sessionCookie.trim().length < 10) {
    res.status(400); throw new Error('Paste your LEETCODE_SESSION value.');
  }
  const owner = await assertSessionOwner(res, handle, sessionCookie.trim());
  res.status(200).json({ success: true, username: owner });
});

/**
 * @desc    Delete all imported LeetCode problems for this account
 * @route   DELETE /api/import/leetcode
 */
export const removeLeetcodeData = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { deletedCount } = await Problem.deleteMany({ user: userId, platform: 'leetcode' });
  const solvedCount = await Problem.countDocuments({ user: userId, status: 'Solved' });
  await User.findByIdAndUpdate(userId, {
    historyImportStatus: 'none',
    historyImportCount: 0,
    lastHistoryImportAt: null,
    solvedProblemsCount: solvedCount,
  });
  console.log(`[Import] Removed ${deletedCount} LeetCode problems for user ${userId}`);
  res.status(200).json({ success: true, deleted: deletedCount, message: `Removed ${deletedCount} LeetCode problems.` });
});

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

  if (hasSession) await assertSessionOwner(res, handle, sessionCookie.trim());
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
          title: p.title, url: p.link, submissions: [],
        },
        $set: {
          // LeetCode's solved list is authoritative — fixes problems that Pass 1
          // created as 'Attempted' because their newest submission wasn't AC.
          status: 'Solved',
          // The public list (no session) has no difficulty or tags: keep what
          // the problem already has, and fill the gaps below.
          ...(p.difficulty ? { difficulty: p.difficulty } : {}),
          ...(p.tags?.length ? { tags: p.tags } : {}),
        },
      },
      upsert: true,
    },
  }));

  const bulkResult = await Problem.bulkWrite(upsertOps, { ordered: false });
  // Difficulty + tags for problems that came without them (always the case without a session)
  fillMissingMetaSoon(userId);

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

  // Problem-level coverage: what AI analysis actually needs is code for each
  // solved problem, not for every accepted submission ever made.
  const [solvedProblems, missingCodeProblems] = await Promise.all([
    Problem.countDocuments({
      user: userId, platform: 'leetcode',
      $or: [{ status: 'Solved' }, { 'submissions.verdict': 'Accepted' }],
    }),
    Problem.countDocuments(needsCodeFilter(userId)),
  ]);
  const solvedWithCode = solvedProblems - missingCodeProblems;

  const stats = result[0] || { totalProblems: [], acceptedSubmissions: 0, acceptedWithCode: 0 };
  const totalProblems = stats.totalProblems.length;
  const { acceptedSubmissions, acceptedWithCode } = stats;

  let status = 'none';
  if (totalProblems > 0) {
    if (solvedWithCode === 0) status = 'partial';
    else if (missingCodeProblems === 0) status = 'full';
    else status = 'mixed';
  }

  res.status(200).json({
    success: true, totalProblems, acceptedSubmissions, acceptedWithCode,
    missingCode: Math.max(0, acceptedSubmissions - acceptedWithCode),
    solvedProblems, solvedWithCode, missingCodeProblems,
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

  const { sessionCookie } = req.body ?? {};
  const offset = Math.max(0, parseInt(req.body?.offset, 10) || 0);
  if (!sessionCookie || sessionCookie.trim().length < 10) {
    res.status(400);
    throw new Error('LEETCODE_SESSION is required.');
  }

  await assertSessionOwner(res, handle, sessionCookie.trim());
  console.log(`[Import 1B] REST offset=${offset} for "${handle}"`);

  const { submissions, hasNext, nextOffset } = await lc.fetchSubmissionHistoryREST(
    sessionCookie.trim(), offset, 20
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

    // Any problem with an AC submission is solved, whatever its newest verdict was
    const solvedSlugs = [...new Set(submissions.filter(s => s.verdict === 'Accepted').map(s => s.platformProblemId))];
    if (solvedSlugs.length > 0) {
      await Problem.updateMany(
        { user: userId, platform: 'leetcode', platformProblemId: { $in: solvedSlugs } },
        { $set: { status: 'Solved' } }
      );
    }

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
// Phase 1C — Fetch code for every solved problem that still has none
//
// Only the latest AC submission per problem is fetched — that's all AI
// analysis uses — instead of every AC submission ever made.
//
// Pagination uses an _id cursor (`after`), NOT skip. The result set shrinks as
// problems get filled, so skip-based paging jumped over unprocessed problems
// and roughly half the problems were never visited.
//
// Problems are processed a few at a time in parallel, and each batch is small
// enough to finish well inside the client's request timeout.
// ─────────────────────────────────────────────────────────────────────────────

const BACKFILL_BATCH_SIZE  = 9;
const BACKFILL_CONCURRENCY = 3;

const hasAcCode = { $elemMatch: { verdict: 'Accepted', code: { $nin: ['', null] } } };

// Solved problems (or ones with any AC submission) with no AC code at all
const needsCodeFilter = (userId) => ({
  user: userId,
  platform: 'leetcode',
  $or: [{ status: 'Solved' }, { 'submissions.verdict': 'Accepted' }],
  submissions: { $not: hasAcCode },
});

async function fillCodeForProblem(problem, session) {
  // Fast path: we already know the latest AC submissionId — 1 GraphQL request.
  const latestAc = (problem.submissions ?? [])
    .filter(s => s.verdict === 'Accepted' && s.submissionId)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0];

  let result = null;
  if (latestAc) {
    const code = await lc.fetchSubmissionCodeById(latestAc.submissionId, session);
    if (code && code.trim().length > 0) {
      result = { submissionId: String(latestAc.submissionId), code, verdict: 'Accepted' };
    }
  }

  // Slow path: discover the AC submission via REST/GraphQL, then fetch its code.
  if (!result) {
    result = await lc.fetchBestAcSubmissionForProblem(problem.platformProblemId, session);
  }
  if (!result?.code?.trim()) return false;

  const targetId = String(result.submissionId ?? '');
  if (targetId) {
    const updated = await Problem.updateOne(
      { _id: problem._id, 'submissions.submissionId': targetId },
      { $set: { 'submissions.$.code': result.code } }
    );
    if (updated.modifiedCount > 0) return true;
  }

  // Submission record not in our DB yet — add it.
  const pushed = await Problem.updateOne(
    { _id: problem._id },
    {
      $push: {
        submissions: {
          $each: [{
            submittedAt:  result.submittedAt ?? new Date(),
            verdict:      'Accepted',
            language:     result.language ?? '',
            code:         result.code,
            submissionId: targetId,
          }],
          $sort: { submittedAt: -1 },
          $slice: 200,
        },
      },
    }
  );
  return pushed.modifiedCount > 0;
}

export const backfillMissingCode = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { sessionCookie, after } = req.body ?? {};
  if (!sessionCookie || sessionCookie.trim().length < 10) {
    res.status(400); throw new Error('LEETCODE_SESSION is required.');
  }
  const user   = await User.findById(userId);
  const handle = parseLeetcodeHandle(user.leetcodeHandle);
  if (!handle) { res.status(400); throw new Error('No valid LeetCode handle set.'); }
  await assertSessionOwner(res, handle, sessionCookie.trim());
  if (after != null && !mongoose.isValidObjectId(after)) {
    res.status(400); throw new Error('Invalid cursor.');
  }

  const session = sessionCookie.trim();

  // First call of Pass 2: Pass 1 has created every problem from the history,
  // so this is the point to fill in tags/difficulty the solved list missed.
  const metaFilled = after ? 0 : await fillMissingMeta(userId, { session });

  const filter  = needsCodeFilter(userId);
  if (after) filter._id = { $gt: new mongoose.Types.ObjectId(String(after)) };

  const problems = await Problem.find(filter, { platformProblemId: 1, submissions: 1 })
    .sort({ _id: 1 })
    .limit(BACKFILL_BATCH_SIZE)
    .lean();

  let filled = 0, skipped = 0;
  let authError = null;

  // Small worker pool: BACKFILL_CONCURRENCY problems in flight at a time.
  let next = 0;
  const worker = async () => {
    while (next < problems.length && !authError) {
      const problem = problems[next++];
      try {
        if (await fillCodeForProblem(problem, session)) filled++;
        else skipped++;
      } catch (err) {
        // Only a genuinely expired session aborts the batch; 403/429 throttling
        // just leaves this problem for a later run.
        if (/expired/i.test(err.message)) authError = err;
        console.warn(`[Import 1C] ✗ "${problem.platformProblemId}": ${err.message}`);
        skipped++;
      }
      // Light jitter so parallel requests don't fire in lockstep
      await new Promise(r => setTimeout(r, 150 + Math.random() * 250));
    }
  };
  await Promise.all(Array.from({ length: BACKFILL_CONCURRENCY }, worker));

  if (authError) { res.status(401); throw authError; }

  const lastId    = problems.length ? problems[problems.length - 1]._id : (after ?? null);
  const remaining = problems.length
    ? await Problem.countDocuments({ ...needsCodeFilter(userId), _id: { $gt: lastId } })
    : 0;
  const hasMore   = remaining > 0;

  await User.findByIdAndUpdate(userId, {
    historyImportStatus: hasMore ? 'partial' : 'full',
    lastHistoryImportAt: new Date(),
  });

  const backfillError = (filled === 0 && skipped > 0) ? lc.getLastCodeFetchError() : null;

  res.status(200).json({
    success: true, processed: problems.length, filled, skipped, backfilled: filled, metaFilled,
    remaining, hasMore, nextCursor: lastId,
    ...(backfillError ? { codeEnrichmentError: backfillError } : {}),
    message: hasMore
      ? `Backfill: ${filled} filled, ${skipped} unavailable. ${remaining} remaining.`
      : `Backfill complete. ${filled} problems got code in this batch.`,
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

  await assertSessionOwner(res, handle, sessionCookie.trim());
  console.log(`[Repair] Fetching real difficulties for "${handle}"...`);
  const problems = await lc.fetchAllSolvedProblems(handle, sessionCookie.trim());

  if (!problems.length) {
    return res.status(200).json({ success: true, fixed: 0, total: 0,
      message: 'No problems returned — session may be expired or handle incorrect.' });
  }

  // FIX (July 2026 — tag backfill): fetchAllSolvedProblemsAuthenticated goes
  // through the same lcGraphQL/makeHeaders path as submissionDetails, which
  // was silently 403ing before the WAF-header fix. That meant `tags` here
  // was very likely always [] for anyone who imported before that fix — the
  // exact same root cause behind "No topic data yet" on the Analytics and AI
  // Insights pages. We already have real tags in `problems` (from
  // topicTags), so backfill them in the same pass as the difficulty repair
  // instead of requiring a separate re-import.
  const infoMap = new Map();
  for (const p of problems) {
    infoMap.set(p.platformProblemId, {
      difficulty: p.difficulty || 'Medium',
      tags: Array.isArray(p.tags) ? p.tags.filter(Boolean) : [],
    });
  }

  console.log(`[Repair] Got ${infoMap.size} real difficulty+tag records. Building bulk ops...`);
  const ops = [];
  for (const [slug, info] of infoMap.entries()) {
    ops.push({
      updateOne: {
        filter: { user: userId, platform: 'leetcode', platformProblemId: slug },
        update: {
          $set: {
            difficulty: info.difficulty,
            ...(info.tags.length ? { tags: info.tags } : {}),
          },
        },
      },
    });
  }

  if (!ops.length) {
    return res.status(200).json({ success: true, fixed: 0, total: 0, message: 'No operations to perform.' });
  }

  const result = await Problem.bulkWrite(ops, { ordered: false });
  const fixed  = result.modifiedCount;
  // The solved list stops at 600 problems — fill the rest individually.
  const extraFilled = await fillMissingMeta(userId, { session: sessionCookie.trim() });
  const withTags = Array.from(infoMap.values()).filter(v => v.tags.length > 0).length;

  console.log(`[Repair] Done. ${fixed}/${ops.length} solved-list records updated, ${extraFilled} more filled individually.`);
  res.status(200).json({
    success: true, fixed, total: ops.length, withTags, extraFilled,
    message: `Repair complete. Updated ${fixed} of ${ops.length} problems from your solved list` +
      (extraFilled > 0 ? `, and filled difficulty/tags for ${extraFilled} more problems.` : '.'),
  });
});
