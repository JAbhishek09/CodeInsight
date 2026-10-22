/**
 * analyticsService.js
 * Builds the GET /api/analytics/summary payload with one aggregation pass.
 * Response shapes are documented in docs/analytics-api.md.
 */

import Problem from '../models/Problem.js';
import { computeAiAnalysisMeta } from '../utils/aiMeta.js';
import { attemptedExpr, solvedExpr } from '../utils/problemStatus.js';

export const PLATFORMS = ['all', 'leetcode', 'codeforces'];
export const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Div1', 'Div2', 'Div3', 'unrated', 'unknown'];
export const VERDICTS = ['Accepted', 'Wrong Answer', 'TLE', 'MLE', 'RE', 'CE', 'Pending'];

const DAYS = 365;
const MONTHS = 12;

// ─── Date helpers (calendar days as 'YYYY-MM-DD' strings in a given zone) ────

export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function dayInZone(date, tz) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export function addDays(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * Current and longest run of consecutive days in `days` (sorted, unique).
 * The current streak stays alive through today if yesterday was active, so it
 * does not drop to 0 before the user has had a chance to practise today.
 */
export function computeStreak(days, today) {
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const day of days) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = day;
  }

  const active = new Set(days);
  let cursor = active.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (active.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    current,
    longest,
    activeToday: active.has(today),
    lastActiveDay: days.length ? days[days.length - 1] : null,
  };
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

/**
 * Per-problem derived fields shared by every facet. Submission code and
 * analysis bodies are dropped here so later stages never carry them.
 */
function problemStages(match, tz) {
  const toDay = (expr) => ({ $dateToString: { format: '%Y-%m-%d', date: expr, timezone: tz } });

  return [
    { $match: match },
    {
      $project: {
        platform: 1,
        status: 1,
        createdAt: 1,
        difficulty: {
          $cond: [{ $in: [{ $ifNull: ['$difficulty', null] }, DIFFICULTIES] }, '$difficulty', 'unknown'],
        },
        tags: { $setUnion: [{ $ifNull: ['$tags', []] }, []] },
        subs: {
          $map: {
            input: { $ifNull: ['$submissions', []] },
            as: 's',
            in: { submittedAt: '$$s.submittedAt', verdict: '$$s.verdict', language: '$$s.language' },
          },
        },
        hasAnalysis: { $ne: [{ $ifNull: ['$aiAnalysis', null] }, null] },
      },
    },
    { $addFields: { acs: { $filter: { input: '$subs', as: 's', cond: { $eq: ['$$s.verdict', 'Accepted'] } } } } },
    {
      $addFields: {
        firstAC: { $min: '$acs.submittedAt' },
        latestAC: { $first: { $sortArray: { input: '$acs', sortBy: { submittedAt: -1 } } } },
        solved: solvedExpr({ subCount: { $size: '$subs' }, acCount: { $size: '$acs' } }),
      },
    },
    {
      $addFields: {
        attempted: attemptedExpr({ solved: '$solved', subCount: { $size: '$subs' } }),
        // Date a problem first became solved: its first Accepted submission.
        // Manual entries have no submissions, so their creation date stands in.
        // Imported problems marked Solved without any submission stay undated
        // (using the import date would put them all on one day).
        solvedAt: {
          $cond: [
            { $ne: ['$firstAC', null] },
            '$firstAC',
            { $cond: [{ $and: ['$solved', { $eq: ['$platform', 'manual'] }] }, '$createdAt', null] },
          ],
        },
      },
    },
    { $addFields: { solvedDay: { $cond: [{ $ne: ['$solvedAt', null] }, toDay('$solvedAt'), null] } } },
  ];
}

const countIf = (cond) => ({ $sum: { $cond: [cond, 1, 0] } });

/**
 * Streak days: any day with an Accepted submission (re-solves included),
 * plus the solve day of undated-by-submission manual entries. Shared by the
 * analytics summary and Home, so the two always show the same streak.
 */
function activeDaysFacet(tz) {
  const toDay = (expr) => ({ $dateToString: { format: '%Y-%m-%d', date: expr, timezone: tz } });
  return [
    {
      $project: {
        days: {
          $concatArrays: [
            { $map: { input: '$acs', as: 's', in: toDay('$$s.submittedAt') } },
            { $cond: [{ $ne: ['$solvedDay', null] }, ['$solvedDay'], []] },
          ],
        },
      },
    },
    { $unwind: '$days' },
    { $group: { _id: '$days' } },
    { $sort: { _id: 1 } },
  ];
}

/** Today's goal: problems first solved today against the daily target. */
function dailyGoal(today, solvedToday, targetDailySolved) {
  const target = Number.isFinite(targetDailySolved) && targetDailySolved > 0 ? targetDailySolved : 1;
  return {
    date: today,
    solved: solvedToday,
    target,
    remaining: Math.max(0, target - solvedToday),
    goalMet: solvedToday >= target,
  };
}

function facets({ tz, today, fromDay, fromMonth }) {
  const toDay = (expr) => ({ $dateToString: { format: '%Y-%m-%d', date: expr, timezone: tz } });

  return {
    totals: [
      {
        $group: {
          _id: null,
          problems: { $sum: 1 },
          solved: countIf('$solved'),
          attempted: countIf('$attempted'),
          solvedUndated: countIf({ $and: ['$solved', { $eq: ['$solvedAt', null] }] }),
          aiAnalyzed: countIf('$hasAnalysis'),
          submissions: { $sum: { $size: '$subs' } },
          acceptedSubmissions: { $sum: { $size: '$acs' } },
        },
      },
    ],
    byDifficulty: [
      { $group: { _id: '$difficulty', total: { $sum: 1 }, solved: countIf('$solved') } },
    ],
    byPlatform: [
      { $group: { _id: '$platform', total: { $sum: 1 }, solved: countIf('$solved') } },
    ],
    solvedByDay: [
      { $match: { solvedDay: { $gte: fromDay, $lte: today } } },
      { $group: { _id: '$solvedDay', count: { $sum: 1 } } },
    ],
    solvedByMonth: [
      { $match: { solvedDay: { $gte: `${fromMonth}-01`, $lte: today } } },
      { $group: { _id: { month: { $substrBytes: ['$solvedDay', 0, 7] }, difficulty: '$difficulty' }, count: { $sum: 1 } } },
    ],
    submissionsByDay: [
      { $unwind: '$subs' },
      { $addFields: { day: toDay('$subs.submittedAt') } },
      { $match: { day: { $gte: fromDay, $lte: today } } },
      {
        $group: {
          _id: '$day',
          count: { $sum: 1 },
          accepted: countIf({ $eq: ['$subs.verdict', 'Accepted'] }),
        },
      },
    ],
    activeDays: activeDaysFacet(tz),
    topics: [
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          total: { $sum: 1 },
          solved: countIf('$solved'),
          attempted: countIf('$attempted'),
        },
      },
      { $sort: { total: -1, _id: 1 } },
    ],
    languages: [
      { $match: { 'latestAC.language': { $type: 'string' } } },
      { $group: { _id: '$latestAC.language', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
    ],
    verdicts: [
      { $unwind: '$subs' },
      { $group: { _id: '$subs.verdict', count: { $sum: 1 } } },
    ],
  };
}

/**
 * @param {object} opts
 * @param {ObjectId} opts.userId
 * @param {'all'|'leetcode'|'codeforces'} [opts.platform]
 * @param {string} [opts.tz]               IANA zone, already validated
 * @param {number} [opts.targetDailySolved]
 * @param {Date}   [opts.now]              injectable clock for tests
 */
export async function buildAnalyticsSummary({
  userId, platform = 'all', tz = 'UTC', targetDailySolved = 1, now = new Date(),
}) {
  const today = dayInZone(now, tz);
  const fromDay = addDays(today, -(DAYS - 1));
  const thisMonth = today.slice(0, 7);
  const fromMonth = addMonths(thisMonth, -(MONTHS - 1));

  const match = { user: userId };
  if (platform !== 'all') match.platform = platform;

  const [[agg], analyzed] = await Promise.all([
    Problem.aggregate([
      ...problemStages(match, tz),
      { $facet: facets({ tz, today, fromDay, fromMonth }) },
    ]),
    // md5 is not available inside aggregation, so staleness is checked here
    // for the (usually few) problems that have an analysis.
    Problem.find(
      { ...match, aiAnalysis: { $ne: null } },
      { submissions: 1, aiAnalysis: 1, aiAnalysisStatus: 1 }
    ).lean(),
  ]);

  const t = agg.totals[0] || {
    problems: 0, solved: 0, attempted: 0, solvedUndated: 0, aiAnalyzed: 0, submissions: 0, acceptedSubmissions: 0,
  };

  const byDifficulty = Object.fromEntries(DIFFICULTIES.map((d) => [d, { total: 0, solved: 0 }]));
  for (const row of agg.byDifficulty) byDifficulty[row._id] = { total: row.total, solved: row.solved };

  const byPlatform = Object.fromEntries(['leetcode', 'codeforces', 'manual'].map((p) => [p, { total: 0, solved: 0 }]));
  for (const row of agg.byPlatform) byPlatform[row._id] = { total: row.total, solved: row.solved };

  const solvedMap = new Map(agg.solvedByDay.map((r) => [r._id, r.count]));
  const subsMap = new Map(agg.submissionsByDay.map((r) => [r._id, r]));
  const solvedByDay = [];
  const submissionsByDay = [];
  for (let i = 0; i < DAYS; i += 1) {
    const date = addDays(fromDay, i);
    solvedByDay.push({ date, count: solvedMap.get(date) || 0 });
    const s = subsMap.get(date);
    submissionsByDay.push({ date, count: s?.count || 0, accepted: s?.accepted || 0 });
  }

  const solvedByMonth = [];
  for (let i = 0; i < MONTHS; i += 1) {
    const month = addMonths(fromMonth, i);
    const byDiff = Object.fromEntries(DIFFICULTIES.map((d) => [d, 0]));
    let total = 0;
    for (const r of agg.solvedByMonth) {
      if (r._id.month !== month) continue;
      byDiff[r._id.difficulty] += r.count;
      total += r.count;
    }
    solvedByMonth.push({ month, total, byDifficulty: byDiff });
  }

  const verdicts = Object.fromEntries(VERDICTS.map((v) => [v, 0]));
  for (const r of agg.verdicts) {
    if (r._id in verdicts) verdicts[r._id] = r.count;
    else verdicts.other = (verdicts.other || 0) + r.count;
  }

  const solvedToday = solvedMap.get(today) || 0;

  return {
    platform,
    timezone: tz,
    generatedAt: now.toISOString(),
    range: { from: fromDay, to: today },
    totals: {
      problems: t.problems,
      solved: t.solved,
      attempted: t.attempted,
      solvedUndated: t.solvedUndated,
      submissions: t.submissions,
      acceptedSubmissions: t.acceptedSubmissions,
      acceptanceRate: t.submissions ? Number((t.acceptedSubmissions / t.submissions).toFixed(4)) : null,
      aiAnalyzed: t.aiAnalyzed,
      aiStale: analyzed.filter((p) => computeAiAnalysisMeta(p).isStale).length,
    },
    byDifficulty,
    byPlatform,
    solvedByDay,
    solvedByMonth,
    submissionsByDay,
    streak: computeStreak(agg.activeDays.map((r) => r._id), today),
    today: dailyGoal(today, solvedToday, targetDailySolved),
    topics: agg.topics.map((r) => ({ tag: r._id, total: r.total, solved: r.solved, attempted: r.attempted })),
    languages: agg.languages.map((r) => ({ language: r._id, count: r.count })),
    verdicts,
  };
}

/**
 * Just today's goal and the streak (same rules as the summary), for Home.
 * Much lighter than buildAnalyticsSummary.
 */
export async function goalAndStreak({ userId, tz = 'UTC', targetDailySolved = 1, now = new Date() }) {
  const today = dayInZone(now, tz);
  const [agg] = await Problem.aggregate([
    ...problemStages({ user: userId }, tz),
    {
      $facet: {
        solvedToday: [{ $match: { solvedDay: today } }, { $count: 'n' }],
        activeDays: activeDaysFacet(tz),
      },
    },
  ]);
  return {
    today: dailyGoal(today, agg.solvedToday[0]?.n ?? 0, targetDailySolved),
    streak: computeStreak(agg.activeDays.map((r) => r._id), today),
  };
}
