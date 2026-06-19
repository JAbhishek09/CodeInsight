/**
 * import.routes.js
 * Routes for historical data import (Phase 1 hybrid architecture).
 *
 *  POST /api/import/leetcode/problems  — full AC problem list (no session)
 *  POST /api/import/leetcode/code      — paginated submission code (session required)
 *  POST /api/import/leetcode/backfill  — per-problem backfill for problems still missing code
 *
 * Rate limits:
 *  - problems:  3 per 10 min  (one-time import)
 *  - code:     120 per 10 min (auto-pagination: ~54 pages for 1076 submissions)
 *  - backfill: 120 per 10 min (each call processes up to 20 problems × 2 LC requests each)
 */

import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  importLeetcodeProblems,
  importLeetcodeCode,
  backfillMissingCode,
  getCodeCoverageStatus,
} from '../controllers/import.controller.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const problemsImportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => req.user?._id?.toString() ?? 'anonymous',
  message: { success: false, message: 'Too many import requests. Please wait 10 minutes.' },
});

const codeImportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 120,
  keyGenerator: (req) => req.user?._id?.toString() ?? 'anonymous',
  message: { success: false, message: 'Too many code import requests. Please wait 10 minutes.' },
});

const backfillLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 120,
  keyGenerator: (req) => req.user?._id?.toString() ?? 'anonymous',
  message: { success: false, message: 'Too many backfill requests. Please wait 10 minutes.' },
});

router.post('/leetcode/problems', protect, problemsImportLimiter, importLeetcodeProblems);
router.post('/leetcode/code',     protect, codeImportLimiter,     importLeetcodeCode);
router.post('/leetcode/backfill', protect, backfillLimiter,       backfillMissingCode);

// Live code-coverage status — no rate limit needed, cheap aggregation, read-only.
router.get('/leetcode/code-status', protect, getCodeCoverageStatus);

export default router;
