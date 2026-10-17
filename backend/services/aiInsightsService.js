/**
 * aiInsightsService.js
 * Data behind the "AI insights" tab: the text of every stored AI analysis
 * (no code), review coverage, and how long problems take to get accepted.
 * Grouping the free-text feedback into themes happens in the frontend.
 * See docs/analytics-api.md.
 */

import Problem from '../models/Problem.js';
import { computeAiAnalysisMeta } from '../utils/aiMeta.js';
import { solvedExpr } from '../utils/problemStatus.js';

// Gaps longer than this between first attempt and first accept are treated as
// separate sessions (came back days later), not solving time.
const MAX_GAP_MINUTES = 60 * 24 * 3;

const hasCodeExpr = (input) => ({
  $anyElementTrue: [{
    $map: {
      input,
      as: 's',
      in: { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$$s.code', ''] } } } }, 0] },
    },
  }],
});

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export async function buildAiInsights({ userId, platform = 'all' }) {
  const match = { user: userId };
  if (platform !== 'all') match.platform = platform;

  const [rows, analyzedDocs] = await Promise.all([
    Problem.aggregate([
      { $match: match },
      {
        $project: {
          subs: { $ifNull: ['$submissions', []] },
          platform: 1,
          status: 1,
        },
      },
      {
        $project: {
          hasCode: hasCodeExpr('$subs'),
          solved: solvedExpr({
            subCount: { $size: '$subs' },
            acCount: { $size: { $filter: { input: '$subs', as: 's', cond: { $eq: ['$$s.verdict', 'Accepted'] } } } },
          }),
          // Only what time-to-accepted needs — never the code
          times: { $map: { input: '$subs', as: 's', in: { t: '$$s.submittedAt', v: '$$s.verdict' } } },
        },
      },
    ]),
    // Analysed problems: staleness needs the code hashes, computed in JS
    Problem.find(
      { ...match, 'aiAnalysis.complexityAnalysis': { $exists: true } },
      { title: 1, url: 1, difficulty: 1, tags: 1, platform: 1, submissions: 1, aiAnalysis: 1, aiAnalysisStatus: 1 }
    ).lean(),
  ]);

  const analyzedIds = new Set(analyzedDocs.map((p) => String(p._id)));
  let solved = 0, withCode = 0, readyToReview = 0;
  const gaps = [];

  for (const r of rows) {
    if (r.solved) solved += 1;
    if (r.hasCode) withCode += 1;
    if (r.solved && r.hasCode && !analyzedIds.has(String(r._id))) readyToReview += 1;

    // Minutes from first submission to first Accepted, when it took >1 try
    const times = (r.times || []).filter((x) => x.t).sort((a, b) => new Date(a.t) - new Date(b.t));
    const firstAc = times.find((x) => x.v === 'Accepted');
    if (times.length >= 2 && firstAc && firstAc !== times[0]) {
      const minutes = (new Date(firstAc.t) - new Date(times[0].t)) / 60000;
      if (minutes > 0 && minutes < MAX_GAP_MINUTES) gaps.push(minutes);
    }
  }

  const analyzed = analyzedDocs
    .map((p) => {
      const a = p.aiAnalysis || {};
      const meta = computeAiAnalysisMeta(p);
      return {
        _id: p._id,
        title: p.title,
        url: p.url ?? null,
        platform: p.platform,
        difficulty: p.difficulty ?? null,
        tags: p.tags ?? [],
        generatedAt: a.generatedAt ?? null,
        isStale: meta.isStale,
        complexity: {
          current: a.complexityAnalysis?.current ?? '',
          optimal: a.complexityAnalysis?.optimal ?? '',
        },
        // Older analyses stored plain strings; newer ones { description, snippet }
        feedback: (a.optimizationAreas ?? [])
          .map((x) => (typeof x === 'string' ? x : x?.description ?? ''))
          .map((s) => s.trim())
          .filter(Boolean),
        edgeCases: (a.edgeCasesToConsider ?? []).map((s) => String(s).trim()).filter(Boolean),
      };
    })
    .sort((x, y) => new Date(y.generatedAt ?? 0) - new Date(x.generatedAt ?? 0));

  return {
    platform,
    counts: {
      solved,
      withCode,
      analyzed: analyzed.length,
      stale: analyzed.filter((p) => p.isStale).length,
      readyToReview,
    },
    timeToAccepted: {
      sampleSize: gaps.length,
      avgMinutes: gaps.length ? Math.round(gaps.reduce((s, x) => s + x, 0) / gaps.length) : null,
      medianMinutes: gaps.length ? Math.round(median(gaps)) : null,
    },
    analyzed,
  };
}
