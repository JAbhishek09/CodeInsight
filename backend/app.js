import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import problemRoutes from './routes/problem.routes.js';
import extensionRoutes from './routes/extension.routes.js';
import syncRoutes from './routes/sync.routes.js';
import analysisRoutes from './routes/analysis.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import patternRoutes from './routes/pattern.routes.js';
import predictionRoutes from './routes/prediction.routes.js';
import tutorRoutes from './routes/tutor.routes.js';
import practiceRoutes from './routes/practice.routes.js';
import importRoutes from './routes/import.routes.js';
import extensionDownloadRoutes from './routes/extensionDownload.routes.js';
import diagnoseRoutes from './routes/diagnose.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import rateLimit from 'express-rate-limit';

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Behind a hosting proxy (Render, Railway, nginx…) rate limits must key on the
// real client IP. TRUST_PROXY=1 trusts one hop.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// ─── Allowed Origins ──────────────────────────────────────────────────────────

// CLIENT_URL may list several origins, comma-separated.
export const allowedOrigins = [
  ...(process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean),
  ...(isProduction ? [] : ['http://localhost:5000', 'http://localhost:5174']),
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
export const ALLOWED_EXTENSION_ID = process.env.EXTENSION_ID || null;

/** The page making the request is served by this same server (SERVE_CLIENT). */
const isSameHost = (req, origin) => {
  try { return new URL(origin).host === req.get('host'); } catch { return false; }
};

app.use(
  cors((req, done) => done(null, {
    credentials: true,
    // The app's own pages always pass, whatever CLIENT_URL says.
    origin: isSameHost(req, req.header('Origin')) ? true : checkOrigin,
  }))
);

function checkOrigin(origin, callback) {
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
}

app.use(express.json({ limit: '1mb' }));

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
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
app.use('/api/patterns',   patternRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/tutor',      tutorRoutes);
app.use('/api/practice',   practiceRoutes);
app.use('/api/import',     importRoutes);
app.use('/api/extension',  extensionDownloadRoutes); // the extension as a zip
if (!isProduction) app.use('/api/diagnose', diagnoseRoutes);   // dev-only diagnostics

// ─── Web app (production, single origin) ─────────────────────────────────────
// With SERVE_CLIENT=true the API also serves the built frontend (../dist, or
// CLIENT_DIST), so the app's relative /api calls work without a separate
// host or proxy.
//
// After a deploy, a tab that is still open asks for the old build's file
// names. Those must 404 — not get index.html with a 200 — so the app notices
// and reloads into the new build (frontend/src/lib/staleBuild.ts).

const clientDir = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
if (process.env.SERVE_CLIENT === 'true' && fs.existsSync(path.join(clientDir, 'index.html'))) {
  const notFound = (req, res) => res.status(404).type('text/plain').send('Not found');
  // Build files are content-hashed: a name never changes content, so cache for a year
  app.use('/assets', express.static(path.join(clientDir, 'assets'), { immutable: true, maxAge: '1y', index: false }));
  app.use('/assets', notFound);
  app.use(express.static(clientDir, { index: false, maxAge: '1h' }));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    if (/\.[a-z0-9]+$/i.test(req.path)) return notFound(req, res); // a file that isn't there
    // Pages always get the current index.html, so a deploy is picked up on the next load
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(clientDir, 'index.html'));
  });
}
app.use('/api', (req, res) => res.status(404).json({ success: false, message: 'Not found' }));

// ─── Error Handler ────────────────────────────────────────────────────────────

app.use(errorHandler);

export default app;
