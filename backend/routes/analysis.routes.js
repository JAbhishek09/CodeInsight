import express from 'express';
import { triggerAnalysis } from '../controllers/analysis.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Rate limit: 10 AI analyses per 15 minutes per user (Gemini has quotas)
const analysisLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.user?._id?.toString() ?? 'anonymous',
  message: { success: false, message: 'AI analysis rate limit reached. Please wait 15 minutes.' },
});

router.post('/:id', protect, analysisLimiter, triggerAnalysis);

export default router;
