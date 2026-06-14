/**
 * test_lc_sync.mjs
 * Run: node test_lc_sync.mjs
 *
 * Tests:
 *  1. parseLeetcodeHandle() against all URL formats
 *  2. Live GraphQL call to LeetCode with a known public user
 */

import { parseLeetcodeHandle, parseCodeforcesHandle } from './utils/parseHandle.js';

// ── 1. Parse tests ────────────────────────────────────────────────────────────
console.log('\n=== parseLeetcodeHandle tests ===');
const cases = [
  ['krishna_rathi66',                                    'krishna_rathi66'],
  ['https://leetcode.com/u/krishna_rathi66/',            'krishna_rathi66'],
  ['https://leetcode.com/krishna_rathi66/',              'krishna_rathi66'],
  ['https://leetcode.com/u/krishna_rathi66',             'krishna_rathi66'],
  ['  krishna_rathi66  ',                                'krishna_rathi66'],
  ['https://leetcode.com/u/',                            null],
  ['',                                                   null],
  ['https://codeforces.com/profile/tourist',             null], // wrong platform
];

let allPassed = true;
for (const [input, expected] of cases) {
  const got = parseLeetcodeHandle(input);
  const pass = got === expected;
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] "${input}" → "${got}" (expected "${expected}")`);
  if (!pass) allPassed = false;
}
console.log(allPassed ? '\nAll parse tests PASSED ✓' : '\nSome parse tests FAILED ✗');

// ── 2. Live GraphQL test ──────────────────────────────────────────────────────
console.log('\n=== Live LeetCode GraphQL test ===');
const handle = 'krishna_rathi66'; // change to any known public LeetCode user
const query = `
  query recentSubmissions($username: String!, $limit: Int!) {
    recentSubmissionList(username: $username, limit: $limit) {
      id
      title
      titleSlug
      statusDisplay
      lang
      timestamp
    }
  }
`;

try {
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (compatible; CodeInsight/1.0)',
      'Referer': 'https://leetcode.com',
      'Origin': 'https://leetcode.com',
    },
    body: JSON.stringify({ query, variables: { username: handle, limit: 20 } }),
  });

  const json = await res.json();
  const subs = json?.data?.recentSubmissionList;

  if (!Array.isArray(subs)) {
    console.log('  [FAIL] recentSubmissionList is not an array:', JSON.stringify(json, null, 2));
  } else {
    console.log(`  [PASS] Got ${subs.length} submission(s) for "${handle}"`);
    if (subs.length > 0) {
      console.log('  First submission:', JSON.stringify(subs[0], null, 2));
    } else {
      console.log('  (Profile may have no recent submissions, or submissions are private)');
    }
  }
} catch (e) {
  console.log('  [ERROR]', e.message);
}
