/**
 * codeforcesService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches submission data from the public Codeforces REST API.
 *
 * ARCHITECTURE NOTES
 * ──────────────────
 * • CF's public API requires NO authentication key for user.status calls.
 * • RATE LIMIT: Codeforces enforces roughly 1 authenticated request/second and
 *   ~5 requests/second unauthenticated from the same IP.  We add a small delay
 *   helper that callers can use when syncing multiple users in a queue.
 * • The API returns full submission metadata including the verdict string.
 *   Code text is NOT returned — CF requires a separate authenticated scrape for
 *   that.  We store an empty string for `code` on CF submissions; the AI analysis
 *   panel will show a "code unavailable" message when code is empty.
 * • University networks in India generally reach codeforces.com without issue.
 *   We use a 15 s timeout to tolerate occasional slowness.
 */

import axios from 'axios';

const CF_API = 'https://codeforces.com/api';

/**
 * Map Codeforces verdict strings to our internal enum values.
 */
function mapVerdict(cfVerdict) {
  const map = {
    'OK':                   'Accepted',
    'WRONG_ANSWER':         'Wrong Answer',
    'TIME_LIMIT_EXCEEDED':  'TLE',
    'MEMORY_LIMIT_EXCEEDED':'MLE',
    'RUNTIME_ERROR':        'RE',
    'COMPILATION_ERROR':    'CE',
    'TESTING':              'Pending',
    'PARTIAL':              'Pending',
  };
  return map[cfVerdict] ?? 'Pending';
}

/**
 * Fetch the last `count` submissions for `handle`.
 *
 * @param {string} handle   - Codeforces username (case-sensitive)
 * @param {number} [count=100]
 * @returns {Promise<Array>} - Normalised submission objects ready for DB upsert
 */
export async function fetchSubmissions(handle, count = 100) {
  const url = `${CF_API}/user.status?handle=${encodeURIComponent(handle)}&from=1&count=${count}`;

  let data;
  try {
    const response = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'CodeInsight/1.0' },
    });
    data = response.data;
  } catch (err) {
    throw new Error(`Codeforces API request failed: ${err.message}`);
  }

  if (data.status !== 'OK') {
    throw new Error(`Codeforces API error for "${handle}": ${data.comment ?? 'Unknown error'}`);
  }

  return data.result.map((sub) => {
    const contestId = sub.contestId ?? sub.problem?.contestId ?? '';
    const index     = sub.problem?.index ?? '';
    const pid       = `${contestId}${index}`;

    return {
      platformProblemId: pid,
      title:             sub.problem?.name ?? pid,
      link:              contestId
        ? `https://codeforces.com/contest/${contestId}/problem/${index}`
        : `https://codeforces.com/problemset/problem/${contestId}/${index}`,
      difficulty:        resolveCFDifficulty(sub.problem?.rating),
      tags:              sub.problem?.tags ?? [],
      submittedAt:       new Date(sub.creationTimeSeconds * 1000),
      verdict:           mapVerdict(sub.verdict),
      language:          sub.programmingLanguage ?? 'Unknown',
      submissionId:      String(sub.id),
      code:              '',  // CF API does not return code in this endpoint
    };
  });
}

/**
 * Map a Codeforces problem rating to a human-readable difficulty label.
 * CF uses integer ratings (800–3500), not Easy/Medium/Hard.
 */
function resolveCFDifficulty(rating) {
  if (!rating) return 'unrated';
  if (rating <= 1200) return 'Div3';
  if (rating <= 1800) return 'Div2';
  return 'Div1';
}

/**
 * Fetch basic profile info for a Codeforces handle.
 * Returns null if the user does not exist.
 */
export async function fetchProfile(handle) {
  try {
    const { data } = await axios.get(
      `${CF_API}/user.info?handles=${encodeURIComponent(handle)}`,
      { timeout: 10000 }
    );
    if (data.status === 'OK' && data.result?.length > 0) {
      return data.result[0];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Small delay helper — use between batch sync calls to respect CF rate limits.
 * @param {number} [ms=1100]
 */
export function cfDelay(ms = 1100) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
