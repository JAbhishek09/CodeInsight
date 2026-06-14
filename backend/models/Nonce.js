/**
 * models/Nonce.js
 *
 * BUG-INJ-002 FIX: Persistent nonce store for replay-attack prevention.
 *
 * Previously, nonces were stored in an in-memory Map that was wiped on every
 * server restart.  An attacker who intercepted a valid request could replay it
 * immediately after a restart (crash, redeploy, PM2 restart) while the in-memory
 * cache was empty — bypassing the replay guard entirely.
 *
 * This model stores nonces in MongoDB instead.  Two indexes make it safe and
 * self-cleaning:
 *
 *  1. Unique index on `nonce`  — insertion of a duplicate throws error code 11000,
 *     which extension.controller.js catches to detect replays.
 *
 *  2. TTL index on `createdAt` with expireAfterSeconds: 600 (10 minutes) — MongoDB
 *     automatically deletes documents after 10 minutes, matching the 10-minute
 *     timestamp drift window enforced in the controller.  No manual purge needed.
 *
 * Usage (see extension.controller.js):
 *   try {
 *     await Nonce.create({ nonce });   // succeeds → first time seen
 *   } catch (err) {
 *     if (err.code === 11000) ...;     // duplicate key → replay attack
 *   }
 */

import mongoose from 'mongoose';

const NonceSchema = new mongoose.Schema({
  nonce: {
    type: String,
    required: true,
    unique: true,         // triggers E11000 on duplicate insertion
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600,         // TTL: MongoDB auto-deletes documents after 600 seconds (10 min)
  },
});

const Nonce = mongoose.model('Nonce', NonceSchema);
export default Nonce;
