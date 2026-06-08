import express from 'express';
import { registerUser, loginUser, getMe } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

// Define public routers for registrations and validation logins
router.post('/register', registerUser);
router.post('/login', loginUser);

// Define authenticated router to confirm account metadata validity
router.get('/me', protect, getMe);

export default router;
