import express from 'express';
import { triggerSync, triggerRecoverySync } from '../controllers/sync.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limit: max 5 sync requests per 15 minutes per user.
// Keyed by userId (post-auth) to avoid issues with shared IPs (NAT, university networks).
const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?._id?.toString() ?? 'anonymous',
  message: { success: false, message: 'Too many sync requests. Please wait 15 minutes.' },
});

/**
 * POST /api/sync
 * Legacy full sync — kept for backward-compatibility.
 * Syncs both LeetCode (last 20, no code) and Codeforces (last 100, no code).
 * Prefer /api/sync/recovery for new frontend integrations.
 */
router.post('/', protect, syncLimiter, triggerSync);

/**
 * POST /api/sync/recovery
 * Recovery/Fallback Sync — the recommended route per audit recommendation.
 *
 * Behavior:
 *  - Codeforces sync always runs (no extension exists for CF).
 *  - LeetCode sync is OPT-IN via { "forceLC": true } in the request body.
 *    Default is to skip LC because the Chrome Extension handles LC in real-time.
 *
 * Request body (all optional):
 *  {
 *    "forceLC": false   // set true to recover LC submissions missed while extension was offline
 *  }
 *
 * Response includes a `warnings` array explaining what was skipped and why,
 * so the frontend can surface actionable messages to the user.
 */
router.post('/recovery', protect, syncLimiter, triggerRecoverySync);

export default router;
