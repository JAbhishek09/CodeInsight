/**
 * test_rest_headers.mjs
 * Verifies the full browser header set resolves the 403 on /api/submissions/
 * Run: node test_rest_headers.mjs YOUR_LEETCODE_SESSION
 */
import dns from 'node:dns/promises';
dns.setServers(['1.1.1.1', '8.8.8.8']);

const [,, session] = process.argv;
if (!session) { console.error('Usage: node test_rest_headers.mjs <LEETCODE_SESSION>'); process.exit(1); }

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const headers = {
  'User-Agent':          UA,
  'Referer':             'https://leetcode.com/',
  'Origin':              'https://leetcode.com',
  'Cookie':              `LEETCODE_SESSION=${session.trim()}; csrftoken=ci`,
  'X-Csrftoken':         'ci',
  'Accept':              'application/json, text/plain, */*',
  'Accept-Language':     'en-US,en;q=0.9',
  'Accept-Encoding':     'gzip, deflate, br',
  'DNT':                 '1',
  'Connection':          'keep-alive',
  'sec-ch-ua':           '"Chromium";v="125", "Not.A/Brand";v="24"',
  'sec-ch-ua-mobile':    '?0',
  'sec-ch-ua-platform':  '"Windows"',
  'sec-fetch-dest':      'empty',
  'sec-fetch-mode':      'cors',
  'sec-fetch-site':      'same-origin',
  'X-Requested-With':    'XMLHttpRequest',
};

console.log('Testing REST /api/submissions/ with full browser headers...');
const res = await fetch('https://leetcode.com/api/submissions/?offset=0&limit=5&lastkey=', { headers });
console.log('HTTP status:', res.status);

const text = await res.text();
let json;
try { json = JSON.parse(text); } catch { console.log('Non-JSON response:', text.slice(0, 200)); process.exit(1); }

if (json.detail) { console.log('Auth error:', json.detail); process.exit(1); }
if (json.submissions_dump) {
  console.log(`\nSUCCESS — got ${json.submissions_dump.length} submissions, has_next=${json.has_next}`);
  const first = json.submissions_dump[0];
  if (first) console.log(`First: id=${first.id} title="${first.title}" code=${first.code?.length ?? 0} chars`);
} else {
  console.log('Unexpected shape. Keys:', Object.keys(json));
}
