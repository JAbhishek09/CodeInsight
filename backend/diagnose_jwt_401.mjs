/**
 * diagnose_jwt_401.mjs
 *
 * Diagnoses why the Chrome extension's JWT is getting rejected with 401 by
 * the backend's `protect` middleware (auth.middleware.js).
 *
 * The middleware does exactly this:
 *   const decoded = jwt.verify(token, process.env.JWT_SECRET);
 *   req.user = await User.findById(decoded.id).select('-password');
 *
 * Three distinct failure modes produce the SAME 401 + generic error message,
 * so the log alone can't tell you which one you're hitting. This script
 * isolates each one individually.
 *
 * USAGE:
 *   1. Open the CodeInsight extension popup, click "Show" next to the JWT
 *      field, and copy the full token (it's long — all of it, not just the
 *      first 20 chars).
 *   2. Run: node diagnose_jwt_401.mjs "<paste full JWT here>"
 *      (from the backend/ directory, with your .env already in place)
 */
import jwt from 'jsonwebtoken';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

import dns from 'node:dns';
dns.setServers(['1.1.1.1', '8.8.8.8']);

const token = process.argv[2];

if (!token) {
  console.log('Usage: node diagnose_jwt_401.mjs "<full JWT from extension popup>"');
  console.log('\nGet the full token from: extension popup → click "Show" next to JWT field → copy ALL of it.');
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════════════');
console.log('STEP 1 — Decode the token WITHOUT verifying (reads the payload');
console.log('regardless of whether the secret matches, so we can see what');
console.log('the token actually claims).');
console.log('═══════════════════════════════════════════════════════════\n');

let decodedUnverified;
try {
  decodedUnverified = jwt.decode(token, { complete: true });
  if (!decodedUnverified) {
    console.log('❌ jwt.decode() returned null — the string is not a structurally valid JWT at all.');
    console.log('   This usually means the token was truncated when copied/pasted, or extra');
    console.log('   whitespace/quotes got included. Re-copy the FULL token from the popup.');
    process.exit(1);
  }
  console.log('Header:', JSON.stringify(decodedUnverified.header, null, 2));
  console.log('Payload:', JSON.stringify(decodedUnverified.payload, null, 2));
} catch (e) {
  console.log('❌ jwt.decode() threw:', e.message);
  console.log('   The token string is malformed (not valid base64url/JWT structure).');
  process.exit(1);
}

const { payload } = decodedUnverified;

// ── Check 1: expiry ───────────────────────────────────────────────────────────
console.log('\n───────────────────────────────────────────────────────────');
console.log('CHECK 1 — Expiry');
console.log('───────────────────────────────────────────────────────────');
if (payload.exp) {
  const expDate = new Date(payload.exp * 1000);
  const now = new Date();
  const expired = expDate < now;
  console.log(`  exp claim:     ${payload.exp} → ${expDate.toISOString()}`);
  console.log(`  current time:  ${now.toISOString()}`);
  if (expired) {
    console.log(`  ❌ TOKEN IS EXPIRED (expired ${Math.round((now - expDate) / 1000 / 60)} minutes ago)`);
    console.log('     FIX: Log into the CodeInsight web app again, copy the NEW token from');
    console.log('     localStorage or the login response, and re-paste it into the extension popup.');
  } else {
    console.log(`  ✅ Token is NOT expired (expires in ${Math.round((expDate - now) / 1000 / 60 / 60)} hours)`);
  }
} else {
  console.log('  ⚠️  No exp claim found — unusual, but not itself a failure cause.');
}

// ── Check 2: signature verification against the CURRENTLY LOADED JWT_SECRET ──
console.log('\n───────────────────────────────────────────────────────────');
console.log('CHECK 2 — Signature verification against current JWT_SECRET');
console.log('───────────────────────────────────────────────────────────');
console.log(`  JWT_SECRET loaded from .env: ${process.env.JWT_SECRET ? '"' + process.env.JWT_SECRET.slice(0,8) + '..." (' + process.env.JWT_SECRET.length + ' chars)' : '❌ NOT SET / undefined'}`);

if (!process.env.JWT_SECRET) {
  console.log('  ❌ JWT_SECRET is not set in this .env — jwt.verify() would always fail.');
  console.log('     FIX: Add JWT_SECRET=<some value> to backend/.env and restart the server.');
} else {
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    console.log('  ✅ Signature is VALID against the current JWT_SECRET.');
    console.log('  Decoded id:', verified.id);

    // ── Check 3: does this user actually still exist in the DB? ────────────────
    console.log('\n───────────────────────────────────────────────────────────');
    console.log('CHECK 3 — Does User.findById(decoded.id) actually find a user?');
    console.log('───────────────────────────────────────────────────────────');
    const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    await client.connect();
    const db = client.db();
    const { ObjectId } = await import('mongodb');
    let userDoc = null;
    try {
      userDoc = await db.collection('users').findOne({ _id: new ObjectId(verified.id) });
    } catch (e) {
      console.log('  ❌ decoded.id is not a valid ObjectId string:', verified.id, '—', e.message);
    }
    if (userDoc) {
      console.log(`  ✅ User found: ${userDoc.email} (created ${userDoc.createdAt})`);
      console.log('\n  🤔 Signature valid + user exists + not expired — this token SHOULD pass');
      console.log('     auth.middleware.js. If the backend is still rejecting it with 401,');
      console.log('     the most likely explanation is that the RUNNING backend process has a');
      console.log('     DIFFERENT (stale) JWT_SECRET loaded in memory than what is in .env right');
      console.log('     now — e.g. you edited .env AFTER the server started, and Node does not');
      console.log('     hot-reload .env files. RESTART the backend process (stop it fully and');
      console.log('     run `node server.js` / `npm run dev` again) and retry.');
    } else {
      console.log(`  ❌ No user found in MongoDB with _id=${verified.id}`);
      console.log('     This means the account was deleted, or this token was signed for a');
      console.log('     different database than the one currently connected (check MONGO_URI).');
    }
    await client.close();

  } catch (err) {
    console.log('  ❌ jwt.verify() FAILED:', err.name, '—', err.message);
    if (err.name === 'JsonWebTokenError' && err.message === 'invalid signature') {
      console.log('\n  This is a SECRET MISMATCH. The token was signed with a DIFFERENT');
      console.log('  JWT_SECRET than what this backend process currently has loaded.');
      console.log('\n  Most common real-world causes:');
      console.log('   1. You changed JWT_SECRET in .env at some point AFTER logging in and');
      console.log('      copying this token. Every previously-issued token is now invalid.');
      console.log('      FIX: log in again on the web app to get a fresh token signed with');
      console.log('      the current secret, and re-paste it into the extension popup.');
      console.log('   2. You are running multiple backend instances/environments (e.g. one');
      console.log('      deployed on Render/Railway with a DIFFERENT JWT_SECRET than your');
      console.log('      local .env), and the token came from one while this check runs');
      console.log('      against the other. Make sure the extension\'s "API Base URL" field');
      console.log('      points to the SAME backend instance that issued the token.');
      console.log('   3. The backend process is still running with an OLD .env value loaded');
      console.log('      in memory from before you last edited the file. Node does not');
      console.log('      hot-reload .env — fully stop and restart the server process.');
    } else if (err.name === 'TokenExpiredError') {
      console.log('  (Already covered by Check 1 above — re-login on the web app.)');
    }
  }
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('Done.');
console.log('═══════════════════════════════════════════════════════════');
