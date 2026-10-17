import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startDb, stopDb, clearDb, ac, sub } from './helpers.js';
import Problem from '../models/Problem.js';
import '../models/User.js'; // used by Problem's post-save hook
import { buildAnalyticsSummary, computeStreak } from '../services/analyticsService.js';
import { md5 } from '../utils/hashCode.js';

const NOW = new Date('2026-10-17T12:00:00Z');
const userId = new mongoose.Types.ObjectId();

const summary = (opts = {}) => buildAnalyticsSummary({ userId, now: NOW, ...opts });
const dayCount = (s, date) => s.solvedByDay.find((d) => d.date === date)?.count;
const sumCounts = (rows) => rows.reduce((n, r) => n + r.count, 0);

const problem = (fields) => Problem.create({ user: userId, platform: 'leetcode', title: 'P', ...fields });

before(startDb);
after(stopDb);
beforeEach(clearDb);

describe('GET /api/analytics/summary data', () => {
  test('a problem with several Accepted submissions is counted once, on its first AC day', async () => {
    await problem({
      title: 'Two Sum',
      difficulty: 'Easy',
      status: 'Solved',
      submissions: [
        ac('2026-10-10T10:00:00Z'),
        sub('2026-10-09T10:00:00Z', 'Wrong Answer'),
        ac('2026-10-12T10:00:00Z'),
        ac('2026-10-15T10:00:00Z'),
      ],
    });

    const s = await summary();
    assert.equal(s.totals.solved, 1);
    assert.equal(sumCounts(s.solvedByDay), 1);
    assert.equal(dayCount(s, '2026-10-10'), 1);
    assert.equal(dayCount(s, '2026-10-12'), 0);
    assert.equal(s.solvedByMonth.at(-1).month, '2026-10');
    assert.equal(s.solvedByMonth.at(-1).total, 1);
    assert.equal(s.solvedByMonth.at(-1).byDifficulty.Easy, 1);
    // ...but every submission still shows up in activity
    assert.equal(sumCounts(s.submissionsByDay), 4);
    assert.equal(s.totals.submissions, 4);
    assert.equal(s.totals.acceptedSubmissions, 3);
    assert.equal(s.totals.acceptanceRate, 0.75);
  });

  test('first-AC date is bucketed in the requested time zone', async () => {
    // 20:00 UTC on the 16th is 01:30 on the 17th in Kolkata (UTC+5:30)
    await problem({ title: 'A', difficulty: 'Easy', submissions: [ac('2026-10-16T20:00:00Z')] });
    // 03:00 UTC on the 17th is 20:00 on the 16th in Los Angeles (UTC-7)
    await problem({ title: 'B', difficulty: 'Easy', submissions: [ac('2026-10-17T03:00:00Z')] });

    const utc = await summary({ tz: 'UTC' });
    assert.equal(dayCount(utc, '2026-10-16'), 1);
    assert.equal(dayCount(utc, '2026-10-17'), 1);
    assert.equal(utc.today.solved, 1);

    const ist = await summary({ tz: 'Asia/Kolkata' });
    assert.equal(ist.range.to, '2026-10-17');
    assert.equal(dayCount(ist, '2026-10-16'), 0);
    assert.equal(dayCount(ist, '2026-10-17'), 2);
    assert.equal(ist.today.solved, 2);

    const la = await summary({ tz: 'America/Los_Angeles' });
    // 12:00 UTC on the 17th is 05:00 on the 17th in LA
    assert.equal(la.range.to, '2026-10-17');
    assert.equal(dayCount(la, '2026-10-16'), 2);
    assert.equal(la.today.solved, 0);
  });

  test('day series cover the last 365 days, densely', async () => {
    const s = await summary();
    assert.equal(s.solvedByDay.length, 365);
    assert.equal(s.submissionsByDay.length, 365);
    assert.equal(s.solvedByDay[0].date, '2025-10-18');
    assert.equal(s.solvedByDay.at(-1).date, '2026-10-17');
    assert.equal(s.solvedByMonth.length, 12);
    assert.equal(s.solvedByMonth[0].month, '2025-11');
  });

  test('Codeforces divisions are reported, missing difficulty is "unknown", platform filter applies', async () => {
    await problem({ platform: 'codeforces', title: 'CF1', difficulty: 'Div1', submissions: [ac('2026-10-01T00:00:00Z')] });
    // Like a synced problem: stored status is the schema default 'Solved', but nothing was accepted
    await problem({ platform: 'codeforces', title: 'CF2', difficulty: 'Div2', submissions: [sub('2026-10-01T00:00:00Z', 'TLE')] });
    await problem({ platform: 'codeforces', title: 'CF2b', difficulty: 'Div2', submissions: [ac('2026-10-02T00:00:00Z')] });
    await problem({ platform: 'codeforces', title: 'CF3', difficulty: 'Div3', submissions: [ac('2026-10-03T00:00:00Z')] });
    await problem({ platform: 'codeforces', title: 'CFu', difficulty: 'unrated', submissions: [ac('2026-10-04T00:00:00Z')] });
    await problem({ title: 'LC', difficulty: 'Hard', submissions: [ac('2026-10-05T00:00:00Z')] });
    // Bypass the schema default to store a problem with no difficulty at all
    await Problem.collection.insertOne({
      user: userId, platform: 'leetcode', title: 'NoDiff', tags: [],
      submissions: [ac('2026-10-06T00:00:00Z')],
    });

    const all = await summary();
    assert.deepEqual(all.byDifficulty.Div1, { total: 1, solved: 1 });
    assert.deepEqual(all.byDifficulty.Div2, { total: 2, solved: 1 });
    assert.deepEqual(all.byDifficulty.Div3, { total: 1, solved: 1 });
    assert.deepEqual(all.byDifficulty.unrated, { total: 1, solved: 1 });
    assert.deepEqual(all.byDifficulty.Hard, { total: 1, solved: 1 });
    assert.deepEqual(all.byDifficulty.unknown, { total: 1, solved: 1 });
    assert.deepEqual(all.byDifficulty.Medium, { total: 0, solved: 0 });
    assert.equal(all.solvedByMonth.at(-1).byDifficulty.Div2, 1);

    const cf = await summary({ platform: 'codeforces' });
    assert.equal(cf.totals.problems, 5);
    assert.equal(cf.totals.attempted, 1);
    assert.equal(cf.byDifficulty.Hard.total, 0);
    assert.equal(cf.verdicts.TLE, 1);
  });

  test('today / daily goal counts problems first solved today, not re-solves or all-time totals', async () => {
    await problem({ title: 'new1', difficulty: 'Easy', submissions: [ac('2026-10-17T08:00:00Z')] });
    await problem({ title: 'new2', difficulty: 'Easy', submissions: [ac('2026-10-17T09:00:00Z'), ac('2026-10-17T10:00:00Z')] });
    await problem({ title: 'resolve', difficulty: 'Easy', submissions: [ac('2026-10-01T08:00:00Z'), ac('2026-10-17T08:00:00Z')] });
    await problem({ title: 'old', difficulty: 'Easy', submissions: [ac('2026-09-01T08:00:00Z')] });

    const s = await summary({ targetDailySolved: 3 });
    assert.deepEqual(s.today, { date: '2026-10-17', solved: 2, target: 3, remaining: 1, goalMet: false });

    const met = await summary({ targetDailySolved: 2 });
    assert.equal(met.today.goalMet, true);
    assert.equal(met.today.remaining, 0);
  });

  test('streak counts consecutive days with an Accepted submission', async () => {
    // Active: 17, 16, 15 (current = 3); 12..8 (longest = 5). The 16th is a re-solve only.
    await problem({ title: 'a', submissions: [ac('2026-10-17T05:00:00Z')] });
    await problem({ title: 'b', submissions: [ac('2026-10-15T05:00:00Z'), ac('2026-10-16T05:00:00Z')] });
    for (const d of [8, 9, 10, 11, 12]) {
      await problem({ title: `c${d}`, submissions: [ac(`2026-10-${String(d).padStart(2, '0')}T05:00:00Z`)] });
    }
    // Non-accepted activity does not extend a streak
    await problem({ title: 'wa', submissions: [sub('2026-10-14T05:00:00Z', 'Wrong Answer')] });

    const s = await summary();
    assert.equal(s.streak.current, 3);
    assert.equal(s.streak.longest, 5);
    assert.equal(s.streak.activeToday, true);
    assert.equal(s.streak.lastActiveDay, '2026-10-17');
  });

  test('computeStreak keeps the current streak alive until today ends', () => {
    assert.deepEqual(computeStreak(['2026-10-15', '2026-10-16'], '2026-10-17'),
      { current: 2, longest: 2, activeToday: false, lastActiveDay: '2026-10-16' });
    assert.equal(computeStreak(['2026-10-14', '2026-10-15'], '2026-10-17').current, 0);
    assert.equal(computeStreak([], '2026-10-17').current, 0);
    // Month and year boundaries
    assert.equal(computeStreak(['2025-12-31', '2026-01-01', '2026-01-02'], '2026-01-02').longest, 3);
  });

  test('verdict counts include every enum value', async () => {
    await problem({
      title: 'v',
      submissions: [
        sub('2026-10-01T00:00:00Z', 'Wrong Answer'),
        sub('2026-10-01T00:01:00Z', 'TLE'),
        sub('2026-10-01T00:02:00Z', 'TLE'),
        sub('2026-10-01T00:03:00Z', 'MLE'),
        sub('2026-10-01T00:04:00Z', 'RE'),
        sub('2026-10-01T00:05:00Z', 'CE'),
        sub('2026-10-01T00:06:00Z', 'Pending'),
        ac('2026-10-01T00:07:00Z'),
      ],
    });

    const s = await summary();
    assert.deepEqual(s.verdicts, {
      Accepted: 1, 'Wrong Answer': 1, TLE: 2, MLE: 1, RE: 1, CE: 1, Pending: 1,
    });
  });

  test('topics, languages and solved/attempted classification', async () => {
    await problem({ title: 'a', tags: ['Array', 'DP'], submissions: [ac('2026-10-01T00:00:00Z', { language: 'cpp' }), ac('2026-10-02T00:00:00Z', { language: 'python3' })] });
    await problem({ title: 'b', tags: ['Array', 'Array'], submissions: [sub('2026-10-01T00:00:00Z', 'Wrong Answer')] });
    await problem({ title: 'c', tags: ['Graph'], submissions: [ac('2026-10-01T00:00:00Z', { language: 'cpp' })] });
    // Imported as solved, no submissions: solved but undated
    await problem({ title: 'imported', status: 'Solved', tags: ['DP'] });
    // Manual, solved: dated by creation time
    await Problem.collection.insertOne({
      user: userId, platform: 'manual', title: 'manual', difficulty: 'Easy', status: 'Solved',
      tags: [], submissions: [], createdAt: new Date('2026-10-03T00:00:00Z'),
    });
    // Manual to-do: neither solved nor attempted
    await problem({ platform: 'manual', title: 'todo', status: 'To Do' });

    const s = await summary();
    assert.equal(s.totals.problems, 6);
    assert.equal(s.totals.solved, 4);
    assert.equal(s.totals.attempted, 1);
    assert.equal(s.totals.solvedUndated, 1);
    assert.equal(dayCount(s, '2026-10-03'), 1);
    assert.deepEqual(s.topics.find((t) => t.tag === 'Array'), { tag: 'Array', total: 2, solved: 1, attempted: 1 });
    assert.deepEqual(s.topics.find((t) => t.tag === 'DP'), { tag: 'DP', total: 2, solved: 2, attempted: 0 });
    // Language of the latest Accepted submission, one per problem
    assert.deepEqual(s.languages, [{ language: 'cpp', count: 1 }, { language: 'python3', count: 1 }]);
    assert.equal(s.byPlatform.manual.total, 2);
  });

  test('aiAnalyzed / aiStale totals', async () => {
    await problem({
      title: 'fresh',
      submissions: [ac('2026-10-01T00:00:00Z', { code: 'int main(){}' })],
      aiAnalysis: { codeSnapshotHash: md5('int main(){}') },
      aiAnalysisStatus: 'ready',
    });
    await problem({
      title: 'stale',
      submissions: [ac('2026-10-01T00:00:00Z', { code: 'v1' }), ac('2026-10-02T00:00:00Z', { code: 'v2' })],
      aiAnalysis: { codeSnapshotHash: md5('v1') },
      aiAnalysisStatus: 'ready',
    });
    await problem({ title: 'none', submissions: [ac('2026-10-01T00:00:00Z', { code: 'x' })] });

    const s = await summary();
    assert.equal(s.totals.aiAnalyzed, 2);
    assert.equal(s.totals.aiStale, 1);
  });

  test('empty account returns zeros, not errors', async () => {
    const s = await summary();
    assert.equal(s.totals.problems, 0);
    assert.equal(s.totals.acceptanceRate, null);
    assert.equal(s.streak.current, 0);
    assert.equal(s.verdicts.TLE, 0);
    assert.deepEqual(s.byDifficulty.Div1, { total: 0, solved: 0 });
  });

  test('other users\' problems are never counted', async () => {
    await Problem.create({ user: new mongoose.Types.ObjectId(), platform: 'leetcode', title: 'x', submissions: [ac('2026-10-17T01:00:00Z')] });
    const s = await summary();
    assert.equal(s.totals.problems, 0);
  });
});
