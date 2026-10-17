import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth.middleware.js';
import { createPrediction, getLatestFeedback, getPredictionStats } from '../controllers/prediction.controller.js';

const router = express.Router();

const predictionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 300,
  keyGenerator: (req) => req.user?._id?.toString() ?? 'anonymous',
  message: { success: false, message: 'Too many guesses. Please wait a few minutes.' },
});

router.post('/', protect, predictionLimiter, createPrediction);
router.get('/latest', protect, getLatestFeedback);
router.get('/stats', protect, getPredictionStats);

export default router;
