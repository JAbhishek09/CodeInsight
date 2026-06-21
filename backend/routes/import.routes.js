/**
 * import.routes.js
 *
 * POST /api/import/leetcode/problems       — full AC problem list (session optional but recommended)
 * POST /api/import/leetcode/code           — paginated submission code (session required)
 * POST /api/import/leetcode/backfill       — per-problem backfill for problems still missing code
 * GET  /api/import/leetcode/code-status    — live code coverage stats
 * POST /api/import/leetcode/repair-difficulty — ONE-TIME repair: re-fetch real difficulty for
 *                                              all problems currently stored as 'Medium' that
 *                                              were set by the old hardcoded import bug.
 */

import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  importLeetcodeProblems,
  importLeetcodeCode,
  backfillMissingCode,
  getCodeCoverageStatus,
  repairDifficulty,
} from '../controllers/import.controller.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const problemsImportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 10,
  keyGenerator: (req) => req.user?._id?.toString() ?? 'anonymous',
  message: { success: false, message: 'Too many import requests. Please wait 10 minutes.' },
});
const codeImportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 120,
  keyGenerator: (req) => req.user?._id?.toString() ?? 'anonymous',
  message: { success: false, message: 'Too many code import requests. Please wait 10 minutes.' },
});
const backfillLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, max: 120,
  keyGenerator: (req) => req.user?._id?.toString() ?? 'anonymous',
  message: { success: false, message: 'Too many backfill requests. Please wait 10 minutes.' },
});
const repairLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  keyGenerator: (req) => req.user?._id?.toString() ?? 'anonymous',
  message: { success: false, message: 'Repair already in progress. Please wait an hour.' },
});

router.post('/leetcode/problems',          protect, problemsImportLimiter, importLeetcodeProblems);
router.post('/leetcode/code',              protect, codeImportLimiter,     importLeetcodeCode);
router.post('/leetcode/backfill',          protect, backfillLimiter,       backfillMissingCode);
router.get ('/leetcode/code-status',       protect,                        getCodeCoverageStatus);
router.post('/leetcode/repair-difficulty', protect, repairLimiter,         repairDifficulty);

export default router;
