import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import problemRoutes from './routes/problem.routes.js';
import extensionRoutes from './routes/extension.routes.js';
import syncRoutes from './routes/sync.routes.js';
import analysisRoutes from './routes/analysis.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import importRoutes from './routes/import.routes.js';
import diagnoseRoutes from './routes/diagnose.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import rateLimit from 'express-rate-limit';

dotenv.config();

import dns from 'node:dns/promises';
dns.setServers(['1.1.1.1']);
connectDB();

const app = express();

// ─── Allowed Origins ──────────────────────────────────────────────────────────

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:5174',
];

/**
 * BUG-EXT-006 FIX: Lock extension CORS to a specific Extension ID in production.
 *
 * Previously the CORS check allowed ANY installed Chrome extension to POST to
 * the CodeInsight backend (`origin.startsWith('chrome-extension://')` with no
 * further check). A malicious extension could impersonate CodeInsight and inject
 * arbitrary submissions for any authenticated user whose JWT it obtained.
 *
 * Fix: Read EXTENSION_ID from the environment. When set, only that specific
 * extension origin is allowed. When unset (local development), all
 * chrome-extension:// origins are still permitted so development is frictionless.
 *
 * How to find your extension ID:
 *   1. Open chrome://extensions
 *   2. Enable "Developer mode" (top-right toggle)
 *   3. Find "CodeInsight" — copy the ID string beneath the name
 *   4. Add EXTENSION_ID=<that string> to backend/.env
 */
const ALLOWED_EXTENSION_ID = process.env.EXTENSION_ID || null;

app.use(
  cors({
    origin: function (origin, callback) {
      // Same-origin or server-to-server requests (no Origin header)
      if (!origin) return callback(null, true);

      // Web frontend (React dev server, production domain)
      if (allowedOrigins.includes(origin)) return callback(null, true);

      // Chrome Extension
      if (origin.startsWith('chrome-extension://')) {
        if (!ALLOWED_EXTENSION_ID) {
          // Development mode — no ID configured, allow all extension origins
          return callback(null, true);
        }
        // Production mode — only allow the registered extension
        if (origin === `chrome-extension://${ALLOWED_EXTENSION_ID}`) {
          return callback(null, true);
        }
        console.warn(`[CORS] Rejected unregistered extension origin: ${origin}`);
        return callback(new Error('Extension origin not allowed. EXTENSION_ID mismatch.'));
      }

      console.warn(`[CORS] Rejected unknown origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CodeInsight API',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Global Rate Limiter ──────────────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.' },
});
app.use('/api', globalLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/auth',       authRoutes);
app.use('/api/problems',   problemRoutes);
app.use('/api/extensions', extensionRoutes);
app.use('/api/sync',       syncRoutes);
app.use('/api/analyze',    analysisRoutes);
app.use('/api/analytics',  analyticsRoutes);
app.use('/api/import',     importRoutes);
app.use('/api/diagnose',   diagnoseRoutes);   // DEV ONLY — remove before production

// ─── Error Handler ────────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 CORS allowed: ${allowedOrigins.join(', ')}`);
  if (ALLOWED_EXTENSION_ID) {
    console.log(`🔒 Extension CORS locked to ID: ${ALLOWED_EXTENSION_ID}`);
  } else {
    console.warn('⚠️  EXTENSION_ID not set — all chrome-extension:// origins allowed (dev mode).');
  }
});

process.on('unhandledRejection', (err) => {
  console.error('🔥 Unhandled Promise Rejection:', err.message);
  server.close(() => process.exit(1));
});
