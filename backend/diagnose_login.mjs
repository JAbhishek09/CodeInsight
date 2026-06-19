/**
 * diagnose_login.mjs
 *
 * Checks two things, in order:
 *   1. Is the backend actually running and reachable on the port your .env
 *      says it should be on?
 *   2. Does AT LEAST ONE user account exist in MongoDB to log in with?
 *
 * The earlier `curl ... your-email@example.com ... your-password` command
 * was a TEMPLATE — it was never going to work as-is because that email
 * doesn't exist in your database. This script tells you what email(s)
 * actually do exist, so you can log in with real credentials (or register
 * a new account if none exist yet).
 *
 * Run from backend/: node diagnose_login.mjs
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import dns from 'node:dns';
dns.setServers(['1.1.1.1', '8.8.8.8']);

const PORT = process.env.PORT || 5000;

console.log('═══════════════════════════════════════════════════════════');
console.log('STEP 1 — Is the backend reachable on http://localhost:' + PORT + ' ?');
console.log('═══════════════════════════════════════════════════════════\n');

try {
  const res = await fetch(`http://localhost:${PORT}/`, { signal: AbortSignal.timeout(5000) });
  const body = await res.json().catch(() => null);
  if (res.ok) {
    console.log(`  ✅ Backend responded: HTTP ${res.status}`);
    if (body) console.log('  Response:', JSON.stringify(body));
  } else {
    console.log(`  ⚠️  Backend responded but with HTTP ${res.status} — check server logs.`);
  }
} catch (err) {
  console.log(`  ❌ Could not reach http://localhost:${PORT}/ — ${err.message}`);
  console.log('     The backend process is likely NOT running.');
  console.log('     FIX: open a terminal in backend/ and run: npm run dev  (or: node server.js)');
  console.log('     Then re-run this script.');
  process.exit(1);
}

console.log('\n═══════════════════════════════════════════════════════════');
console.log('STEP 2 — What user accounts actually exist in MongoDB?');
console.log('═══════════════════════════════════════════════════════════\n');

const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const db = client.db();

const users = await db.collection('users')
  .find({}, { projection: { email: 1, name: 1, createdAt: 1 } })
  .sort({ createdAt: -1 })
  .limit(20)
  .toArray();

if (users.length === 0) {
  console.log('  ❌ ZERO user accounts exist in this database.');
  console.log('     This explains the curl failure — there is no account to log into yet.');
  console.log('\n  FIX — register a new account first:');
  console.log(`\n    curl -X POST http://localhost:${PORT}/api/auth/register \\`);
  console.log('      -H "Content-Type: application/json" \\');
  console.log('      -d \'{"name":"Your Name","email":"you@example.com","password":"choose-a-password"}\'');
  console.log('\n  That response will include a fresh, correctly-signed token in data.token —');
  console.log('  copy THAT into the extension popup. No separate login step needed after registering.');
} else {
  console.log(`  ✅ Found ${users.length} user account(s):\n`);
  users.forEach(u => {
    console.log(`    • ${u.email}  (name: ${u.name || '?'}, created: ${u.createdAt || '?'})`);
  });
  console.log('\n  Use one of the emails above with ITS real password in the login command:');
  console.log(`\n    curl -X POST http://localhost:${PORT}/api/auth/login \\`);
  console.log('      -H "Content-Type: application/json" \\');
  console.log(`      -d '{"email":"${users[0].email}","password":"<the real password for this account>"}'`);
  console.log('\n  If you don\'t remember the password for any of these, just register a NEW');
  console.log('  account with a fresh email — that\'s the fastest path forward:');
  console.log(`\n    curl -X POST http://localhost:${PORT}/api/auth/register \\`);
  console.log('      -H "Content-Type: application/json" \\');
  console.log('      -d \'{"name":"Test","email":"test-ext@example.com","password":"testpass123"}\'');
}

await client.close();
console.log('\n═══════════════════════════════════════════════════════════');
console.log('Done.');
console.log('═══════════════════════════════════════════════════════════');
