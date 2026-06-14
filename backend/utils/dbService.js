/**
 * dbService.js
 *
 * This file was a development scaffold for offline fallback mode.
 * It is no longer used by any controller — all controllers use Mongoose directly.
 *
 * AUDIT NOTE (BUG-010): The previous version of this file contained
 * hard-coded demo user credentials (email: demo@example.com, password: password123).
 * That content has been removed as it is a security smell even in dev environments.
 *
 * If you need an offline seed for development:
 *   1. Use MongoDB Memory Server in Jest tests
 *   2. Or run `mongosh` and insert seed data manually
 *
 * This file is retained as an empty stub to avoid import errors if any
 * future code references it, but it exports nothing meaningful.
 */

export const isDbConnected = () => {
  // Intentionally empty — use Mongoose connection state directly if needed:
  // import mongoose from 'mongoose'; return mongoose.connection.readyState === 1;
  return false;
};
