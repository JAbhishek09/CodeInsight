/**
 * test_final.mjs — confirms all three fixes work end-to-end
 * Run: node test_final.mjs <LEETCODE_SESSION>
 */
const [,, sessionCookie] = process.argv;
if (!sessionCookie) { console.error('Usage: node test_final.mjs <LEETCODE_SESSION>'); process.exit(1); }

const LC_GRAPHQL = 'https://leetcode.com/graphql';
const csrf = 'ci';  // FIX: matched csrf token (not "placeholder")
const headers = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0',
  'Referer': 'https://leetcode.com/',
  'Origin': 'https://leetcode.com',
  'Cookie': `LEETCODE_SESSION=${sessionCookie}; csrftoken=${csrf}`,
  'X-Csrftoken': csrf,
};

async function gql(query, variables = {}) {
  const res = await fetch(LC_GRAPHQL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
  return res.json();
}

// Step 1: submissionList
console.log('\n── Test 1: submissionList (csrf fix) ──');
const list = await gql(`query { submissionList(offset:0, limit:5) { hasNext submissions { id title statusDisplay } } }`);
if (list.errors) { console.log('FAIL:', list.errors[0].message); process.exit(1); }
const subs = list.data?.submissionList?.submissions ?? [];
console.log(`✅ Got ${subs.length} submissions`);
const acSub = subs.find(s => s.statusDisplay === 'Accepted');
if (!acSub) { console.log('No AC submission in first 5, try offset'); process.exit(1); }
console.log(`   Using: ${acSub.id} — ${acSub.title}`);

// Step 2: submissionDetails (plural, submissionId arg, lang as object)
console.log('\n── Test 2: submissionDetails (plural, correct arg + lang shape) ──');
const detail = await gql(
  `query submissionDetails($submissionId: Int!) { submissionDetails(submissionId: $submissionId) { code lang { name } } }`,
  { submissionId: parseInt(acSub.id) }
);
if (detail.errors) {
  console.log('FAIL:', detail.errors.map(e => e.message).join(' | '));
} else {
  const d = detail.data?.submissionDetails;
  if (d?.code) {
    console.log(`✅ Got code! Length: ${d.code.length} chars, lang: ${d.lang?.name}`);
    console.log(`   Preview: ${d.code.slice(0, 150)}...`);
  } else {
    console.log('FAIL: submissionDetails returned null or empty code:', JSON.stringify(d));
  }
}
