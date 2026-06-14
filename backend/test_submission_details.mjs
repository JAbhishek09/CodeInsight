/**
 * test_submission_details.mjs
 * Run: node test_submission_details.mjs <LEETCODE_SESSION>
 * Uses hardcoded AC submission IDs from the previous submissionList run.
 */

const [,, sessionCookie] = process.argv;
if (!sessionCookie) {
  console.error('Usage: node test_submission_details.mjs <LEETCODE_SESSION>');
  process.exit(1);
}

const LC_GRAPHQL = 'https://leetcode.com/graphql';

// We saw these IDs work in the previous run
const KNOWN_AC_IDS = [2029902032, 2029006683, 2028974379];

function makeHeaders(csrf = 'placeholder') {
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'Referer': 'https://leetcode.com/',
    'Origin': 'https://leetcode.com',
    'Cookie': `LEETCODE_SESSION=${sessionCookie}; csrftoken=${csrf}`,
    'X-Csrftoken': csrf,
  };
}

async function gql(query, variables = {}, csrf = 'placeholder') {
  const res = await fetch(LC_GRAPHQL, {
    method: 'POST',
    headers: makeHeaders(csrf),
    body: JSON.stringify({ query, variables }),
  });
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; }
  catch { return { status: res.status, raw: text.slice(0, 300) }; }
}

const id = KNOWN_AC_IDS[0];
console.log(`\nTesting with submission ID: ${id}`);

// ── Test submissionDetails (plural) with all argument variants ──
const variants = [
  ['submissionDetails(submissionId) Int',   `query T($id:Int!)    { submissionDetails(submissionId:$id) { code lang runtime memory } }`, { id }],
  ['submissionDetails(id) Int',             `query T($id:Int!)    { submissionDetails(id:$id)           { code lang runtime memory } }`, { id }],
  ['submissionDetails(submissionId) String',`query T($id:String!) { submissionDetails(submissionId:$id) { code lang runtime memory } }`, { id: String(id) }],
  ['submissionDetail (singular, id) Int',   `query T($id:Int!)    { submissionDetail(id:$id)            { code lang { name } } }`,       { id }],
  ['submissionDetail (singular, submissionId) Int', `query T($id:Int!) { submissionDetail(submissionId:$id) { code lang { name } } }`,  { id }],
];

for (const [label, query, variables] of variants) {
  console.log(`\n── ${label} ──`);
  const result = await gql(query, variables);
  if (result.raw) {
    console.log('Non-JSON response:', result.raw);
    continue;
  }
  const json = result.json;
  if (json.errors) {
    console.log('ERROR:', json.errors.map(e => e.message).join(' | '));
  } else {
    // Check both singular and plural field names in response
    const d = json.data?.submissionDetails ?? json.data?.submissionDetail;
    if (d) {
      console.log('✅ SUCCESS — keys:', Object.keys(d));
      console.log('code length:', d.code?.length ?? 0);
      if (d.code) console.log('preview:', d.code.slice(0, 120));
    } else {
      console.log('null result. data:', JSON.stringify(json.data));
    }
  }
}

// ── Also try submissionList again to see if null was a fluke ──
console.log('\n── submissionList sanity check ──');
const listResult = await gql(`
  query { submissionList(offset: 0, limit: 3) {
    submissions { id title statusDisplay }
  }}
`);
if (listResult.json?.errors) {
  console.log('ERROR:', listResult.json.errors[0].message);
} else {
  const subs = listResult.json?.data?.submissionList?.submissions;
  console.log('submissions:', subs ? subs.map(s => `${s.id}(${s.statusDisplay})`).join(', ') : 'null');
}
