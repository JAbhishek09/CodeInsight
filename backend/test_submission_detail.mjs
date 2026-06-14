/**
 * test_submission_detail.mjs
 * 
 * Run: node test_submission_detail.mjs <LEETCODE_SESSION> <submissionId>
 * 
 * Tests the submissionDetail query with all known argument name variants
 * to find which one LeetCode currently accepts.
 * 
 * Example:
 *   node test_submission_detail.mjs eyJ0eXAiOi... 1234567890
 */

const [,, sessionCookie, submissionId] = process.argv;

if (!sessionCookie || !submissionId) {
  console.error('Usage: node test_submission_detail.mjs <LEETCODE_SESSION> <submissionId>');
  console.error('');
  console.error('To get a submissionId: run the submissionList query first (see below),');
  console.error('or grab an ID from your LeetCode submission URL:');
  console.error('  https://leetcode.com/problems/two-sum/submissions/1234567890/');
  process.exit(1);
}

const LC_GRAPHQL = 'https://leetcode.com/graphql';

const headers = {
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Referer': 'https://leetcode.com/',
  'Origin': 'https://leetcode.com',
  'Cookie': `LEETCODE_SESSION=${sessionCookie}; csrftoken=placeholder`,
  'X-Csrftoken': 'placeholder',
};

async function tryQuery(label, query, variables) {
  console.log(`\n─── ${label} ───`);
  console.log('Variables:', JSON.stringify(variables));
  try {
    const res = await fetch(LC_GRAPHQL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    console.log('HTTP status:', res.status);
    if (json.errors) {
      console.log('GraphQL errors:', JSON.stringify(json.errors, null, 2));
    }
    if (json.data) {
      console.log('Data keys:', Object.keys(json.data));
      const detail = json.data.submissionDetail;
      if (detail) {
        console.log('✅ SUCCESS — submissionDetail fields:', Object.keys(detail));
        console.log('code present:', !!(detail.code));
        console.log('code length:', detail.code?.length ?? 0);
        if (detail.code) {
          console.log('code preview:', detail.code.slice(0, 120) + '...');
        }
      } else {
        console.log('submissionDetail is null/undefined');
        console.log('Full data:', JSON.stringify(json.data, null, 2));
      }
    }
  } catch (err) {
    console.log('Fetch error:', err.message);
  }
}

// ── Also test submissionList first to confirm session works and get real IDs ──
console.log('\n═══ Step 0: Verify session with submissionList ═══');
try {
  const listQuery = `
    query submissionList($offset: Int!, $limit: Int!) {
      submissionList(offset: $offset, limit: $limit) {
        hasNext
        submissions {
          id
          title
          titleSlug
          statusDisplay
          lang
          timestamp
        }
      }
    }
  `;
  const res = await fetch(LC_GRAPHQL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: listQuery, variables: { offset: 0, limit: 5 } }),
  });
  const json = await res.json();
  if (json.errors) {
    console.log('submissionList errors:', JSON.stringify(json.errors));
  } else {
    const subs = json.data?.submissionList?.submissions ?? [];
    console.log(`submissionList returned ${subs.length} submissions`);
    if (subs.length > 0) {
      console.log('First submission ID:', subs[0].id, '| title:', subs[0].title, '| verdict:', subs[0].statusDisplay);
      console.log('\nAll IDs:', subs.map(s => `${s.id} (${s.statusDisplay})`).join(', '));
      console.log('\nUsing first Accepted submission ID for detail tests...');
      const acSub = subs.find(s => s.statusDisplay === 'Accepted');
      if (acSub && acSub.id !== submissionId) {
        console.log(`Note: you passed ID ${submissionId}, first AC ID is ${acSub.id}`);
      }
    } else {
      console.log('No submissions returned — session may be invalid');
    }
  }
} catch (err) {
  console.log('submissionList error:', err.message);
}

const numId = parseInt(submissionId, 10);

// ── Variant 1: submissionDetail(id: $id) ─────────────────────────────────────
await tryQuery('Variant 1: submissionDetail(id: $id) [Int]', `
  query submissionDetail($id: Int!) {
    submissionDetail(id: $id) {
      code
      lang { name verboseName }
    }
  }
`, { id: numId });

// ── Variant 2: submissionDetail(submissionId: $id) ───────────────────────────
await tryQuery('Variant 2: submissionDetail(submissionId: $id) [Int]', `
  query submissionDetail($id: Int!) {
    submissionDetail(submissionId: $id) {
      code
      lang { name verboseName }
    }
  }
`, { id: numId });

// ── Variant 3: id as String ───────────────────────────────────────────────────
await tryQuery('Variant 3: submissionDetail(id: $id) [String]', `
  query submissionDetail($id: String!) {
    submissionDetail(id: $id) {
      code
      lang { name verboseName }
    }
  }
`, { id: String(submissionId) });

// ── Variant 4: introspect the submissionDetail field ─────────────────────────
console.log('\n─── Variant 4: Introspect submissionDetail args ───');
try {
  const introQuery = `
    {
      __schema {
        queryType {
          fields {
            name
            args {
              name
              type { name kind ofType { name kind } }
            }
          }
        }
      }
    }
  `;
  const res = await fetch(LC_GRAPHQL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: introQuery }),
  });
  const json = await res.json();
  if (json.errors) {
    console.log('Introspection blocked:', json.errors[0]?.message);
  } else {
    const fields = json.data?.__schema?.queryType?.fields ?? [];
    const sdField = fields.find(f => f.name === 'submissionDetail');
    if (sdField) {
      console.log('submissionDetail args:', JSON.stringify(sdField.args, null, 2));
    } else {
      console.log('submissionDetail not found in schema. Available query fields:', fields.map(f => f.name).join(', '));
    }
  }
} catch (err) {
  console.log('Introspection error:', err.message);
}

console.log('\n═══ Done ═══');
