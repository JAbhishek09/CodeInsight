/**
 * leetcodeService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All LeetCode data-fetching logic.
 *
 * VERIFIED SCHEMA STATE — June 2026 (confirmed by live API testing)
 *
 * CONFIRMED WORKING QUERIES
 * ──────────────────────────
 *  PUBLIC (no session):
 *    recentSubmissionList(username, limit)    — last 20 any-verdict submissions
 *    recentAcSubmissionList(username, limit)  — last 20 AC-only submissions
 *    matchedUser / submitStatsGlobal          — solve counts per difficulty
 *
 *  SESSION-GATED:
 *    userProgressQuestionList(filters)        — FULL solved problem list
 *    submissionList(offset, limit)            — paginated list WITHOUT code
 *    submissionList(offset, limit, questionSlug) — per-problem list (GraphQL)
 *    submissionDetails(submissionId)          — single submission WITH code
 *                                               (returns null for purged subs)
 *    REST /api/submissions/?lastkey=N         — paginated list WITH code inline
 *    REST /api/submissions/{titleSlug}/       — per-problem WITH code inline (CORRECT URL)
 *
 * KNOWN LeetCode LIMITATIONS
 * ───────────────────────────
 * 1. submissionDetails returns null for ~95% of submissions older than ~18
 *    months on Free tier accounts — LeetCode purges them from CDN storage.
 *
 * 2. The REST global list /api/submissions/ covers the last ~1080 submissions
 *    (roughly 54 pages of 20). Anything outside this window has no code.
 *
 * 3. The REST per-problem endpoint /api/submissions/{slug}/ covers the
 *    per-problem window (~20 submissions per problem). Code IS present if
 *    LeetCode's per-problem cache still has it.
 *
 * 4. BUG FIXED: The previous implementation used:
 *      /api/submissions/?questionSlug={slug}
 *    This query parameter is NOT supported — LeetCode ignores it and returns
 *    the global list. The correct per-problem URL is:
 *      /api/submissions/{titleSlug}/
 */

import axios from 'axios';

const LC_BASE    = 'https://leetcode.com';
const LC_GRAPHQL = `${LC_BASE}/graphql`;

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent':   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Referer':      `${LC_BASE}/`,
  'Origin':       LC_BASE,
};

// ─── Session sanitiser ────────────────────────────────────────────────────────

/**
 * Detect and strip a doubled LEETCODE_SESSION value.
 * Users sometimes paste it twice (e.g. 1870 chars instead of ~935).
 * LeetCode rejects a doubled value with 401 — same as an expired session,
 * which is confusing. We detect the duplication and keep only the first JWT.
 */
function sanitiseSession(raw) {
  if (!raw || typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  // LeetCode JWTs all start with 'eyJ'. Find a second one after position 50.
  const secondStart = trimmed.indexOf('eyJ', 50);
  if (secondStart > 0) {
    console.warn(
      `[LC] LEETCODE_SESSION is duplicated (${trimmed.length} chars → trimming to ${secondStart} chars)`
    );
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

function makeRestHeaders(sessionCookie) {
  const clean = sanitiseSession(sessionCookie);
  return {
    'User-Agent':       DEFAULT_HEADERS['User-Agent'],
    'Referer':          `${LC_BASE}/`,
    'Origin':           LC_BASE,
    'Accept':           'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'Cookie':           `LEETCODE_SESSION=${clean}; csrftoken=ci`,
    'X-Csrftoken':      'ci',
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
// 1. RECENT SUBMISSIONS  (public, no session — max 20)
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
// 3. SUBMISSION HISTORY WITH CODE — REST /api/submissions/ (global, paginated)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch one page of submission history WITH code inline.
 * Uses the REST API — code is present for all submissions in LeetCode's window
 * (roughly the last ~1080 submissions across all problems).
 *
 * Pagination: cursor-based via `lastKey` string.
 *   First page: lastKey = ''
 *   Subsequent: use response.nextKey from previous call.
 */
export async function fetchSubmissionHistoryREST(sessionCookie, lastKey = '', limit = 20) {
  const url = `${LC_BASE}/api/submissions/?offset=0&limit=${limit}&lastkey=${encodeURIComponent(lastKey)}`;

  let res;
  try {
    res = await axios.get(url, { headers: makeRestHeaders(sessionCookie), timeout: 30000 });
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new Error(
        'LEETCODE_SESSION is expired or invalid. ' +
        'Open leetcode.com → DevTools → Application → Cookies → copy LEETCODE_SESSION and try again.'
      );
    }
    throw new Error(`LeetCode REST API failed: ${err.message}`);
  }

  const body = res.data;
  if (!body || typeof body !== 'object') throw new Error('LeetCode REST API returned unexpected format.');
  if (body.detail === 'Authentication credentials were not provided.') {
    throw new Error('LEETCODE_SESSION is expired or invalid. Please refresh it from leetcode.com.');
  }

  const rawSubs = body.submissions_dump ?? [];
  const hasNext  = body.has_next  ?? false;
  const nextKey  = body.last_key  ?? '';

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

/**
 * Fetch the best (most recent) Accepted submission with code for one problem.
 * Used by Phase 1C backfill. Falls through a 3-tier waterfall.
 *
 * TIER 1 — REST /api/submissions/{titleSlug}/  (CORRECT per-problem URL)
 *   Returns submissions for that specific problem with code inline.
 *   NOTE: The INCORRECT URL is /api/submissions/?questionSlug={slug} —
 *   that query parameter is ignored by LeetCode; it always returns the global list.
 *   The CORRECT URL puts the slug in the PATH, not as a query parameter.
 *
 * TIER 2 — GraphQL submissionList(questionSlug: ...)
 *   Returns submission IDs for the problem (no code).
 *
 * TIER 3 — GraphQL submissionDetails(submissionId)
 *   Returns code for one submission. Returns null for purged submissions.
 *
 * Returns null if no code can be retrieved (expected for old submissions).
 */
export async function fetchBestAcSubmissionForProblem(titleSlug, sessionCookie) {
  // ── Tier 1: REST per-problem (correct path-based URL) ────────────────────
  try {
    // CORRECT: slug in path (not as query param)
    const url = `${LC_BASE}/api/submissions/${encodeURIComponent(titleSlug)}/`;
    const res = await axios.get(url, {
      headers: makeRestHeaders(sessionCookie),
      timeout: 20000,
    });

    const rawSubs = res.data?.submissions_dump ?? [];

    if (rawSubs.length > 0) {
      const best = rawSubs.find(s => s.status_display === 'Accepted' && s.code && s.code.trim().length > 0);
      if (best) {
        console.log(`[LC] ✓ T1 REST "${titleSlug}" sub ${best.id}: ${best.code.length} chars`);
        return {
          submissionId: String(best.id),
          submittedAt:  new Date(parseInt(best.timestamp, 10) * 1000),
          verdict:      'Accepted',
          language:     best.lang,
          code:         best.code,
        };
      }
      // Submissions exist but no AC code — purged
      console.warn(`[LC] T1 "${titleSlug}": ${rawSubs.length} subs found but AC code is purged`);
      return null;
    }
    // 0 submissions — slug not in per-problem cache; try GraphQL
  } catch (err) {
    if (err.response?.status === 401 || err.response?.status === 403) {
      throw new Error('LEETCODE_SESSION expired during per-problem backfill.');
    }
    if (err.response?.status !== 404) {
      console.warn(`[LC] T1 REST failed for "${titleSlug}": ${err.message} → trying GraphQL`);
    }
  }

  // ── Tier 2: GraphQL submissionList with questionSlug ─────────────────────
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
      sessionCookie
    );
    const subs = data?.data?.submissionList?.submissions ?? [];
    const best = subs.find(s => s.statusDisplay === 'Accepted');

    if (!best) {
      console.warn(`[LC] T2 GraphQL: no AC found for "${titleSlug}"`);
      return null;
    }

    // ── Tier 3: submissionDetails for code ───────────────────────────────
    const code = await fetchSubmissionCode(best.id, sessionCookie);
    if (!code) {
      console.warn(`[LC] T3 submissionDetails null for "${titleSlug}" sub ${best.id} — purged by LeetCode`);
      return null;
    }

    console.log(`[LC] ✓ T3 submissionDetails "${titleSlug}" sub ${best.id}: ${code.length} chars`);
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
// 6. CODE FOR ONE SUBMISSION  (internal helper)
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
    if (code) console.log(`[LC] ✓ submissionDetails ${submissionId}: ${code.length} chars`);
    return code;
  } catch (err) {
    console.warn(`[LC] submissionDetails failed for ${submissionId}: ${err.message}`);
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. PROFILE  (public)
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
