/**
 * leetcodeService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All LeetCode data-fetching logic.
 *
 * FIX (June 2026): LeetCode REST /api/submissions/ was returning 403 even with
 * a valid LEETCODE_SESSION. Root cause: LeetCode's CDN/WAF fingerprints the
 * request headers and rejects requests that don't look like a real Chrome
 * browser. The old makeRestHeaders() was missing:
 *   - Accept-Language
 *   - sec-ch-ua / sec-ch-ua-mobile / sec-ch-ua-platform
 *   - sec-fetch-dest / sec-fetch-mode / sec-fetch-site
 *   - DNT
 * Adding the full Chromium browser header set resolves the 403.
 */

import axios from 'axios';

const LC_BASE    = 'https://leetcode.com';
const LC_GRAPHQL = `${LC_BASE}/graphql`;

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent':   BROWSER_UA,
  'Referer':      `${LC_BASE}/`,
  'Origin':       LC_BASE,
};

// Full browser fingerprint headers — required for REST API calls.
// Without these, LeetCode's WAF returns 403 even with a valid session cookie.
const BROWSER_FINGERPRINT_HEADERS = {
  'Accept':                    'application/json, text/plain, */*',
  'Accept-Language':           'en-US,en;q=0.9',
  'Accept-Encoding':           'gzip, deflate, br',
  'DNT':                       '1',
  'Connection':                'keep-alive',
  'sec-ch-ua':                 '"Chromium";v="125", "Not.A/Brand";v="24"',
  'sec-ch-ua-mobile':          '?0',
  'sec-ch-ua-platform':        '"Windows"',
  'sec-fetch-dest':            'empty',
  'sec-fetch-mode':            'cors',
  'sec-fetch-site':            'same-origin',
  'X-Requested-With':          'XMLHttpRequest',
};

// ─── Session sanitiser ────────────────────────────────────────────────────────
function sanitiseSession(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  const secondStart = trimmed.indexOf('eyJ', 50);
  if (secondStart > 0) {
    console.warn(`[LC] Doubled LEETCODE_SESSION detected — trimming from ${trimmed.length} to ${secondStart} chars`);
    return trimmed.slice(0, secondStart);
  }
  return trimmed;
}

function makeHeaders(sessionCookie = null) {
  const h = { ...DEFAULT_HEADERS };
  if (sessionCookie) {
    const clean = sanitiseSession(sessionCookie);
    h['Cookie']      = `LEETCODE_SESSION=${clean}; csrftoken=ci`;
    h['X-Csrftoken'] = 'ci';
  }
  return h;
}

// Full browser header set for REST API calls — prevents WAF 403
function makeRestHeaders(sessionCookie) {
  const clean = sanitiseSession(sessionCookie);
  return {
    'User-Agent':      BROWSER_UA,
    'Referer':         `${LC_BASE}/`,
    'Origin':          LC_BASE,
    'Cookie':          `LEETCODE_SESSION=${clean}; csrftoken=ci`,
    'X-Csrftoken':     'ci',
    ...BROWSER_FINGERPRINT_HEADERS,
  };
}

async function lcGraphQL(query, variables, sessionCookie = null) {
  let res;
  try {
    res = await axios.post(
      LC_GRAPHQL,
      { query, variables },
      { headers: makeHeaders(sessionCookie), timeout: 30000 }
    );
  } catch (err) {
    if (err.response?.status === 403) throw new Error('LeetCode returned 403 — IP may be rate-limited. Try again in a few minutes.');
    if (err.response?.status === 429) throw new Error('LeetCode rate limit hit. Wait a few minutes and try again.');
    if (err.response?.status === 400) {
      const detail = err.response?.data?.errors?.[0]?.message ?? JSON.stringify(err.response?.data).slice(0, 300);
      throw new Error(`LeetCode API 400: ${detail}`);
    }
    throw new Error(`LeetCode GraphQL request failed: ${err.message}`);
  }

  if (res.data?.errors?.length) {
    throw new Error(`LeetCode GraphQL error: ${res.data.errors.map(e => e.message).join('; ')}`);
  }

  return res.data;
}

function mapVerdict(statusDisplay) {
  const map = {
    'Accepted':              'Accepted',
    'Wrong Answer':          'Wrong Answer',
    'Time Limit Exceeded':   'TLE',
    'Memory Limit Exceeded': 'MLE',
    'Runtime Error':         'RE',
    'Compile Error':         'CE',
  };
  return map[statusDisplay] ?? 'Pending';
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. RECENT SUBMISSIONS  (public)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSubmissions(handle, sessionCookie = null, limit = 20) {
  const query = `
    query recentSubmissions($username: String!, $limit: Int!) {
      recentSubmissionList(username: $username, limit: $limit) {
        id title titleSlug statusDisplay lang timestamp
      }
    }
  `;
  const data = await lcGraphQL(query, { username: handle, limit }, sessionCookie);
  const raw = data?.data?.recentSubmissionList;
  if (!Array.isArray(raw)) {
    throw new Error(`LeetCode returned no data for "${handle}". Username may not exist or profile is private.`);
  }
  return raw.map((s) => ({
    platformProblemId: s.titleSlug, title: s.title,
    link: `${LC_BASE}/problems/${s.titleSlug}/`,
    submittedAt: new Date(parseInt(s.timestamp, 10) * 1000),
    verdict: mapVerdict(s.statusDisplay), language: s.lang,
    submissionId: s.id, code: '',
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. FULL SOLVED PROBLEM LIST
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchAllSolvedProblems(handle, sessionCookie = null) {
  return sessionCookie
    ? fetchAllSolvedProblemsAuthenticated(sessionCookie)
    : fetchRecentAcSubmissions(handle);
}

async function fetchAllSolvedProblemsAuthenticated(sessionCookie) {
  const query = `
    query userProgressQuestionList($filters: UserProgressQuestionListInput) {
      userProgressQuestionList(filters: $filters) {
        totalNum
        questions { titleSlug title difficulty questionStatus topicTags { name } }
      }
    }
  `;
  const allProblems = [];
  const PAGE_SIZE = 50;
  let skip = 0;
  let totalNum = null;

  do {
    const data = await lcGraphQL(
      query,
      { filters: { skip, limit: PAGE_SIZE, questionStatus: 'SOLVED' } },
      sessionCookie
    );
    const result = data?.data?.userProgressQuestionList;
    if (!result) {
      console.warn('[LC] userProgressQuestionList returned null — session may be expired');
      break;
    }
    totalNum = result.totalNum ?? 0;
    const questions = result.questions ?? [];
    for (const p of questions) {
      if (!p?.titleSlug) continue;
      allProblems.push({
        platformProblemId: p.titleSlug, title: p.title,
        link: `${LC_BASE}/problems/${p.titleSlug}/`,
        difficulty: p.difficulty ?? 'Medium',
        tags: (p.topicTags ?? []).map(t => t.name),
        verdict: 'Accepted', submittedAt: null, submissionId: null, language: null, code: '',
      });
    }
    skip += questions.length;
    if (questions.length < PAGE_SIZE) break;
    if (skip < totalNum) await new Promise(r => setTimeout(r, 500));
  } while (skip < totalNum);

  return allProblems;
}

async function fetchRecentAcSubmissions(handle) {
  const query = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        id title titleSlug lang timestamp
      }
    }
  `;
  const data = await lcGraphQL(query, { username: handle, limit: 20 });
  const raw = data?.data?.recentAcSubmissionList;
  if (!Array.isArray(raw)) { console.warn(`[LC] recentAcSubmissionList null for "${handle}"`); return []; }
  const seen = new Set();
  return raw
    .filter(s => { if (seen.has(s.titleSlug)) return false; seen.add(s.titleSlug); return true; })
    .map(s => ({
      platformProblemId: s.titleSlug, title: s.title,
      link: `${LC_BASE}/problems/${s.titleSlug}/`,
      difficulty: 'Medium', tags: [], verdict: 'Accepted',
      submittedAt: new Date(parseInt(s.timestamp, 10) * 1000),
      submissionId: s.id, language: s.lang, code: '',
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SUBMISSION HISTORY WITH CODE — REST /api/submissions/ (Phase 1B)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSubmissionHistoryREST(sessionCookie, lastKey = '', limit = 20) {
  const clean = sanitiseSession(sessionCookie);
  const url = `${LC_BASE}/api/submissions/?offset=0&limit=${limit}&lastkey=${encodeURIComponent(lastKey)}`;

  let res;
  try {
    res = await axios.get(url, {
      headers: makeRestHeaders(clean),
      timeout: 30000,
      // Decompress gzip — axios does this automatically but being explicit
      decompress: true,
    });
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      // Log the exact status and response body to help diagnose WAF vs auth issues
      console.error(`[LC REST] ${err.response.status} on /api/submissions/. Response:`,
        JSON.stringify(err.response.data || {}).slice(0, 300));
      throw new Error(
        'LEETCODE_SESSION is expired or invalid. ' +
        'Open leetcode.com → DevTools → Application → Cookies → copy LEETCODE_SESSION and try again.'
      );
    }
    if (err.response?.status === 429) {
      throw new Error('LeetCode rate limit hit. Wait a few minutes and try again.');
    }
    throw new Error(`LeetCode REST API failed (${err.response?.status ?? 'network'}): ${err.message}`);
  }

  const body = res.data;
  if (!body || typeof body !== 'object') {
    throw new Error('LeetCode REST API returned unexpected non-JSON format.');
  }

  // LeetCode returns this string in the body (not as HTTP 401) when the
  // session is rejected by the application layer (not the WAF)
  if (body.detail === 'Authentication credentials were not provided.' ||
      body.detail === 'Authentication credentials were not provided') {
    throw new Error(
      'LEETCODE_SESSION is expired or invalid. ' +
      'Open leetcode.com → DevTools → Application → Cookies → copy LEETCODE_SESSION and try again.'
    );
  }

  // Another possible unauthenticated response format
  if (body.error === 'Unauthorized' || body.status === 401) {
    throw new Error(
      'LEETCODE_SESSION is expired or invalid. ' +
      'Open leetcode.com → DevTools → Application → Cookies → copy LEETCODE_SESSION and try again.'
    );
  }

  const rawSubs = body.submissions_dump ?? [];
  const hasNext  = body.has_next  ?? false;
  const nextKey  = body.last_key  ?? '';

  // If we got a 200 but with no submissions_dump field, the session might be
  // accepted but returning an unexpected shape — log the raw body for diagnosis
  if (!body.submissions_dump) {
    console.warn('[LC REST] 200 response but no submissions_dump field. Body keys:', Object.keys(body));
  }

  const submissions = rawSubs.map(s => ({
    platformProblemId: s.title_slug ?? '',
    title:             s.title      ?? '',
    link:              `${LC_BASE}/problems/${s.title_slug}/`,
    submittedAt:       new Date(parseInt(s.timestamp, 10) * 1000),
    verdict:           mapVerdict(s.status_display),
    language:          s.lang       ?? '',
    submissionId:      String(s.id),
    code:              s.code       ?? '',
    runtime:           s.runtime    ?? '',
    memory:            s.memory     ?? '',
  }));

  const withCode = submissions.filter(s => s.code && s.code.trim().length > 0);
  console.log(`[LC REST] lastKey="${lastKey}": ${submissions.length} subs, ${withCode.length} with code, hasNext=${hasNext}`);

  return { submissions, hasNext, nextKey };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PER-PROBLEM BEST-AC FETCH — REST /api/submissions/{slug}/ (Phase 1C)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchBestAcSubmissionForProblem(titleSlug, sessionCookie) {
  const clean = sanitiseSession(sessionCookie);

  // ── Tier 1: REST per-problem ──────────────────────────────────────────────
  try {
    const url = `${LC_BASE}/api/submissions/${encodeURIComponent(titleSlug)}/`;
    const res = await axios.get(url, {
      headers: makeRestHeaders(clean),
      timeout: 20000,
      decompress: true,
    });

    const rawSubs = res.data?.submissions_dump ?? [];
    if (rawSubs.length > 0) {
      const best = rawSubs.find(s => s.status_display === 'Accepted' && s.code && s.code.trim().length > 0);
      if (best) {
        console.log(`[LC] T1 REST "${titleSlug}" sub ${best.id}: ${best.code.length} chars`);
        return {
          submissionId: String(best.id),
          submittedAt:  new Date(parseInt(best.timestamp, 10) * 1000),
          verdict:      'Accepted',
          language:     best.lang,
          code:         best.code,
        };
      }
      console.warn(`[LC] T1 "${titleSlug}": ${rawSubs.length} subs found but AC code is purged`);
      return null;
    }
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new Error('LEETCODE_SESSION expired during per-problem backfill.');
    }
    if (err.response?.status !== 404) {
      console.warn(`[LC] T1 REST failed for "${titleSlug}": ${err.message} — trying GraphQL`);
    }
  }

  // ── Tier 2: GraphQL submissionList + Tier 3: submissionDetails ────────────
  try {
    const listQuery = `
      query submissionListForProblem($offset: Int!, $limit: Int!, $questionSlug: String!) {
        submissionList(offset: $offset, limit: $limit, questionSlug: $questionSlug) {
          submissions { id titleSlug statusDisplay lang timestamp }
        }
      }
    `;
    const data = await lcGraphQL(
      listQuery,
      { offset: 0, limit: 20, questionSlug: titleSlug },
      clean
    );
    const subs = data?.data?.submissionList?.submissions ?? [];
    const best = subs.find(s => s.statusDisplay === 'Accepted');
    if (!best) {
      console.warn(`[LC] T2 GraphQL: no AC found for "${titleSlug}"`);
      return null;
    }

    const code = await fetchSubmissionCode(best.id, clean);
    if (!code) {
      console.warn(`[LC] T3 submissionDetails null for "${titleSlug}" sub ${best.id} — purged`);
      return null;
    }
    console.log(`[LC] T3 submissionDetails "${titleSlug}" sub ${best.id}: ${code.length} chars`);
    return {
      submissionId: String(best.id),
      submittedAt:  new Date(parseInt(best.timestamp, 10) * 1000),
      verdict:      'Accepted',
      language:     best.lang,
      code,
    };
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new Error('LEETCODE_SESSION expired during per-problem backfill.');
    }
    console.warn(`[LC] All tiers failed for "${titleSlug}": ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. GRAPHQL FALLBACK: submissionList (no code)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSubmissionHistory(handle, sessionCookie, offset = 0, limit = 20) {
  const listQuery = `
    query submissionList($offset: Int!, $limit: Int!) {
      submissionList(offset: $offset, limit: $limit) {
        lastKey hasNext
        submissions { id title titleSlug statusDisplay lang timestamp runtime memory }
      }
    }
  `;
  const data = await lcGraphQL(listQuery, { offset, limit }, sessionCookie);
  const result = data?.data?.submissionList;

  if (!result) {
    throw new Error(
      'LEETCODE_SESSION is expired or invalid. ' +
      'Copy a fresh LEETCODE_SESSION from leetcode.com (DevTools → Application → Cookies).'
    );
  }

  return {
    submissions: (result.submissions ?? []).map(s => ({
      platformProblemId: s.titleSlug, title: s.title,
      link: `${LC_BASE}/problems/${s.titleSlug}/`,
      submittedAt: new Date(parseInt(s.timestamp, 10) * 1000),
      verdict: mapVerdict(s.statusDisplay), language: s.lang,
      submissionId: s.id, code: '',
    })),
    hasMore: result.hasNext ?? false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CODE FOR ONE SUBMISSION (internal)
// ─────────────────────────────────────────────────────────────────────────────

async function fetchSubmissionCode(submissionId, sessionCookie) {
  const query = `
    query submissionDetails($submissionId: Int!) {
      submissionDetails(submissionId: $submissionId) {
        code
        lang { name }
      }
    }
  `;
  try {
    const data = await lcGraphQL(
      query,
      { submissionId: parseInt(submissionId, 10) },
      sessionCookie
    );
    const code = data?.data?.submissionDetails?.code ?? '';
    if (code) console.log(`[LC] submissionDetails ${submissionId}: ${code.length} chars`);
    return code;
  } catch (err) {
    console.warn(`[LC] submissionDetails failed for ${submissionId}: ${err.message}`);
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PROFILE (public)
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchProfile(handle) {
  const query = `
    query userProfile($username: String!) {
      matchedUser(username: $username) {
        username
        submitStatsGlobal { acSubmissionNum { difficulty count } }
      }
    }
  `;
  try {
    const data = await lcGraphQL(query, { username: handle });
    return data?.data?.matchedUser ?? null;
  } catch {
    return null;
  }
}
