/**
 * diagnose_bst_problem.mjs
 * Targeted check: why does "Insert into a Binary Search Tree" show 0/0/0 on
 * the dashboard, while the extension successfully synced a submission for it?
 *
 * Run from backend/: node diagnose_bst_problem.mjs
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
const users = await db.collection('users').find({}, { projection: { username: 1, email: 1 } }).toArray();

for (const user of users) {
  console.log(`\n== User: ${user.username || user.email} (${user._id}) ==`);

  // Find ALL documents matching this slug, regardless of platform -- catches
  // duplicates between 'manual' entries and 'leetcode' entries, and catches
  // any slug variant (case, trailing slash, etc.)
  const variants = await db.collection('problems').find({
    user: user._id,
    $or: [
      { platformProblemId: 'insert-into-a-binary-search-tree' },
      { title: { $regex: /insert.*binary.*search.*tree/i } },
    ],
  }).toArray();

  console.log(`Found ${variants.length} matching document(s) for this title/slug:`);

  for (const doc of variants) {
    console.log(`\n  _id:                ${doc._id}`);
    console.log(`  platform:           ${doc.platform}`);
    console.log(`  platformProblemId:  "${doc.platformProblemId}"`);
    console.log(`  title:              "${doc.title}"`);
    console.log(`  status:             ${doc.status}`);
    console.log(`  createdAt:          ${doc.createdAt}`);
    console.log(`  updatedAt:          ${doc.updatedAt}`);
    console.log(`  submissions.length: ${(doc.submissions || []).length}`);
    (doc.submissions || []).forEach((s, i) => {
      console.log(`    [${i}] id=${s.submissionId} verdict=${s.verdict} lang=${s.language} code=${s.code?.length ?? 0} chars submittedAt=${s.submittedAt}`);
    });
  }

  if (variants.length > 1) {
    console.log('\n  WARNING: DUPLICATE DOCUMENTS DETECTED for the same problem.');
    console.log('  This means the unique index on (user, platform, platformProblemId)');
    console.log('  did not prevent two separate documents -- check platform field and');
    console.log('  platformProblemId casing/whitespace differences above.');
  }
}

await client.close();
console.log('\n== Done ==');
