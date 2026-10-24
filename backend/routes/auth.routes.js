import express from 'express';
import rateLimit from 'express-rate-limit';
import { getAuthConfig, registerUser, loginUser, googleAuth, getMe, saveHandles, updateProfile, forgotPassword, resetPassword } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Strict per-IP limiter for unauthenticated credential endpoints
 * (login / register / password reset) to slow down brute-force attempts.
 * Only failed attempts count: a class signing in from one shared IP must not
 * lock itself out.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts. Please wait 15 minutes and try again.',
  },
});

/**
 * Reset emails: every request counts, keyed by the email asked for — at most
 * 3 reset emails per address per 15 minutes, so nobody can flood an inbox.
 */
const resetEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => String(req.body?.email ?? '').trim().toLowerCase() || 'no-email',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many reset emails for this address. Please wait 15 minutes and try again.',
  },
});

router.get('/config', getAuthConfig);
router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.post('/google', authLimiter, googleAuth);
router.get('/me', protect, getMe);
router.put('/handles', protect, saveHandles);
router.put('/profile', protect, updateProfile);
router.post('/forgot-password', authLimiter, resetEmailLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

export default router;
