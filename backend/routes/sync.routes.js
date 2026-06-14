import express from 'express';
import { triggerSync } from '../controllers/sync.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// FIX BUG-005: protect middleware applied here (was missing before)
// Rate limit: max 5 syncs per 15 minutes per user
const syncLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.user?._id?.toString() ?? 'anonymous',
  message: { success: false, message: 'Too many sync requests. Please wait 15 minutes.' },
});

router.post('/', protect, syncLimiter, triggerSync);

export default router;
