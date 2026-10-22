/**
 * leetcodeService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX (June 2026 — WAF): Added full Chromium browser fingerprint headers to
 * prevent LeetCode WAF from returning 403 on REST API calls.
 *
 * FIX (July 2026 — Empty code): LeetCode's REST /api/submissions/ endpoint
 * does NOT return source code for submissions older than ~30 days. The `code`
 * field is present in the JSON response but is always "" for old submissions.
 *
 * Root cause of "0 submissions with code" after import:
 *   Phase 1B paginated all 77 pages (1540 submissions) but every record had
 *   code:"" because the REST endpoint purged it. Phase 1C then called the
 *   per-problem REST endpoint which has the same purge, so it also returned
 *   empty code. Net result: all records inserted, 0 code attached.
 *
 * THE REAL SOURCE OF CODE: submissionDetails GraphQL query. This is the only
 * LeetCode API that reliably returns source code for any submission by ID
 * regardless of age. Phase 1C (backfill) calls it through
 * the exported fetchSubmissionCodeById.
 *
 * STRATEGY:
 *  Phase 1B — REST pagination for metadata (IDs, verdicts, timestamps), plus
 *              code only where REST still returns it (recent submissions).
 *  Phase 1C — If a problem already has a submissionId in MongoDB (put there
 *              by Phase 1B), call fetchSubmissionCodeById directly (1 request).
 *              Otherwise fall back to fetchBestAcSubmissionForProblem which
 *              discovers the ID via REST then calls submissionDetails.
 */

import axios from 'axios';
import crypto from 'crypto';

const LC_BASE    = 'https://leetcode.com';
const LC_GRAPHQL = `${LC_BASE}/graphql`;

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent':   BROWSER_UA,
  'Referer':      `${LC_BASE}/`,
  'Origin':       LC_BASE,
};

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

function sanitiseSession(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  let trimmed = raw.trim();

  // Strip surrounding quotes some browsers/extensions include when copying
  // a cookie value via "Copy value".
  trimmed = trimmed.replace(/^['"]+|['"]+$/g, '');

  // CASE 1: the user pasted a full Cookie header or the whole cookie jar
  // (e.g. "csrftoken=abc; LEETCODE_SESSION=eyJ...; messages=...") instead of
  // just the LEETCODE_SESSION row's value. This is what produced a
  // 23,249-char paste in testing — the old heuristic below (looking for a
  // second "eyJ" at a fixed offset) sliced that blindly and landed on
  // garbage, causing a 401 even though a valid session was in there.
  // Extract the actual value by name wherever it sits in the string.
  const namedMatch = trimmed.match(/LEETCODE_SESSION=([^;]+)/);
  if (namedMatch) {
    const extracted = namedMatch[1].trim();
    if (extracted !== trimmed) {
      console.warn(`[LC] Full cookie header pasted (${trimmed.length} chars) — extracted LEETCODE_SESSION value only (${extracted.length} chars)`);
    }
    trimmed = extracted;
  }

  // CASE 2: the raw session value itself got doubled by an accidental
  // double-paste. A real LEETCODE_SESSION is one JWT, so a second "eyJ"
  // header segment showing up well past the start means everything from
  // there on is a duplicate, not extra legitimate content.
  const secondStart = trimmed.indexOf('eyJ', 50);
  if (secondStart > 0) {
    console.warn(`[LC] Doubled LEETCODE_SESSION value detected — trimming from ${trimmed.length} to ${secondStart} chars`);
    trimmed = trimmed.slice(0, secondStart);
  }

  if (trimmed.length < 100) {
    console.warn(`[LC] LEETCODE_SESSION is only ${trimmed.length} chars after cleanup — that's shorter than a real session token and will likely 401. Re-copy just the LEETCODE_SESSION cookie's VALUE column from DevTools → Application → Cookies (not the whole Cookie header).`);
  }

  return trimmed;
}

function makeHeaders(sessionCookie = null) {
  // FIX (July 2026): GraphQL calls (including submissionDetails, the only
  // reliable source of code for old submissions) were missing the same
  // browser-fingerprint headers that were added to REST calls in the June
  // 2026 WAF fix. Without them, LeetCode's WAF silently 403s these POST
  // requests — the error was caught and swallowed in fetchSubmissionCode,
  // so every import ran to completion reporting '0 submissions with code'
  // with no visible error anywhere. Bringing GraphQL headers in line with
  // REST headers is the fix.
  const h = { ...DEFAULT_HEADERS, ...BROWSER_FINGERPRINT_HEADERS };
  if (sessionCookie) {
    const clean = sanitiseSession(sessionCookie);
    h['Cookie']      = `LEETCODE_SESSION=${clean}; csrftoken=ci`;
    h['X-Csrftoken'] = 'ci';
  }
  return h;
}

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

/**
 * Which LeetCode user a LEETCODE_SESSION belongs to (null if not signed in).
 * Cached briefly so paginated import calls don't re-check on every page.
 */
const sessionOwnerCache = new Map(); // sha256(session) → { username, at }
const SESSION_OWNER_TTL_MS = 10 * 60 * 1000;

export async function fetchSessionUsername(sessionCookie) {
  const key = crypto.createHash('sha256').update(sanitiseSession(sessionCookie)).digest('hex');
  const cached = sessionOwnerCache.get(key);
  if (cached && Date.now() - cached.at < SESSION_OWNER_TTL_MS) return cached.username;

  const data = await lcGraphQL(
    'query globalData { userStatus { isSignedIn username } }', {}, sessionCookie
  );
  const status = data?.data?.userStatus;
  const username = status?.isSignedIn && status.username ? status.username : null;
  if (username) sessionOwnerCache.set(key, { username, at: Date.now() });
  return username;
}

async function lcGraphQL(query, variables, sessionCookie = null) {
  let res;
  try {
    res = await axios.post(
      LC_GRAPHQL,
      { query, variables },
      { headers: makeHeaders(sessionCookie), timeout: 15000 }
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

// LeetCode returns difficulty as 'EASY'/'MEDIUM'/'HARD' from some queries and
// 'Easy'/'Medium'/'Hard' from others; the app only understands the latter.
export function normaliseDifficulty(raw) {
  return { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' }[String(raw ?? '').toUpperCase()] ?? null;
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
// 1. RECENT SUBMISSIONS (public)
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
    if (!result) { console.warn('[LC] userProgressQuestionList null — session may be expired'); break; }
    totalNum = result.totalNum ?? 0;
    const questions = result.questions ?? [];
    for (const p of questions) {
      if (!p?.titleSlug) continue;
      allProblems.push({
        platformProblemId: p.titleSlug, title: p.title,
        link: `${LC_BASE}/problems/${p.titleSlug}/`,
        difficulty: normaliseDifficulty(p.difficulty) ?? 'Medium',
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

/**
 * Difficulty + topic tags for specific problems, 50 per GraphQL request via
 * aliases. Needed because userProgressQuestionList stops at 600 problems
 * (observed live: 988 solved, 600 returned), leaving the rest without tags.
 * Public data: works without a session.
 * Returns Map<slug, { title, difficulty, tags } | null> — null when LeetCode
 * answered that there's no such problem; slugs in a failed request are left out.
 */
export async function fetchQuestionMeta(slugs, sessionCookie = null) {
  const meta = new Map();
  const CHUNK = 50;
  for (let i = 0; i < slugs.length; i += CHUNK) {
    const chunk = slugs.slice(i, i + CHUNK);
    const varDefs = chunk.map((_, j) => `$s${j}: String!`).join(', ');
    const fields  = chunk.map((_, j) =>
      `q${j}: question(titleSlug: $s${j}) { titleSlug title difficulty topicTags { name } }`
    ).join('\n');
    const variables = Object.fromEntries(chunk.map((slug, j) => [`s${j}`, slug]));
    try {
      const data = await lcGraphQL(`query questionMeta(${varDefs}) {\n${fields}\n}`, variables, sessionCookie);
      chunk.forEach((slug, j) => {
        const q = data?.data?.[`q${j}`];
        meta.set(slug, q ? {
          title: q.title,
          difficulty: normaliseDifficulty(q.difficulty),
          tags: (q.topicTags ?? []).map(t => t.name),
        } : null);
      });
    } catch (err) {
      console.warn(`[LC] questionMeta chunk ${i / CHUNK + 1} failed: ${err.message}`);
    }
    if (i + CHUNK < slugs.length) await new Promise(r => setTimeout(r, 500));
  }
  return meta;
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
      // Not in this list: problemMetaService fills difficulty and tags afterwards
      difficulty: null, tags: [], verdict: 'Accepted',
      submittedAt: new Date(parseInt(s.timestamp, 10) * 1000),
      submissionId: s.id, language: s.lang, code: '',
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SUBMISSION HISTORY WITH CODE — REST metadata (Phase 1B)
//
// REST /api/submissions/ returns code:"" for submissions >~30 days old. That is
// fine here: this pass only collects IDs/verdicts; Phase 1C fetches missing
// code per problem via submissionDetails.
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSubmissionHistoryREST(sessionCookie, offset = 0, limit = 20) {
  const clean = sanitiseSession(sessionCookie);
  // FIX (July 2026 — broken cursor): LeetCode's `last_key` field was
  // confirmed to always come back as "" even when has_next is true
  // ({"has_next":true,"last_key":""}), which made lastkey-based pagination
  // loop on the exact same page forever. Switched to plain numeric offset
  // pagination instead, which doesn't depend on that broken field at all.
  const url = `${LC_BASE}/api/submissions/?offset=${offset}&limit=${limit}`;

  let res;
  try {
    res = await axios.get(url, {
      headers: makeRestHeaders(clean),
      timeout: 30000,
      decompress: true,
    });
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      console.error(`[LC REST] ${err.response.status} on /api/submissions/. Response:`,
        JSON.stringify(err.response.data || {}).slice(0, 300));
      throw new Error(
        'LEETCODE_SESSION is expired or invalid. ' +
        'Open leetcode.com → DevTools → Application → Cookies → copy LEETCODE_SESSION and try again.'
      );
    }
    if (err.response?.status === 429) throw new Error('LeetCode rate limit hit. Wait a few minutes and try again.');
    throw new Error(`LeetCode REST API failed (${err.response?.status ?? 'network'}): ${err.message}`);
  }

  const body = res.data;
  if (!body || typeof body !== 'object') throw new Error('LeetCode REST API returned unexpected non-JSON format.');

  if (body.detail === 'Authentication credentials were not provided.' ||
      body.detail === 'Authentication credentials were not provided') {
    throw new Error('LEETCODE_SESSION is expired or invalid. Open leetcode.com → DevTools → Application → Cookies → copy LEETCODE_SESSION and try again.');
  }
  if (body.error === 'Unauthorized' || body.status === 401) {
    throw new Error('LEETCODE_SESSION is expired or invalid. Open leetcode.com → DevTools → Application → Cookies → copy LEETCODE_SESSION and try again.');
  }

  const rawSubs = body.submissions_dump ?? [];
  const hasNext  = body.has_next  ?? false;

  if (!body.submissions_dump) {
    console.warn('[LC REST] 200 but no submissions_dump. Body keys:', Object.keys(body));
  }

  // DIAGNOSTIC (July 2026): kept so we can see the raw shape at a glance if
  // anything else about this endpoint's response ever shifts again.
  const rawTopLevel = Object.fromEntries(
    Object.entries(body).filter(([, v]) => typeof v !== 'object' || v === null)
  );
  console.log(`[LC REST] raw pagination fields:`, JSON.stringify(rawTopLevel));

  const submissions = rawSubs.map(s => ({
    platformProblemId: s.title_slug ?? '',
    title:             s.title      ?? '',
    link:              `${LC_BASE}/problems/${s.title_slug}/`,
    submittedAt:       new Date(parseInt(s.timestamp, 10) * 1000),
    verdict:           mapVerdict(s.status_display),
    language:          s.lang       ?? '',
    submissionId:      String(s.id),
    // REST purges code for old subs — we enrich below via submissionDetails
    code:              (s.code && s.code.trim().length > 0) ? s.code.trim() : '',
    runtime:           s.runtime    ?? '',
    memory:            s.memory     ?? '',
  }));

  // NOTE: no per-submission submissionDetails enrichment here any more. Doing
  // it for every AC submission on every page (sequentially, with delays) was
  // what made the import take forever. Pass 2 (backfill) now fetches code for
  // just the latest AC submission of each solved problem that still lacks it.

  const withCode = submissions.filter(s => s.code && s.code.trim().length > 0);
  console.log(`[LC REST] offset ${offset}: ${submissions.length} subs, ${withCode.length} with code, hasNext=${hasNext}`);

  return { submissions, hasNext, nextOffset: offset + submissions.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. fetchSubmissionCodeById — PUBLIC export for Phase 1C fast path
//
// When Phase 1C already has a submissionId from MongoDB (put there by Phase 1B),
// it calls this directly instead of going through the REST per-problem discovery
// flow (which also returns empty code for old submissions).
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchSubmissionCodeById(submissionId, sessionCookie) {
  return fetchSubmissionCode(submissionId, sessionCookie);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PER-PROBLEM BEST-AC FETCH — discovery fallback for Phase 1C
//
// Used when a problem has no submissionId in MongoDB at all (Phase 1A-only
// problems, or old problems beyond Phase 1B's REST cursor window).
// Tries REST per-problem to get the submission ID, then calls submissionDetails.
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchBestAcSubmissionForProblem(titleSlug, sessionCookie) {
  const clean = sanitiseSession(sessionCookie);

  // Tier 1: REST per-problem — for ID discovery + code if recent enough
  try {
    const url = `${LC_BASE}/api/submissions/${encodeURIComponent(titleSlug)}/`;
    const res = await axios.get(url, {
      headers: makeRestHeaders(clean),
      timeout: 15000,
      decompress: true,
    });

    const rawSubs = res.data?.submissions_dump ?? [];
    if (rawSubs.length > 0) {
      const acSubs = rawSubs.filter(s => s.status_display === 'Accepted');
      if (acSubs.length === 0) {
        console.warn(`[LC] T1 "${titleSlug}": ${rawSubs.length} subs but none Accepted`);
        return null;
      }

      // If REST has code (recent submission), use it directly
      const bestWithCode = acSubs.find(s => s.code && s.code.trim().length > 0);
      if (bestWithCode) {
        console.log(`[LC] T1 REST "${titleSlug}" sub ${bestWithCode.id}: ${bestWithCode.code.length} chars`);
        return {
          submissionId: String(bestWithCode.id),
          submittedAt:  new Date(parseInt(bestWithCode.timestamp, 10) * 1000),
          verdict:      'Accepted',
          language:     bestWithCode.lang,
          code:         bestWithCode.code,
        };
      }

      // REST has no code (old sub) — use submissionDetails with the ID we found
      const bestAc = acSubs[0];
      console.log(`[LC] T1 "${titleSlug}": REST code purged for sub ${bestAc.id}, calling submissionDetails`);
      const code = await fetchSubmissionCode(bestAc.id, clean);
      if (code && code.trim().length > 0) {
        console.log(`[LC] T1+Details "${titleSlug}" sub ${bestAc.id}: ${code.length} chars`);
        return {
          submissionId: String(bestAc.id),
          submittedAt:  new Date(parseInt(bestAc.timestamp, 10) * 1000),
          verdict:      'Accepted',
          language:     bestAc.lang,
          code,
        };
      }

      console.warn(`[LC] T1 "${titleSlug}" sub ${bestAc.id}: submissionDetails also empty — may be purged by LC`);
      return null;
    }
  } catch (err) {
    if (err.response?.status === 401) {
      throw new Error('LEETCODE_SESSION expired during per-problem backfill.');
    }
    // 403 here is LeetCode throttling the REST endpoint (observed live after
    // ~20 rapid history pages), not an expired session — GraphQL still works.
    if (err.response?.status === 403) {
      console.warn(`[LC] T1 REST 403 for "${titleSlug}" (throttled) — trying GraphQL`);
    } else if (err.response?.status !== 404) {
      console.warn(`[LC] T1 REST failed for "${titleSlug}": ${err.message} — trying GraphQL`);
    }
  }

  // Tier 2: GraphQL submissionList (ID discovery) + Tier 3: submissionDetails (code)
  try {
    const listQuery = `
      query submissionListForProblem($offset: Int!, $limit: Int!, $questionSlug: String!) {
        submissionList(offset: $offset, limit: $limit, questionSlug: $questionSlug) {
          submissions { id titleSlug statusDisplay lang timestamp }
        }
      }
    `;
    const data = await lcGraphQL(listQuery, { offset: 0, limit: 20, questionSlug: titleSlug }, clean);
    const subs = data?.data?.submissionList?.submissions ?? [];
    const best = subs.find(s => s.statusDisplay === 'Accepted');
    if (!best) { console.warn(`[LC] T2 GraphQL: no AC found for "${titleSlug}"`); return null; }

    const code = await fetchSubmissionCode(best.id, clean);
    if (!code || code.trim().length === 0) {
      console.warn(`[LC] T3 submissionDetails empty for "${titleSlug}" sub ${best.id} — purged`);
      return null;
    }
    console.log(`[LC] T3 "${titleSlug}" sub ${best.id}: ${code.length} chars`);
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
// 6. GRAPHQL FALLBACK: submissionList (no code)
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
    throw new Error('LEETCODE_SESSION is expired or invalid. Copy a fresh LEETCODE_SESSION from leetcode.com (DevTools → Application → Cookies).');
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
// 7. CODE FOR ONE SUBMISSION — submissionDetails GraphQL (internal)
//
// THE ONLY reliable source of code for any submission by ID, regardless of age.
// REST endpoints purge the code field for old submissions; this query does not.
// Exported publicly as fetchSubmissionCodeById for Phase 1C fast path.
// ─────────────────────────────────────────────────────────────────────────────

// Module-level record of the most recent submissionDetails failure, so
// callers several layers up (the import controller, ultimately the user)
// can see *why* code enrichment is failing instead of just seeing zeros.
let lastCodeFetchError = null;
export function getLastCodeFetchError() {
  return lastCodeFetchError;
}

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
    else lastCodeFetchError = `submissionDetails for ${submissionId} returned no code (null/empty) with no GraphQL error — LeetCode may be withholding it for this submission.`;
    return code;
  } catch (err) {
    lastCodeFetchError = `submissionDetails for ${submissionId} threw: ${err.message}`;
    console.warn(`[LC] submissionDetails failed for ${submissionId}: ${err.message}`);
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. PROFILE (public)
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
