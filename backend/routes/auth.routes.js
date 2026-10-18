import express from 'express';
import rateLimit from 'express-rate-limit';
import { getAuthConfig, registerUser, loginUser, getMe, saveHandles, updateProfile, forgotPassword, resetPassword } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Strict per-IP limiter for unauthenticated credential endpoints
 * (login / register / password reset) to slow down brute-force attempts.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please wait 15 minutes and try again.',
  },
});

router.get('/config', getAuthConfig);
router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.get('/me', protect, getMe);
router.put('/handles', protect, saveHandles);
router.put('/profile', protect, updateProfile);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

export default router;
