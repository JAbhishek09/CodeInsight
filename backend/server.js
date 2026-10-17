import dotenv from 'dotenv';
dotenv.config();

import dns from 'node:dns/promises';
import connectDB from './config/db.js';
import app, { allowedOrigins, ALLOWED_EXTENSION_ID } from './app.js';

dns.setServers(['1.1.1.1']);
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
});

process.on('unhandledRejection', (err) => {
  console.error('🔥 Unhandled Promise Rejection:', err.message);
  server.close(() => process.exit(1));
});
