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

import dns from "node:dns/promises";
dns.setServers(["1.1.1.1"]);
connectDB();

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'http://localhost:5000',
  'http://localhost:5174',
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin.startsWith('chrome-extension://') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

app.get('/', (req, res) => {
  res.status(200).json({ success: true, message: 'CodeInsight API', version: '2.1.0', timestamp: new Date().toISOString() });
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please slow down.' },
});
app.use('/api', globalLimiter);

app.use('/api/auth',      authRoutes);
app.use('/api/problems',  problemRoutes);
app.use('/api/extensions', extensionRoutes);
app.use('/api/sync',      syncRoutes);
app.use('/api/analyze',   analysisRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/import',    importRoutes);
app.use('/api/diagnose',  diagnoseRoutes);  // DEV ONLY — remove before production

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 CORS allowed: ${allowedOrigins.join(', ')} + chrome-extension://*`);
});

process.on('unhandledRejection', (err) => {
  console.error('🔥 Unhandled Promise Rejection:', err.message);
  server.close(() => process.exit(1));
});
