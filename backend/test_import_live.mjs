/**
 * test_import_live.mjs
 * Tests the exact same code path as the import controller.
 * Run: node test_import_live.mjs YOUR_LEETCODE_SESSION
 */
import dns from 'node:dns/promises';
dns.setServers(['1.1.1.1', '8.8.8.8']);

import dotenv from 'dotenv';
dotenv.config();

const [,, session] = process.argv;
if (!session) { console.error('Usage: node test_import_live.mjs <LEETCODE_SESSION>'); process.exit(1); }

// Import the actual service being used by the controller
const lc = await import('./services/leetcodeService.js');

console.log('Testing fetchSubmissionHistoryREST (exact controller code path)...');
try {
  const result = await lc.fetchSubmissionHistoryREST(session.trim(), '', 5);
  console.log('SUCCESS!');
  console.log('Submissions returned:', result.submissions.length);
  console.log('hasNext:', result.hasNext);
  console.log('nextKey:', result.nextKey);
  if (result.submissions[0]) {
    const s = result.submissions[0];
    console.log('First submission:', s.submissionId, s.title, s.verdict, s.language, 'code:', s.code.length, 'chars');
  }
} catch (err) {
  console.error('FAILED:', err.message);
}
