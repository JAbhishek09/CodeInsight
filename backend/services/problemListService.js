/**
 * problemListService.js
 * Lightweight, paginated problem list for GET /api/problems?view=list.
 * Never returns submission code or AI analysis bodies.
 */

import Problem from '../models/Problem.js';
import { computeAiAnalysisMeta } from '../utils/aiMeta.js';
import { attemptedExpr, solvedExpr } from '../utils/problemStatus.js';

export const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

// Public sort key → field in the projected document
const SORT_FIELDS = {
  updatedAt: 'updatedAt',
  createdAt: 'createdAt',
  title: 'title',
  difficulty: 'difficultyRank',
  lastSubmittedAt: 'lastSubmittedAt',
  firstSolvedAt: 'firstSolvedAt',
  submissionCount: 'submissionCount',
};

const DIFFICULTY_RANK = { Easy: 1, Medium: 2, Hard: 3, Div3: 4, Div2: 5, Div1: 6, unrated: 7 };

const asList = (v) => (Array.isArray(v) ? v : String(v).split(','))
  .map((s) => String(s).trim())
  .filter(Boolean);

const toPositiveInt = (v, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Turns raw query params into a validated options object.
 * Throws an Error with .statusCode = 400 on bad input.
 */
export function parseListQuery(q = {}) {
  const page = toPositiveInt(q.page, 1);
  const limit = Math.min(toPositiveInt(q.limit, DEFAULT_LIMIT), MAX_LIMIT);

  const rawSort = typeof q.sort === 'string' && q.sort ? q.sort : '-updatedAt';
  const desc = rawSort.startsWith('-');
  const sortKey = desc ? rawSort.slice(1) : rawSort;
  if (!SORT_FIELDS[sortKey]) {
    const err = new Error(`Invalid sort. Use one of: ${Object.keys(SORT_FIELDS).join(', ')} (prefix "-" for descending)`);
    err.statusCode = 400;
    throw err;
  }

  return {
    page,
    limit,
    sort: { field: SORT_FIELDS[sortKey], dir: desc ? -1 : 1, key: rawSort },
    search: q.search ? String(q.search).trim() : '',
    difficulty: q.difficulty ? asList(q.difficulty) : [],
    status: q.status ? asList(q.status) : [],
    platform: q.platform && q.platform !== 'all' ? asList(q.platform) : [],
    tag: q.tag ? asList(q.tag) : [],
  };
}

export async function listProblems(userId, opts) {
  const match = { user: userId };
  if (opts.difficulty.length) match.difficulty = { $in: opts.difficulty };
  if (opts.platform.length) match.platform = { $in: opts.platform };
  if (opts.search) match.title = { $regex: escapeRegex(opts.search), $options: 'i' };
  // Tags match case-insensitively but whole-tag; several tags = any of them
  if (opts.tag.length) match.tags = { $in: opts.tag.map((t) => new RegExp(`^${escapeRegex(t)}$`, 'i')) };

  const subs = { $ifNull: ['$submissions', []] };
  const acs = { $filter: { input: subs, as: 's', cond: { $eq: ['$$s.verdict', 'Accepted'] } } };
  const subCount = { $size: subs };
  const solved = solvedExpr({ subCount, acCount: { $size: acs } });

  const pipeline = [
    { $match: match },
    {
      $project: {
        title: 1, url: 1, platform: 1, platformProblemId: 1, difficulty: 1, tags: 1,
        category: 1, createdAt: 1, updatedAt: 1,
        storedStatus: '$status',
        solved,
        attempted: attemptedExpr({ solved, subCount }),
        submissionCount: subCount,
        acceptedCount: { $size: acs },
        hasCode: {
          $anyElementTrue: [{
            $map: {
              input: subs,
              as: 's',
              in: { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$$s.code', ''] } } } }, 0] },
            },
          }],
        },
        latest: { $first: { $sortArray: { input: subs, sortBy: { submittedAt: -1 } } } },
        firstSolvedAt: { $min: { $map: { input: acs, as: 's', in: '$$s.submittedAt' } } },
        hasAiAnalysis: { $ne: [{ $ifNull: ['$aiAnalysis', null] }, null] },
        aiStatus: { $ifNull: ['$aiAnalysisStatus', 'idle'] },
        aiGeneratedAt: { $ifNull: ['$aiAnalysis.generatedAt', null] },
        difficultyRank: {
          $switch: {
            branches: Object.entries(DIFFICULTY_RANK).map(([d, r]) => ({ case: { $eq: ['$difficulty', d] }, then: r })),
            default: 99,
          },
        },
      },
    },
    {
      $addFields: {
        latestVerdict: { $ifNull: ['$latest.verdict', null] },
        latestLanguage: { $ifNull: ['$latest.language', null] },
        lastSubmittedAt: { $ifNull: ['$latest.submittedAt', null] },
        // Derived from submissions; see utils/problemStatus.js for why
        // the stored status is not used directly.
        status: {
          $cond: [
            '$solved',
            'Solved',
            { $cond: ['$attempted', 'Attempted', 'To Do'] },
          ],
        },
      },
    },
    { $project: { latest: 0, solved: 0, attempted: 0 } },
    ...(opts.status.length ? [{ $match: { status: { $in: opts.status } } }] : []),
    { $sort: { [opts.sort.field]: opts.sort.dir, _id: 1 } },
    {
      $facet: {
        data: [{ $skip: (opts.page - 1) * opts.limit }, { $limit: opts.limit }, { $project: { difficultyRank: 0 } }],
        total: [{ $count: 'n' }],
      },
    },
  ];

  const [result] = await Problem.aggregate(pipeline);
  const data = result.data;

  // Staleness needs md5 of code, so it is computed only for analysed rows on this page.
  const analysedIds = data.filter((p) => p.hasAiAnalysis).map((p) => p._id);
  const staleById = new Map();
  if (analysedIds.length) {
    const docs = await Problem.find(
      { _id: { $in: analysedIds }, user: userId },
      { submissions: 1, aiAnalysis: 1, aiAnalysisStatus: 1 }
    ).lean();
    for (const d of docs) staleById.set(String(d._id), computeAiAnalysisMeta(d).isStale);
  }
  for (const p of data) p.aiIsStale = staleById.get(String(p._id)) ?? false;

  return {
    data,
    page: opts.page,
    limit: opts.limit,
    total: result.total[0]?.n ?? 0,
  };
}
