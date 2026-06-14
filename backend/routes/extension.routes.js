import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth.middleware.js';
import { validateExtensionSubmission } from '../middleware/validate.middleware.js';
import { ingestLeetCodeSubmission } from '../controllers/extension.controller.js';

const router = express.Router();

/**
 * Rate limiter: max 30 extension submissions per 15 minutes per IP.
 * This is intentionally more lenient than auth routes (which are 10/15min)
 * because users may solve multiple problems in quick succession.
 *
 * In production, consider keying this by userId (post-auth) instead of IP
 * to handle users behind NAT/VPNs correctly.
 */
const extensionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many submissions from this client. Please wait before submitting again.',
  },
  keyGenerator: (req) => {
    // Key by authenticated user ID post-auth — avoids any IP handling entirely
    return req.user?._id?.toString() ?? 'anonymous';
  },
});

/**
 * POST /api/extensions/leetcode/submission
 * Capture a LeetCode submission from the Chrome Extension.
 */
router.post(
  '/leetcode/submission',
  protect,                         // JWT authentication
  extensionLimiter,                // Per-user rate limiting
  validateExtensionSubmission,     // Schema validation
  ingestLeetCodeSubmission         // Business logic
);

export default router;
