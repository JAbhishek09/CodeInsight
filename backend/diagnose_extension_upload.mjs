/**
 * diagnose_extension_upload.mjs
 * Checks whether the extension's upload for "insert-into-a-binary-search-tree"
 * ever reached the backend at all, by inspecting the Nonce collection (every
 * successful ingestLeetCodeSubmission call creates exactly one Nonce document)
 * and cross-referencing timestamps against the Problem document's createdAt/
 * updatedAt.
 *
 * Run from backend/: node diagnose_extension_upload.mjs
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

import dns from 'node:dns';
dns.setServers(['1.1.1.1', '8.8.8.8']);

const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
console.log('Connected.\n');

const db = client.db();

// ── 1. How many nonces exist, and when? ───────────────────────────────────────
// Every single successful POST to /api/extensions/leetcode/submission creates
// exactly one Nonce document (checkAndConsumeNonce). If zero nonces exist,
// the extension's request never reached the controller's nonce check at all
// -- meaning it failed before that point (network error, wrong endpoint,
// missing JWT, CORS, or the backend was not running / not reachable).
const nonces = await db.collection('nonces').find({}).sort({ createdAt: -1 }).limit(20).toArray();
console.log(`Total recent nonces (max 20 shown, TTL 10 min so old ones may be gone): ${nonces.length}`);
nonces.forEach(n => console.log(`  nonce=${n.nonce?.slice(0,12)}... createdAt=${n.createdAt}`));

if (nonces.length === 0) {
  console.log('\n  No nonces found at all.');
  console.log('  IMPORTANT: Nonces have a 10-minute TTL and auto-delete from MongoDB.');
  console.log('  If your extension test was more than 10 minutes ago, this is expected');
  console.log('  and does NOT prove anything by itself. Re-test live and re-run this');
  console.log('  script within 10 minutes to get a meaningful answer.');
}

// ── 2. Show the actual Problem document state again for confirmation ────────
const problem = await db.collection('problems').findOne({
  platformProblemId: 'insert-into-a-binary-search-tree',
});
if (problem) {
  console.log('\n== Problem document ==');
  console.log(`  _id: ${problem._id}`);
  console.log(`  createdAt: ${problem.createdAt}`);
  console.log(`  updatedAt: ${problem.updatedAt}`);
  console.log(`  submissions: ${(problem.submissions || []).length}`);
}

await client.close();
console.log('\n== Done ==');
console.log('\nNEXT STEP: Submit the problem again on LeetCode RIGHT NOW with the');
console.log('extension active, watch the backend terminal (where `npm run dev` or');
console.log('`node server.js` is running) for a log line starting with [Extension],');
console.log('then immediately re-run this script.');
