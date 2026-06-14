import express from 'express';
import { getAnalyticsSummary } from '../controllers/analytics.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// FIX BUG-005: protect middleware was missing on analytics routes
router.get('/summary', protect, getAnalyticsSummary);

export default router;
