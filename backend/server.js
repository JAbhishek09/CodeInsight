import dotenv from 'dotenv';
dotenv.config();

import dns from 'node:dns/promises';
import connectDB from './config/db.js';
import app, { allowedOrigins, ALLOWED_EXTENSION_ID } from './app.js';
import { mailSetupReport } from './utils/mailer.js';

// Refuse to start a production server with missing secrets.
if (process.env.NODE_ENV === 'production') {
  const missing = ['MONGO_URI', 'JWT_SECRET', 'CLIENT_URL'].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
  if (process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters in production.');
    process.exit(1);
  }
}

// Atlas SRV lookups fail on some local resolvers; DNS_SERVERS=system keeps the host's.
if (process.env.DNS_SERVERS !== 'system') dns.setServers((process.env.DNS_SERVERS || '1.1.1.1').split(','));
connectDB();

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
  console.log(`📧 ${mailSetupReport()}`);
});

process.on('unhandledRejection', (err) => {
  console.error('🔥 Unhandled Promise Rejection:', err.message);
  server.close(() => process.exit(1));
});
