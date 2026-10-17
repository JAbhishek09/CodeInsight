import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { startDb, stopDb, clearDb, ac, sub } from './helpers.js';
import Problem from '../models/Problem.js';
import '../models/User.js'; // used by Problem's post-save hook
import { buildAiInsights } from '../services/aiInsightsService.js';
import { md5 } from '../utils/hashCode.js';

const userId = new mongoose.Types.ObjectId();
const otherUser = new mongoose.Types.ObjectId();

const problem = (fields) => Problem.create({ user: userId, platform: 'leetcode', title: 'P', difficulty: 'Easy', ...fields });
const analysis = (code, extra = {}) => ({
  codeSnapshotHash: md5(code),
  generatedAt: new Date('2026-10-10T00:00:00Z'),
  complexityAnalysis: { current: 'O(n^2) time, O(1) space', optimal: 'O(n) time, O(n) space', explanation: 'x' },
  optimizationAreas: [{ description: 'Use a hash map', snippet: 'map<int,int> m;' }],
  edgeCasesToConsider: ['Empty array', '  '],
  interviewerQuestions: [{ question: 'q', expectedAnswer: 'a' }],
  ...extra,
});

before(startDb);
after(stopDb);
beforeEach(clearDb);

describe('AI insights data', () => {
  test('returns analysis text without code, normalising old and new feedback shapes', async () => {
    const code = 'int main() {}';
    const p0 = await problem({ title: 'Analysed', submissions: [ac('2026-10-01T00:00:00Z', { code })], aiAnalysis: analysis(code) });
    // Old analyses stored feedback as plain strings; the schema no longer allows
    // writing that shape, so put one in directly.
    await Problem.collection.updateOne({ _id: p0._id }, { $push: { 'aiAnalysis.optimizationAreas': 'Legacy string feedback' } });

    const d = await buildAiInsights({ userId });
    assert.equal(d.analyzed.length, 1);
    const [p] = d.analyzed;
    assert.equal(p.title, 'Analysed');
    assert.deepEqual(p.feedback, ['Use a hash map', 'Legacy string feedback']);
    assert.deepEqual(p.edgeCases, ['Empty array']);
    assert.equal(p.complexity.optimal, 'O(n) time, O(n) space');
    assert.equal(p.isStale, false);
    assert.equal('submissions' in p, false);
    assert.equal(JSON.stringify(d).includes(code), false, 'code must not be returned');
  });

  test('counts coverage: solved, with code, analysed, stale and ready to review', async () => {
    const oldCode = 'v1';
    await problem({ title: 'Stale', submissions: [ac('2026-10-02T00:00:00Z', { code: 'v2' }), ac('2026-10-01T00:00:00Z', { code: oldCode })], aiAnalysis: analysis(oldCode) });
    await problem({ title: 'Ready', submissions: [ac('2026-10-01T00:00:00Z', { code: 'x' })] });
    await problem({ title: 'No code', submissions: [ac('2026-10-01T00:00:00Z')] });
    await problem({ title: 'Unsolved', submissions: [sub('2026-10-01T00:00:00Z', 'Wrong Answer', { code: 'y' })] });
    await Problem.create({ user: otherUser, platform: 'leetcode', title: 'Someone else', submissions: [ac('2026-10-01T00:00:00Z', { code: 'z' })] });

    const { counts } = await buildAiInsights({ userId });
    assert.deepEqual(counts, { solved: 3, withCode: 3, analyzed: 1, stale: 1, readyToReview: 1 });
  });

  test('time to accepted ignores first-try solves and multi-day gaps', async () => {
    await problem({ title: 'First try', submissions: [ac('2026-10-01T10:00:00Z')] });
    await problem({ title: '30 min', submissions: [sub('2026-10-01T10:00:00Z', 'Wrong Answer'), ac('2026-10-01T10:30:00Z')] });
    await problem({ title: '10 min', submissions: [sub('2026-10-01T10:00:00Z', 'TLE'), ac('2026-10-01T10:10:00Z'), ac('2026-10-05T10:00:00Z')] });
    await problem({ title: 'Came back a week later', submissions: [sub('2026-10-01T10:00:00Z', 'Wrong Answer'), ac('2026-10-08T10:00:00Z')] });

    const { timeToAccepted } = await buildAiInsights({ userId });
    assert.deepEqual(timeToAccepted, { sampleSize: 2, avgMinutes: 20, medianMinutes: 20 });
  });

  test('platform filter limits to that platform', async () => {
    await problem({ title: 'LC', submissions: [ac('2026-10-01T00:00:00Z', { code: 'a' })] });
    await problem({ title: 'CF', platform: 'codeforces', difficulty: 'Div2', submissions: [ac('2026-10-01T00:00:00Z', { code: 'b' })] });
    const { counts } = await buildAiInsights({ userId, platform: 'codeforces' });
    assert.equal(counts.solved, 1);
  });
});
