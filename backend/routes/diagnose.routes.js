/**
 * diagnose.routes.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Temporary diagnostic endpoint.
 * GET /api/diagnose/code-gap  — returns detailed statistics about the current
 * state of submission code coverage in MongoDB.
 *
 * DELETE THIS FILE before deploying to production.
 */

import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import Problem from '../models/Problem.js';

const router = express.Router();

router.get('/code-gap', protect, async (req, res) => {
  const userId = req.user._id;

  const [
    totalProblems,
    totalNoSubs,
    withCodeProbs,
    allEmptyCode,
    acEmptyCode,
    acHasCode,
  ] = await Promise.all([
    Problem.countDocuments({ user: userId, platform: 'leetcode' }),
    Problem.countDocuments({ user: userId, platform: 'leetcode', 'submissions.0': { $exists: false } }),
    Problem.countDocuments({ user: userId, platform: 'leetcode', submissions: { $elemMatch: { code: { $gt: '' } } } }),
    Problem.countDocuments({ user: userId, platform: 'leetcode', 'submissions.0': { $exists: true }, submissions: { $not: { $elemMatch: { code: { $gt: '' } } } } }),
    Problem.countDocuments({ user: userId, platform: 'leetcode', submissions: { $elemMatch: { verdict: 'Accepted', $or: [{ code: '' }, { code: null }] } } }),
    Problem.countDocuments({ user: userId, platform: 'leetcode', submissions: { $elemMatch: { verdict: 'Accepted', code: { $gt: '' } } } }),
  ]);

  // Entry-level stats
  const codeAgg = await Problem.aggregate([
    { $match: { user: userId, platform: 'leetcode' } },
    { $unwind: { path: '$submissions', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: null,
        totalEntries:  { $sum: { $cond: [{ $ifNull: ['$submissions', false] }, 1, 0] } },
        withCode:      { $sum: { $cond: [{ $and: [{ $ifNull: ['$submissions', false] }, { $gt: ['$submissions.code', ''] }] }, 1, 0] } },
        withoutCode:   { $sum: { $cond: [{ $and: [{ $ifNull: ['$submissions', false] }, { $not: { $gt: ['$submissions.code', ''] } }] }, 1, 0] } },
        acWithCode:    { $sum: { $cond: [{ $and: [{ $ifNull: ['$submissions', false] }, { $eq: ['$submissions.verdict', 'Accepted'] }, { $gt: ['$submissions.code', ''] }] }, 1, 0] } },
        acWithoutCode: { $sum: { $cond: [{ $and: [{ $ifNull: ['$submissions', false] }, { $eq: ['$submissions.verdict', 'Accepted'] }, { $not: { $gt: ['$submissions.code', ''] } }] }, 1, 0] } },
      },
    },
  ]);
  const cs = codeAgg[0] ?? {};

  // Samples: AC subs with no code
  const acEmptySamples = await Problem.find(
    { user: userId, platform: 'leetcode', submissions: { $elemMatch: { verdict: 'Accepted', $or: [{ code: '' }, { code: null }] } } },
    { title: 1, platformProblemId: 1, submissions: { $slice: 6 } }
  ).limit(8).lean();

  // Samples: no submissions at all
  const noSubSamples = await Problem.find(
    { user: userId, platform: 'leetcode', 'submissions.0': { $exists: false } },
    { title: 1, platformProblemId: 1 }
  ).limit(8).lean();

  // Samples: has code (sanity check)
  const withCodeSamples = await Problem.find(
    { user: userId, platform: 'leetcode', submissions: { $elemMatch: { code: { $gt: '' } } } },
    { title: 1, platformProblemId: 1, submissions: { $slice: 3 } }
  ).limit(3).lean();

  // submissionId type sample
  const idSample = await Problem.find(
    { user: userId, platform: 'leetcode', 'submissions.0': { $exists: true } },
    { 'submissions': { $slice: 3 } }
  ).limit(5).lean();

  // Distribution
  const dist = await Problem.aggregate([
    { $match: { user: userId, platform: 'leetcode' } },
    { $project: { subCount: { $size: '$submissions' } } },
    { $group: { _id: '$subCount', count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  res.json({
    problemLevel: {
      total: totalProblems,
      zeroSubmissions: totalNoSubs,
      withAtLeastOneCodedSub: withCodeProbs,
      allSubsEmptyCode: allEmptyCode,
      acExistsEmptyCode: acEmptyCode,
      acExistsHasCode: acHasCode,
    },
    entryLevel: {
      totalEntries:  cs.totalEntries,
      withCode:      cs.withCode,
      withoutCode:   cs.withoutCode,
      acWithCode:    cs.acWithCode,
      acWithoutCode: cs.acWithoutCode,
    },
    samples: {
      acEmptyCode: acEmptySamples.map(p => ({
        title: p.title,
        slug: p.platformProblemId,
        acSubs: p.submissions
          .filter(s => s.verdict === 'Accepted')
          .map(s => ({ id: s.submissionId, lang: s.language, codeLen: (s.code || '').length, idType: typeof s.submissionId })),
      })),
      noSubmissions: noSubSamples.map(p => ({ title: p.title, slug: p.platformProblemId })),
      withCode: withCodeSamples.map(p => ({
        title: p.title,
        slug: p.platformProblemId,
        codedSubs: p.submissions
          .filter(s => s.code && s.code.length > 0)
          .map(s => ({ id: s.submissionId, lang: s.language, codeLen: s.code.length, snippet: s.code.slice(0, 80) })),
      })),
    },
    submissionIdTypes: [...new Set(idSample.flatMap(p => p.submissions.map(s => typeof s.submissionId)))],
    submissionIdSamples: idSample.slice(0, 3).flatMap(p =>
      p.submissions.slice(0, 2).map(s => ({ id: s.submissionId, type: typeof s.submissionId, verdict: s.verdict }))
    ),
    distributionBySubCount: dist.slice(0, 20),
  });
});

export default router;
