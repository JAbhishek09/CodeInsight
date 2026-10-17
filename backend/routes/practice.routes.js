import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { getToday, postReview } from '../controllers/practice.controller.js';

const router = express.Router();

router.get('/today', protect, getToday);
router.post('/reviews/:id', protect, postReview);

export default router;
