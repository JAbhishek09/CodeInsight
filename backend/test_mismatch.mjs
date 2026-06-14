/**
 * test_mismatch.mjs
 * Diagnoses why backfill writes 0 — checks platformProblemId matching
 * Run: node test_mismatch.mjs <LEETCODE_SESSION>
 */
const [,, sessionCookie] = process.argv;
if (!sessionCookie) { console.error('Usage: node test_mismatch.mjs <LEETCODE_SESSION>'); process.exit(1); }

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const LC_GRAPHQL = 'https://leetcode.com/graphql';
const headers = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0',
  'Referer': 'https://leetcode.com/',
  'Origin': 'https://leetcode.com',
  'Cookie': `LEETCODE_SESSION=${sessionCookie}; csrftoken=ci`,
  'X-Csrftoken': 'ci',
};

async function gql(query, variables = {}) {
  const res = await fetch(LC_GRAPHQL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

// ── 1. Fetch first 3 pages from LeetCode (offsets 0, 20, 40) ─────────────────
console.log('\n══ LeetCode: submissionList pages 0, 20, 40 ══');
const lcSubmissions = [];
for (const offset of [0, 20, 40]) {
  const data = await gql(`
    query submissionList($offset: Int!, $limit: Int!) {
      submissionList(offset: $offset, limit: $limit) {
        submissions { id titleSlug statusDisplay }
      }
    }
  `, { offset, limit: 20 });
  const subs = data?.submissionList?.submissions ?? [];
  console.log(`offset=${offset}: ${subs.length} submissions`);
  subs.forEach(s => lcSubmissions.push(s));
}

const lcSlugs = [...new Set(lcSubmissions.map(s => s.titleSlug))];
const lcAcSlugs = [...new Set(lcSubmissions.filter(s => s.statusDisplay === 'Accepted').map(s => s.titleSlug))];
console.log(`\nUnique slugs from LC (60 submissions): ${lcSlugs.length}`);
console.log(`Unique AC slugs: ${lcAcSlugs.length}`);
console.log('Sample LC slugs:', lcSlugs.slice(0, 10));

// ── 2. Check MongoDB ──────────────────────────────────────────────────────────
console.log('\n══ MongoDB: Problem documents ══');
const client = new MongoClient(MONGO_URI);
await client.connect();
const db = client.db();

const problems = await db.collection('problems').find(
  { platform: 'leetcode' },
  { projection: { platformProblemId: 1, title: 1, 'submissions.submissionId': 1, 'submissions.code': 1 } }
).toArray();

console.log(`Total leetcode Problem docs in DB: ${problems.length}`);
const dbSlugs = new Set(problems.map(p => p.platformProblemId));
console.log('Sample DB slugs:', [...dbSlugs].slice(0, 10));

// ── 3. Cross-reference ────────────────────────────────────────────────────────
console.log('\n══ Cross-reference: LC slugs vs DB slugs ══');
const inDbAndLc = lcAcSlugs.filter(s => dbSlugs.has(s));
const inLcNotDb = lcAcSlugs.filter(s => !dbSlugs.has(s));
console.log(`AC slugs in LC first 60 subs:          ${lcAcSlugs.length}`);
console.log(`AC slugs that EXIST in DB:              ${inDbAndLc.length}`);
console.log(`AC slugs NOT in DB (upsert would create): ${inLcNotDb.length}`);

if (inDbAndLc.length > 0) {
  console.log('\n── Checking existing DB docs for code ──');
  for (const slug of inDbAndLc.slice(0, 5)) {
    const prob = problems.find(p => p.platformProblemId === slug);
    const lcSub = lcSubmissions.find(s => s.titleSlug === slug && s.statusDisplay === 'Accepted');
    const dbSub = prob?.submissions?.find(s => s.submissionId === String(lcSub?.id));
    console.log(`  ${slug}:`);
    console.log(`    DB submissions count: ${prob?.submissions?.length ?? 0}`);
    console.log(`    LC submissionId: ${lcSub?.id}`);
    console.log(`    DB has that submissionId: ${!!dbSub}`);
    console.log(`    DB submission code: ${dbSub ? (dbSub.code?.length > 0 ? `${dbSub.code.length} chars` : 'EMPTY') : 'N/A'}`);
  }
}

// ── 4. Check all submission codes in DB ──────────────────────────────────────
console.log('\n══ DB code coverage ══');
let withCode = 0, withoutCode = 0, totalSubs = 0;
for (const p of problems) {
  for (const s of (p.submissions ?? [])) {
    totalSubs++;
    if (s.code && s.code.trim().length > 0) withCode++;
    else withoutCode++;
  }
}
console.log(`Total submissions in DB: ${totalSubs}`);
console.log(`With code:    ${withCode}`);
console.log(`Without code: ${withoutCode}`);

// ── 5. Test submissionDetails for one AC sub ─────────────────────────────────
const acSub = lcSubmissions.find(s => s.statusDisplay === 'Accepted');
if (acSub) {
  console.log(`\n══ submissionDetails test for ${acSub.id} (${acSub.titleSlug}) ══`);
  try {
    const data = await gql(`
      query submissionDetails($submissionId: Int!) {
        submissionDetails(submissionId: $submissionId) { code lang { name } }
      }
    `, { submissionId: parseInt(acSub.id) });
    const d = data?.submissionDetails;
    console.log(d?.code ? `✅ code=${d.code.length} chars, lang=${d.lang?.name}` : `❌ no code: ${JSON.stringify(d)}`);
  } catch(e) { console.log('ERROR:', e.message); }
}

await client.close();
console.log('\n══ Done ══');
