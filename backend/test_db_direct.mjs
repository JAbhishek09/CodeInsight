/**
 * test_db_direct.mjs
 * Connects to MongoDB and shows exactly what's stored for the first few problems.
 * Run: node test_db_direct.mjs
 */
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

// Override DNS to bypass network block
import dns from 'node:dns';
dns.setServers(['1.1.1.1', '8.8.8.8']);

const MONGO_URI = process.env.MONGO_URI;
console.log('Connecting to MongoDB...');

const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
console.log('Connected.\n');

const db = client.db();

// ── 1. Show all users ─────────────────────────────────────────────────────────
const users = await db.collection('users').find({}, { projection: { username: 1, leetcodeHandle: 1 } }).toArray();
console.log('══ Users ══');
users.forEach(u => console.log(`  _id=${u._id} username=${u.username} leetcodeHandle=${u.leetcodeHandle}`));

// ── 2. Show all leetcode problems for first user ──────────────────────────────
if (users.length > 0) {
  const userId = users[0]._id;
  console.log(`\n══ LeetCode Problems for user ${userId} ══`);

  const problems = await db.collection('problems').find(
    { user: userId, platform: 'leetcode' },
    { projection: { platformProblemId: 1, title: 1, submissions: 1 } }
  ).toArray();

  console.log(`Total problems: ${problems.length}`);

  let totalSubs = 0, withCode = 0, emptyCode = 0, noSubs = 0;

  for (const p of problems) {
    const subs = p.submissions ?? [];
    totalSubs += subs.length;
    if (subs.length === 0) {
      noSubs++;
    } else {
      for (const s of subs) {
        if (s.code && s.code.trim().length > 0) withCode++;
        else emptyCode++;
      }
    }
  }

  console.log(`Problems with NO submissions array entries: ${noSubs}`);
  console.log(`Total submission entries: ${totalSubs}`);
  console.log(`  With code:    ${withCode}`);
  console.log(`  Empty code:   ${emptyCode}`);

  console.log('\n── First 5 problems detail ──');
  for (const p of problems.slice(0, 5)) {
    const subs = p.submissions ?? [];
    console.log(`\n  ${p.platformProblemId} (${p.title})`);
    console.log(`  submissions count: ${subs.length}`);
    if (subs.length > 0) {
      subs.slice(0, 3).forEach(s => {
        console.log(`    id=${s.submissionId} verdict=${s.verdict} code=${s.code?.length ?? 0} chars`);
      });
    }
  }

  // ── 3. Check submissionId types ─────────────────────────────────────────────
  console.log('\n── submissionId type check (first 10 subs across all problems) ──');
  let checked = 0;
  for (const p of problems) {
    for (const s of (p.submissions ?? [])) {
      if (checked >= 10) break;
      console.log(`  submissionId=${s.submissionId} type=${typeof s.submissionId}`);
      checked++;
    }
    if (checked >= 10) break;
  }
}

await client.close();
console.log('\n══ Done ══');
