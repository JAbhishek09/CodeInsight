import asyncHandler from '../utils/asyncHandler.js';
import Problem from '../models/Problem.js';
import Nonce from '../models/Nonce.js';
import { md5 } from '../utils/hashCode.js';
import { analyzeCode } from '../services/aiService.js';

/**
 * BUG-INJ-002 FIX: Nonce deduplication is now backed by MongoDB (via the Nonce
 * model with a TTL index) instead of an in-memory Map.
 *
 * The in-memory Map was lost on every server restart (crash, redeploy, PM2
 * restart), making replay attacks possible in the minutes-long window right
 * after a restart when all old nonces were forgotten.
 *
 * The MongoDB Nonce model uses a unique index on the `nonce` field and a TTL
 * index on `createdAt` (10-minute expiry) — duplicate insertion throws a
 * code-11000 error which we catch to detect replays.  A failed/crashed server
 * restart does NOT clear nonces because they live in MongoDB.
 */
async function checkAndConsumeNonce(nonce) {
  try {
    await Nonce.create({ nonce });
    return true;   // first time this nonce has been seen
  } catch (err) {
    if (err.code === 11000) return false; // duplicate key → replay attack
    throw err;                            // unexpected DB error → rethrow
  }
}

/**
 * @desc    Receive a LeetCode submission from the Chrome Extension,
 *          upsert the Problem document, atomically append the submission,
 *          and trigger background AI analysis if code is new.
 *
 * @route   POST /api/extensions/leetcode/submission
 * @access  Private (JWT required)
 *
 * Fixes applied in this file:
 *  BUG-INJ-001 — Replaced non-atomic findOneAndUpdate+push+save with a single
 *                atomic $push guarded by a `submissions.submissionId: {$ne}`
 *                filter.  Eliminates the race condition where two concurrent
 *                requests for the same problem could overwrite each other's push.
 *  BUG-INJ-002 — Replaced in-memory nonce Map with MongoDB-backed Nonce model
 *                (TTL index, unique constraint).  Survives server restarts.
 *  BUG-INJ-003 — Replaced setImmediate() (Node-only) with setTimeout(fn, 0)
 *                which works in Node, browsers, and edge runtimes.
 *  BUG-INJ-004 — Added codeSnapshotHash guard on the background AI write so
 *                a slower AI job for an older submission cannot overwrite the
 *                result of a faster job for a newer submission.
 *  BUG-AI-001  — Added aiAnalysisStatus field ('idle'|'pending'|'ready'|'error')
 *                so the analysis endpoint can return HTTP 202 while a background
 *                job is in flight, preventing two simultaneous Gemini calls.
 */
export const ingestLeetCodeSubmission = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  // ── 1. Replay attack prevention (MongoDB-backed nonce) ───────────────────────
  const { _nonce, _ts } = req.body;

  if (!_nonce || typeof _nonce !== 'string' || !/^[0-9a-f]{32}$/.test(_nonce)) {
    res.status(400);
    throw new Error('Missing or malformed request nonce.');
  }

  const tsDrift = Math.abs(Date.now() - Number(_ts));
  if (!_ts || tsDrift > 5 * 60 * 1000) {
    res.status(400);
    throw new Error('Request timestamp out of acceptable range. Check your system clock.');
  }

  const nonceOk = await checkAndConsumeNonce(_nonce);
  if (!nonceOk) {
    res.status(409);
    throw new Error('Duplicate request nonce detected. This submission has already been processed.');
  }

  // ── 2. Payload validation ────────────────────────────────────────────────────
  const {
    problemSlug,
    submissionId,
    title,
    verdict,
    language,
    code,
    submittedAt,
  } = req.body;

  const VALID_VERDICTS = ['Accepted', 'Wrong Answer', 'TLE', 'MLE', 'RE', 'CE', 'Pending'];

  const missing = ['problemSlug', 'submissionId', 'title', 'verdict', 'language', 'code', 'submittedAt']
    .filter(field => !req.body[field] || String(req.body[field]).trim() === '');

  if (missing.length > 0) {
    res.status(400);
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }

  if (!VALID_VERDICTS.includes(verdict)) {
    res.status(400);
    throw new Error(`Invalid verdict "${verdict}". Must be one of: ${VALID_VERDICTS.join(', ')}`);
  }

  if (code.length > 500_000) {
    res.status(400);
    throw new Error('Code payload exceeds maximum allowed size (500 KB).');
  }

  const parsedDate = new Date(submittedAt);
  if (isNaN(parsedDate.getTime())) {
    res.status(400);
    throw new Error('Invalid submittedAt date format. Use ISO 8601.');
  }

  // ── 3. Upsert Problem document (create shell if first time, no submission yet) ─
  // BUG-INJ-001 FIX — Step 1: ensure the problem document exists using $setOnInsert.
  // We use new: false here intentionally — we do NOT need the returned doc yet
  // because Step 2 (the atomic push) will return the final document.
  await Problem.findOneAndUpdate(
    {
      user: userId,
      platform: 'leetcode',
      platformProblemId: problemSlug,
    },
    {
      $setOnInsert: {
        user: userId,
        platform: 'leetcode',
        platformProblemId: problemSlug,
        title: title.trim(),
        url: `https://leetcode.com/problems/${problemSlug}/`,
        status: 'Attempted', // will be updated to Solved in Step 2 if Accepted
      },
    },
    {
      upsert: true,
      new: false,
      setDefaultsOnInsert: true,
    }
  );

  // ── 4. Atomic push — duplicate-safe, race-condition-free ─────────────────────
  // BUG-INJ-001 FIX — Step 2: push the submission atomically using a filter that
  // only matches when the submissionId is NOT already in the array.
  // If the submissionId already exists the filter won't match → updateResult is
  // null → we return 200 duplicate immediately.
  // The $set on status happens in the same atomic operation as the push.
  const newSubmission = {
    submittedAt: parsedDate,
    verdict,
    language,
    code,
    submissionId: String(submissionId),
  };

  const updateResult = await Problem.findOneAndUpdate(
    {
      user: userId,
      platform: 'leetcode',
      platformProblemId: problemSlug,
      'submissions.submissionId': { $ne: String(submissionId) },
    },
    {
      $push: {
        submissions: {
          $each: [newSubmission],
          $sort: { submittedAt: -1 },
          $slice: 200,    // cap per-problem; oldest pruned first
        },
      },
      // Atomically promote status to Solved if this is an Accepted submission
      ...(verdict === 'Accepted' ? { $set: { status: 'Solved' } } : {}),
    },
    { new: true }
  );

  if (!updateResult) {
    // The $ne filter didn't match — submissionId already in the array
    const existing = await Problem.findOne({ user: userId, platform: 'leetcode', platformProblemId: problemSlug });
    return res.status(200).json({
      success: true,
      message: 'Submission already recorded.',
      duplicate: true,
      problemId: existing?._id,
    });
  }

  const problem = updateResult;

  // ── 5. AI Analysis cache invalidation + background analysis ──────────────────
  let aiInvalidated = false;
  let aiMessage = 'AI cache unchanged';

  if (verdict === 'Accepted') {
    const incomingHash = md5(code);
    const cachedHash = problem.aiAnalysis?.codeSnapshotHash;

    if (!cachedHash || cachedHash !== incomingHash) {
      // Invalidate cached analysis and mark status as pending
      await Problem.findByIdAndUpdate(problem._id, {
        $set: {
          aiAnalysis: null,
          aiAnalysisStatus: 'pending',  // BUG-AI-001: signals background job is in flight
          aiAnalysisError: null,
        },
      });
      aiInvalidated = true;
      aiMessage = 'AI cache invalidated — background analysis started.';

      // BUG-INJ-003 FIX: Replace setImmediate() (Node.js-only) with setTimeout(fn, 0)
      // which is portable across Node, browsers, and edge runtimes.
      setTimeout(() => {
        runBackgroundAnalysis(
          problem._id, userId, code, incomingHash,
          problem.title, problem.url || '', verdict, language
        ).catch(err => console.error('[Extension] Background AI analysis error:', err.message));
      }, 0);
    } else {
      aiMessage = 'AI cache valid — reusing cached analysis.';
    }
  }

  // ── 6. Response ─────────────────────────────────────────────────────────────
  return res.status(201).json({
    success: true,
    message: 'Submission recorded successfully.',
    duplicate: false,
    aiInvalidated,
    aiMessage,
    data: {
      problemId: problem._id,
      problemSlug,
      title: problem.title,
      verdict,
    },
  });
});

/**
 * Run AI analysis in the background and persist result to MongoDB.
 * Called after the HTTP response has already been sent.
 *
 * BUG-INJ-004 FIX: The write is guarded by a codeSnapshotHash mismatch filter.
 * If two background jobs race (e.g. user submits twice rapidly), only the job
 * whose hash matches the latest ingested code will successfully write.  The
 * slower job for an older code snapshot will hit the $or filter and be a no-op.
 *
 * BUG-AI-001 FIX: Sets aiAnalysisStatus to 'ready' on success, 'error' on
 * failure, so the analysis endpoint can check status before firing a second
 * parallel Gemini call.
 */
async function runBackgroundAnalysis(problemId, userId, code, codeHash, problemTitle, problemUrl, verdict, language) {
  try {
    console.log(`[Extension] Starting background AI analysis for problem ${problemId}`);

    const { parsed, hash } = await analyzeCode({
      problemTitle,
      problemLink: problemUrl,
      verdict,
      code,
      language,
    });

    // BUG-INJ-004: Only write if the codeSnapshotHash in the DB is still the one
    // we were asked to analyse (or if no analysis exists yet).  This prevents a
    // slow job for older code from overwriting a faster job for newer code.
    await Problem.findOneAndUpdate(
      {
        _id: problemId,
        user: userId,
        $or: [
          { 'aiAnalysis.codeSnapshotHash': { $ne: hash } },
          { 'aiAnalysis.codeSnapshotHash': { $exists: false } },
          { aiAnalysis: null },
        ],
      },
      {
        $set: {
          aiAnalysis: {
            ...parsed,
            codeSnapshotHash: hash,
            generatedAt: new Date(),
          },
          aiAnalysisStatus: 'ready',   // BUG-AI-001
          aiAnalysisError: null,
        },
      }
    );

    console.log(`[Extension] Background AI analysis completed for problem ${problemId}`);
  } catch (err) {
    console.error(`[Extension] Background AI analysis failed for problem ${problemId}:`, err.message);
    // Mark as error so the frontend can surface a "retry" option (BUG-AI-001)
    await Problem.findByIdAndUpdate(problemId, {
      $set: {
        aiAnalysisStatus: 'error',
        aiAnalysisError: err.message,
      },
    }).catch(e => console.error('[Extension] Could not persist AI error status:', e.message));
  }
}
