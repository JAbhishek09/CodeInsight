import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { getPatternByKey, getPatterns } from '../controllers/pattern.controller.js';

const router = express.Router();

router.get('/', protect, getPatterns);
router.get('/:key', protect, getPatternByKey);

export default router;
