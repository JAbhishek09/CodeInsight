import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { getDrill, getDrillStreak, getToday, postReview } from '../controllers/practice.controller.js';

const router = express.Router();

router.get('/today', protect, getToday);
router.post('/reviews/:id', protect, postReview);
router.get('/drill', protect, getDrill);
router.get('/drill/streak', protect, getDrillStreak);

export default router;
