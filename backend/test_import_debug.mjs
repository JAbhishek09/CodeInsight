/**
 * test_import_debug.mjs
 * Simulates the exact controller flow: submissionList → submissionDetails → MongoDB check
 * Run: node test_import_debug.mjs <LEETCODE_SESSION> <MONGO_URI> <USER_ID>
 * 
 * MONGO_URI and USER_ID are optional — without them we just test the LeetCode API calls.
 */
const [,, sessionCookie, mongoUri, userId] = process.argv;
if (!sessionCookie) {
  console.error('Usage: node test_import_debug.mjs <LEETCODE_SESSION> [MONGO_URI] [USER_ID]');
  process.exit(1);
}

const LC_GRAPHQL = 'https://leetcode.com/graphql';
const csrf = 'ci';
const headers = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://leetcode.com/',
  'Origin': 'https://leetcode.com',
  'Cookie': `LEETCODE_SESSION=${sessionCookie}; csrftoken=${csrf}`,
  'X-Csrftoken': csrf,
};

async function gql(query, variables = {}) {
  const res = await fetch(LC_GRAPHQL, {
    method: 'POST', headers,
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map(e => e.message).join(' | '));
  return json.data;
}

// ── Step 1: submissionList ────────────────────────────────────────────────────
console.log('\n══ STEP 1: submissionList(offset:0, limit:20) ══');
let rawList;
try {
  const data = await gql(`
    query submissionList($offset: Int!, $limit: Int!) {
      submissionList(offset: $offset, limit: $limit) {
        lastKey hasNext
        submissions { id title titleSlug statusDisplay lang timestamp }
      }
    }
  `, { offset: 0, limit: 20 });
  rawList = data?.submissionList;
  console.log('hasNext:', rawList?.hasNext);
  console.log('submissions count:', rawList?.submissions?.length ?? 'null');
  if (!rawList?.submissions) {
    console.log('ERROR: submissionList returned null — session invalid or csrf mismatch');
    process.exit(1);
  }
  const subs = rawList.submissions;
  const acSubs = subs.filter(s => s.statusDisplay === 'Accepted');
  console.log(`Total: ${subs.length} | Accepted: ${acSubs.length} | Non-AC: ${subs.length - acSubs.length}`);
  console.log('\nAll submissions:');
  subs.forEach((s, i) => console.log(`  [${i}] id=${s.id} status=${s.statusDisplay} lang=${s.lang} title=${s.title}`));
} catch (err) {
  console.log('FAIL submissionList:', err.message);
  process.exit(1);
}

// ── Step 2: submissionDetails for each AC submission ──────────────────────────
console.log('\n══ STEP 2: submissionDetails for each Accepted submission ══');
const acSubs = rawList.submissions.filter(s => s.statusDisplay === 'Accepted');

if (acSubs.length === 0) {
  console.log('No Accepted submissions in first page — nothing to fetch code for.');
  process.exit(0);
}

let codeSuccessCount = 0;
let codeFailCount = 0;

for (const s of acSubs) {
  process.stdout.write(`  submissionDetails(submissionId: ${s.id}) [${s.title}] ... `);
  try {
    const data = await gql(`
      query submissionDetails($submissionId: Int!) {
        submissionDetails(submissionId: $submissionId) {
          code
          lang { name }
        }
      }
    `, { submissionId: parseInt(s.id, 10) });

    const detail = data?.submissionDetails;
    if (detail?.code && detail.code.length > 0) {
      console.log(`✅ code=${detail.code.length} chars, lang=${detail.lang?.name}`);
      codeSuccessCount++;
    } else {
      console.log(`⚠️  returned but code is empty/null: ${JSON.stringify(detail)}`);
      codeFailCount++;
    }
  } catch (err) {
    console.log(`❌ ERROR: ${err.message}`);
    codeFailCount++;
  }
  await new Promise(r => setTimeout(r, 200));
}

console.log(`\nCode fetch summary: ${codeSuccessCount} succeeded, ${codeFailCount} failed`);

// ── Step 3: Check MongoDB — do the submission IDs already exist? ───────────────
if (mongoUri && userId) {
  console.log('\n══ STEP 3: MongoDB — checking existing submissions ══');
  try {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(mongoUri);
    await client.connect();
    const db = client.db();
    
    const subIds = rawList.submissions.map(s => String(s.id));
    const problems = await db.collection('problems').find(
      { user: userId },
      { projection: { title: 1, 'submissions.submissionId': 1, 'submissions.code': 1 } }
    ).toArray();

    console.log(`Problems in DB for user: ${problems.length}`);
    
    let existingWithCode = 0;
    let existingWithoutCode = 0;
    let notFound = 0;

    for (const s of rawList.submissions) {
      const problem = problems.find(p => 
        p.submissions?.some(sub => sub.submissionId === String(s.id))
      );
      if (problem) {
        const dbSub = problem.submissions.find(sub => sub.submissionId === String(s.id));
        if (dbSub?.code && dbSub.code.length > 0) {
          existingWithCode++;
          console.log(`  ✅ ${s.id} (${s.title}) — has code (${dbSub.code.length} chars)`);
        } else {
          existingWithoutCode++;
          console.log(`  ⚠️  ${s.id} (${s.title}) — exists but code is empty`);
        }
      } else {
        notFound++;
        console.log(`  ➕ ${s.id} (${s.title}) — NOT in DB (would be inserted)`);
      }
    }

    console.log(`\nDB summary: ${existingWithCode} have code, ${existingWithoutCode} empty, ${notFound} not in DB`);
    console.log('\nCONTROLLER PREDICTION:');
    console.log(`  Pass 1 (backfill): would update ${existingWithoutCode} records (if code was fetched)`);
    console.log(`  Pass 2 (insert):   would insert ${notFound} new records`);
    console.log(`  Expected result:   ${existingWithoutCode + notFound} total changes`);
    console.log(`  Actual result was: 0 new, 0 backfilled`);
    console.log(`\n  If actual=0 but prediction>0: the arrayFilter or $ne filter is broken`);

    await client.close();
  } catch (err) {
    console.log('MongoDB check failed:', err.message);
    console.log('(Run without MONGO_URI/USER_ID to skip this step)');
  }
} else {
  console.log('\n══ STEP 3: Skipped (no MONGO_URI/USER_ID provided) ══');
  console.log('To check MongoDB state, run:');
  console.log('  node test_import_debug.mjs <SESSION> <MONGO_URI> <USER_ID>');
  console.log('Example MONGO_URI: mongodb://localhost:27017/codeinsight');
}

console.log('\n══ DIAGNOSIS ══');
if (codeSuccessCount > 0) {
  console.log(`LeetCode API is working — ${codeSuccessCount} code snippets fetched successfully.`);
  console.log('The bug is in the controller/MongoDB write path, not the LeetCode service.');
  console.log('Most likely cause: arrayFilters $set is not matching because submissionId type mismatch (String vs Int in DB).');
} else {
  console.log('LeetCode API is NOT returning code. The bug is in the service layer.');
}
