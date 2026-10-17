import api from './axiosInstance';

/**
 * Phase 1A — Import full AC problem list.
 */
export const importLeetcodeProblems = async (sessionCookie?: string) => {
  const res = await api.post('/import/leetcode/problems', sessionCookie ? { sessionCookie } : {});
  return res.data;
};

/**
 * Phase 1B — One page of submission history WITH code via REST.
 * Paginated by numeric offset (LeetCode's own cursor field was confirmed
 * broken — it always returns "" — so plain offset increments are used instead).
 *
 * @param sessionCookie  LEETCODE_SESSION value
 * @param offset         Row offset into LeetCode's submission history; 0 for first page
 */
export const importLeetcodeCode = async (sessionCookie: string, offset = 0) => {
  const res = await api.post('/import/leetcode/code', { sessionCookie, offset });
  return res.data;
  // Returns: { fetched, attached, backfilled, hasMore, nextOffset, message,
  //            codeEnrichmentError? }
};

/**
 * Phase 1C — fetch code for each solved problem that still has none.
 * Paged by an opaque cursor (the last processed problem id), not by skip —
 * the set of problems missing code shrinks as they get filled.
 *
 * @param sessionCookie  LEETCODE_SESSION value
 * @param after          `nextCursor` from the previous call; omit for the first
 */
export const backfillLeetcodeCode = async (sessionCookie: string, after?: string | null) => {
  const res = await api.post('/import/leetcode/backfill', after ? { sessionCookie, after } : { sessionCookie });
  return res.data;
  // Returns: { processed, filled, skipped, remaining, hasMore, nextCursor,
  //            message, codeEnrichmentError? }
};

/**
 * Live code-coverage status — computed from actual submission data in MongoDB,
 * not the static historyImportStatus enum on the User document. Reflects code
 * written by the Chrome extension's live sync as well as any import passes.
 *
 * Returns: { totalProblems, acceptedSubmissions, acceptedWithCode, missingCode,
 *            solvedProblems, solvedWithCode, missingCodeProblems,
 *            status: 'none' | 'partial' | 'mixed' | 'full' }
 */
export const getCodeCoverageStatus = async () => {
  const res = await api.get('/import/leetcode/code-status');
  return res.data;
};

/**
 * One-time repair: re-fetches real difficulty AND topic tags for every
 * already-imported problem and backfills both. Needed for anyone who ran
 * Phase 1A before the GraphQL WAF-header fix, since tags/difficulty came
 * back null/empty and were silently stored that way.
 *
 * @param sessionCookie  LEETCODE_SESSION value (required — needs authenticated access)
 */
export const repairDifficultyAndTags = async (sessionCookie: string) => {
  const res = await api.post('/import/leetcode/repair-difficulty', { sessionCookie });
  return res.data;
  // Returns: { fixed, total, withTags, message }
};
