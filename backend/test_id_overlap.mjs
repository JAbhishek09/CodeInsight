/**
 * test_id_overlap.mjs
 * Checks whether submissionList IDs match what's stored in MongoDB.
 * Run: node test_id_overlap.mjs <LEETCODE_SESSION>
 */
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import dns from 'node:dns';
dns.setServers(['1.1.1.1', '8.8.8.8']);
dotenv.config();

const [,, sessionCookie] = process.argv;
if (!sessionCookie) { console.error('Usage: node test_id_overlap.mjs <SESSION>'); process.exit(1); }

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
  const j = await res.json();
  if (j.errors) throw new Error(j.errors[0].message);
  return j.data;
}

// ── Fetch ALL submission IDs from LeetCode (pages until done) ─────────────────
console.log('Fetching all submissions from LeetCode...');
const allLcSubs = [];
let offset = 0;
let hasNext = true;
while (hasNext) {
  const data = await gql(`
    query submissionList($offset: Int!, $limit: Int!) {
      submissionList(offset: $offset, limit: $limit) {
        hasNext
        submissions { id titleSlug statusDisplay }
      }
    }
  `, { offset, limit: 20 });
  const page = data?.submissionList;
  if (!page) { console.log('submissionList returned null — session expired?'); break; }
  allLcSubs.push(...(page.submissions ?? []));
  hasNext = page.hasNext;
  offset += 20;
  process.stdout.write(`\r  fetched ${allLcSubs.length} submissions...`);
  if (hasNext) await new Promise(r => setTimeout(r, 200));
}
console.log(`\nTotal LC submissions: ${allLcSubs.length}`);

const lcAcSubs = allLcSubs.filter(s => s.statusDisplay === 'Accepted');
const lcIds = new Set(allLcSubs.map(s => String(s.id)));
const lcAcIds = new Set(lcAcSubs.map(s => String(s.id)));
console.log(`AC submissions: ${lcAcSubs.length}`);

// ── Connect to MongoDB ────────────────────────────────────────────────────────
const client = new MongoClient(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
await client.connect();
const db = client.db();

const problems = await db.collection('problems').find(
  { platform: 'leetcode' },
  { projection: { platformProblemId: 1, submissions: 1 } }
).toArray();

// Build sets of DB submission IDs
const dbAllIds = new Set();
const dbEmptyIds = new Set();
const dbWithCodeIds = new Set();
const dbSlugMap = {}; // submissionId → platformProblemId

for (const p of problems) {
  for (const s of (p.submissions ?? [])) {
    const id = String(s.submissionId);
    dbAllIds.add(id);
    dbSlugMap[id] = p.platformProblemId;
    if (s.code && s.code.trim().length > 0) dbWithCodeIds.add(id);
    else dbEmptyIds.add(id);
  }
}

console.log(`\n══ DB stats ══`);
console.log(`Total submission IDs in DB:      ${dbAllIds.size}`);
console.log(`With code:                        ${dbWithCodeIds.size}`);
console.log(`Empty code:                       ${dbEmptyIds.size}`);

// ── Cross-reference ───────────────────────────────────────────────────────────
console.log(`\n══ Overlap analysis ══`);

// Empty-code DB subs that appear in LC's submissionList → backfill would work
const emptyInBothLists = [...dbEmptyIds].filter(id => lcIds.has(id));
// Empty-code DB subs NOT in LC submissionList → backfill can never reach them
const emptyNotInLc = [...dbEmptyIds].filter(id => !lcIds.has(id));
// AC subs in LC not in DB at all → would be inserted fresh
const lcAcNotInDb = [...lcAcIds].filter(id => !dbAllIds.has(id));

console.log(`Empty-code DB subs in LC submissionList (backfillable):  ${emptyInBothLists.length}`);
console.log(`Empty-code DB subs NOT in LC submissionList (orphaned):  ${emptyNotInLc.length}`);
console.log(`LC AC subs not in DB yet (would be inserted fresh):      ${lcAcNotInDb.length}`);

if (emptyNotInLc.length > 0) {
  console.log(`\n⚠️  ${emptyNotInLc.length} DB submissions have empty code but their IDs don't appear`);
  console.log(`   in LeetCode's submissionList — these were imported from a DIFFERENT API`);
  console.log(`   (likely recentAcSubmissionList) and their IDs may differ from submissionList IDs.`);
  console.log(`\n   Sample orphaned IDs (first 5):`);
  emptyNotInLc.slice(0, 5).forEach(id => console.log(`     id=${id} slug=${dbSlugMap[id]}`));

  // Check if these slugs appear in LC with DIFFERENT IDs
  console.log(`\n   Checking if these slugs exist in LC with different IDs...`);
  const orphanSlugs = new Set(emptyNotInLc.map(id => dbSlugMap[id]));
  const lcSubsBySlug = {};
  for (const s of allLcSubs) {
    if (!lcSubsBySlug[s.titleSlug]) lcSubsBySlug[s.titleSlug] = [];
    lcSubsBySlug[s.titleSlug].push(s);
  }
  let mismatchCount = 0;
  for (const slug of [...orphanSlugs].slice(0, 5)) {
    const lcForSlug = lcSubsBySlug[slug] ?? [];
    const dbForSlug = problems.find(p => p.platformProblemId === slug);
    const dbSubIds = (dbForSlug?.submissions ?? []).map(s => s.submissionId);
    console.log(`\n   slug=${slug}`);
    console.log(`     LC IDs for this slug: ${lcForSlug.map(s => s.id).join(', ') || 'none'}`);
    console.log(`     DB IDs for this slug: ${dbSubIds.join(', ')}`);
    const overlap = lcForSlug.filter(s => dbSubIds.includes(String(s.id)));
    console.log(`     Overlapping IDs: ${overlap.length > 0 ? overlap.map(s=>s.id).join(', ') : 'NONE — different IDs!'}`);
    if (overlap.length === 0) mismatchCount++;
  }
  if (mismatchCount > 0) {
    console.log(`\n   ROOT CAUSE CONFIRMED: The IDs in DB don't match LC submissionList IDs.`);
    console.log(`   The initial import stored DIFFERENT submission IDs than what submissionList returns.`);
    console.log(`   Fix needed: fetch code by SLUG (submissionDetails for the LATEST AC sub per slug)`);
    console.log(`   instead of trying to match submission IDs.`);
  }
}

if (emptyInBothLists.length > 0) {
  console.log(`\n✅ ${emptyInBothLists.length} submissions CAN be backfilled — their IDs match.`);
  console.log(`   These should be fixed by the current import flow.`);
}

await client.close();
console.log('\n══ Done ══');
