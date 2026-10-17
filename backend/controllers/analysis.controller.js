import asyncHandler from '../utils/asyncHandler.js';
import Problem from '../models/Problem.js';
import { md5 } from '../utils/hashCode.js';
import { analyzeCode } from '../services/aiService.js';

// A 'pending' analysis older than this is assumed lost (e.g. server restart).
const PENDING_STALE_MS = 3 * 60 * 1000;

/**
 * @desc    Trigger AI analysis for a problem (cache-aware, status-aware)
 * @route   POST /api/analyze/:id
 * @access  Private
 *
 * BUG-AI-001 FIX: Added aiAnalysisStatus check before calling the LLM.
 *
 * The previous version had a race condition:
 *  1. User submits via extension → extension.controller invalidates aiAnalysis=null
 *     and starts a background Gemini job (takes ~3–5 s).
 *  2. User immediately opens the analysis page.
 *  3. This controller sees aiAnalysis=null, assumes no analysis exists, and fires
 *     a second Gemini call WHILE the background job is still running.
 *  4. Two simultaneous Gemini calls for the same code: wasted API quota, and
 *     whichever write finishes last wins (non-deterministic).
 *
 * Fix: extension.controller now sets aiAnalysisStatus='pending' before starting
 * the background job.  This controller checks that field:
 *  - 'pending' → return HTTP 202 so the frontend can poll (unless stale).
 *  - 'ready'   → check cache hash; return cached result if hash matches.
 *  - 'error'   → cache miss path; call LLM synchronously (user explicitly asked).
 *  - 'idle'    → cache miss path; call LLM synchronously.
 */
export const triggerAnalysis = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const problem = await Problem.findOne({ _id: req.params.id, user: userId });

  if (!problem) {
    res.status(404);
    throw new Error('Problem not found');
  }

  // Find the most recent submission that has actual code
  const latestWithCode = [...problem.submissions]
    .sort((a, b) => b.submittedAt - a.submittedAt)
    .find((s) => s.code?.trim().length > 0);

  if (!latestWithCode) {
    res.status(400);
    throw new Error(
      'No code available for this problem. ' +
      'LeetCode public API does not return code; provide a LEETCODE_SESSION cookie or add code manually.'
    );
  }

  // Cache check: if the same code was already analysed successfully, return cached result
  const currentHash = md5(latestWithCode.code);

  if (
    problem.aiAnalysisStatus === 'ready' &&
    problem.aiAnalysis &&
    problem.aiAnalysis.codeSnapshotHash === currentHash
  ) {
    return res.status(200).json({
      success: true,
      fromCache: true,
      analysis: problem.aiAnalysis,
    });
  }

  // BUG-AI-001: Atomically claim the analysis slot. If a job is already in flight
  // (and not stale — e.g. lost to a server restart), tell the client to poll
  // instead of firing a second parallel Gemini call.
  const staleCutoff = new Date(Date.now() - PENDING_STALE_MS);
  const claimed = await Problem.findOneAndUpdate(
    {
      _id: problem._id,
      user: userId,
      $or: [
        { aiAnalysisStatus: { $ne: 'pending' } },
        { aiAnalysisPendingSince: null },
        { aiAnalysisPendingSince: { $lt: staleCutoff } },
      ],
    },
    {
      $set: {
        aiAnalysisStatus: 'pending',
        aiAnalysisError: null,
        aiAnalysisPendingHash: currentHash,
        aiAnalysisPendingSince: new Date(),
      },
    },
    { new: true }
  );

  if (!claimed) {
    return res.status(202).json({
      success: true,
      pending: true,
      message: 'AI analysis is being generated in the background. Please check back in a few seconds.',
    });
  }

  // Cache miss (status is 'idle', 'error', stale, or hash has changed) — call the LLM
  let parsed, hash;
  try {
    ({ parsed, hash } = await analyzeCode({
      problemTitle: problem.title,
      problemLink: problem.url || '',
      verdict: latestWithCode.verdict,
      code: latestWithCode.code,
      language: latestWithCode.language,
    }));
  } catch (err) {
    await Problem.updateOne(
      { _id: problem._id, aiAnalysisPendingHash: currentHash },
      { $set: { aiAnalysisStatus: 'error', aiAnalysisError: err.message, aiAnalysisPendingHash: null, aiAnalysisPendingSince: null } }
    ).catch(() => {});
    throw err;
  }

  // Persist analysis and mark as ready (no-op if a newer job superseded this one)
  const aiAnalysis = { ...parsed, codeSnapshotHash: hash, generatedAt: new Date() };
  const updated = await Problem.findOneAndUpdate(
    { _id: problem._id, aiAnalysisPendingHash: currentHash },
    {
      $set: {
        aiAnalysis,
        aiAnalysisStatus: 'ready',
        aiAnalysisError: null,
        aiAnalysisPendingHash: null,
        aiAnalysisPendingSince: null,
      },
    },
    { new: true }
  );

  res.status(200).json({
    success: true,
    fromCache: false,
    analysis: updated?.aiAnalysis ?? aiAnalysis,
  });
});
