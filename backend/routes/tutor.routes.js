import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth.middleware.js';
import { ask, list, quota } from '../controllers/tutor.controller.js';

const router = express.Router();

// Burst protection on top of the daily AI limit
const tutorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  keyGenerator: (req) => req.user?._id?.toString() ?? 'anonymous',
  message: { success: false, message: 'Slow down a little — try again in a minute.' },
});

router.get('/quota', protect, quota);
router.get('/:problemId', protect, list);
router.post('/:problemId', protect, tutorLimiter, ask);

export default router;
