import { md5 } from './hashCode.js';

const hasCode = (s) => typeof s?.code === 'string' && s.code.trim().length > 0;

/**
 * Freshness of a problem's stored AI analysis.
 *
 * The analysis is compared against the code of the latest Accepted submission
 * that has code. When no Accepted submission has code, the latest submission
 * with code (any verdict) is used instead, which is what POST /api/analyze picks.
 *
 * Works on both Mongoose documents and lean objects.
 */
export function computeAiAnalysisMeta(problem) {
  const withCode = (problem.submissions || [])
    .filter(hasCode)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  const latestAccepted = withCode.find((s) => s.verdict === 'Accepted');
  const latestAcceptedHash = latestAccepted ? md5(latestAccepted.code) : null;
  const latestCodeHash = withCode.length ? md5(withCode[0].code) : null;

  const analysis = problem.aiAnalysis || null;
  const analyzedHash = analysis?.codeSnapshotHash ?? null;
  const currentHash = latestAcceptedHash ?? latestCodeHash;

  return {
    status: problem.aiAnalysisStatus || (analysis ? 'ready' : 'idle'),
    error: problem.aiAnalysisError ?? null,
    generatedAt: analysis?.generatedAt ?? null,
    analyzedHash,
    latestAcceptedHash,
    latestCodeHash,
    // An analysis is stale when the code it was generated from is no longer the
    // current code. No analysis, or no code to compare against, is never stale.
    isStale: Boolean(analysis) && currentHash !== null && analyzedHash !== currentHash,
    pendingSince: problem.aiAnalysisPendingSince ?? null,
  };
}
