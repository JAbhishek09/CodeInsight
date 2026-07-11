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
 * Phase 1C — Per-problem backfill.
 * For problems that still have submissions with empty code after Phase 1B,
 * fetches the best AC submission code directly via submissionDetails.
 *
 * @param sessionCookie  LEETCODE_SESSION value
 * @param skip           Offset over Problem documents (not LeetCode pages)
 * @param limit          Problems to process per call (default 20)
 */
export const backfillLeetcodeCode = async (sessionCookie: string, skip = 0, limit = 20) => {
  const res = await api.post('/import/leetcode/backfill', { sessionCookie, skip, limit });
  return res.data;
  // Returns: { processed, backfilled, hasMore, nextSkip, message,
  //            codeEnrichmentError? }
};

/**
 * Live code-coverage status — computed from actual submission data in MongoDB,
 * not the static historyImportStatus enum on the User document. Reflects code
 * written by the Chrome extension's live sync as well as any import passes.
 *
 * Returns: { totalProblems, acceptedSubmissions, acceptedWithCode, missingCode,
 *            status: 'none' | 'partial' | 'mixed' | 'full' }
 */
export const getCodeCoverageStatus = async () => {
  const res = await api.get('/import/leetcode/code-status');
  return res.data;
};
