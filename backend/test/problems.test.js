import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb, ac, sub } from './helpers.js';
import app from '../app.js';
import Problem from '../models/Problem.js';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import { computeAiAnalysisMeta } from '../utils/aiMeta.js';
import { md5 } from '../utils/hashCode.js';

let server;
let baseUrl;
let user;
let token;

const get = async (path) => {
  const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json() };
};

before(async () => {
  await startDb();
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((r) => server.close(r));
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
  user = await User.create({ name: 'T', email: 't@example.com', password: 'secret123', targetDailySolved: 2 });
  token = generateToken(user._id.toString());
});

describe('computeAiAnalysisMeta', () => {
  const base = { aiAnalysisStatus: 'ready', aiAnalysisError: null };

  test('fresh when the analysis matches the latest Accepted code', () => {
    const m = computeAiAnalysisMeta({
      ...base,
      submissions: [ac('2026-10-01', { code: 'old' }), ac('2026-10-02', { code: 'new' }), sub('2026-10-03', 'Wrong Answer', { code: 'broken' })],
      aiAnalysis: { codeSnapshotHash: md5('new'), generatedAt: new Date('2026-10-02') },
    });
    assert.equal(m.isStale, false);
    assert.equal(m.analyzedHash, md5('new'));
    assert.equal(m.latestAcceptedHash, md5('new'));
    assert.equal(m.latestCodeHash, md5('broken'));
  });

  test('stale when a newer Accepted submission has different code', () => {
    const m = computeAiAnalysisMeta({
      ...base,
      submissions: [ac('2026-10-01', { code: 'old' }), ac('2026-10-02', { code: 'new' })],
      aiAnalysis: { codeSnapshotHash: md5('old') },
    });
    assert.equal(m.isStale, true);
  });

  test('ignores Accepted submissions without code', () => {
    const m = computeAiAnalysisMeta({
      ...base,
      submissions: [ac('2026-10-01', { code: 'old' }), ac('2026-10-02', { code: '  ' })],
      aiAnalysis: { codeSnapshotHash: md5('old') },
    });
    assert.equal(m.isStale, false);
  });

  test('falls back to the latest code of any verdict when nothing Accepted has code', () => {
    const m = computeAiAnalysisMeta({
      ...base,
      submissions: [sub('2026-10-01', 'TLE', { code: 'slow' }), sub('2026-10-02', 'TLE', { code: 'slow2' })],
      aiAnalysis: { codeSnapshotHash: md5('slow') },
    });
    assert.equal(m.latestAcceptedHash, null);
    assert.equal(m.isStale, true);
  });

  test('no analysis is never stale; status defaults sensibly', () => {
    const m = computeAiAnalysisMeta({ submissions: [ac('2026-10-01', { code: 'x' })], aiAnalysis: null });
    assert.equal(m.isStale, false);
    assert.equal(m.status, 'idle');
    assert.equal(m.generatedAt, null);
  });
});

describe('GET /api/problems/:id', () => {
  test('includes aiAnalysisMeta with status, error and staleness', async () => {
    const p = await Problem.create({
      user: user._id, platform: 'leetcode', title: 'P',
      submissions: [ac('2026-10-01T00:00:00Z', { code: 'a' }), ac('2026-10-02T00:00:00Z', { code: 'b' })],
      aiAnalysis: { codeSnapshotHash: md5('a'), generatedAt: new Date('2026-10-01T01:00:00Z') },
      aiAnalysisStatus: 'error',
      aiAnalysisError: 'Gemini quota exceeded',
    });

    const { status, body } = await get(`/api/problems/${p._id}`);
    assert.equal(status, 200);
    assert.equal(body.data.title, 'P');
    assert.equal(body.data.submissions[0].code, 'a');
    assert.deepEqual(body.data.aiAnalysisMeta, {
      status: 'error',
      error: 'Gemini quota exceeded',
      generatedAt: '2026-10-01T01:00:00.000Z',
      analyzedHash: md5('a'),
      latestAcceptedHash: md5('b'),
      latestCodeHash: md5('b'),
      isStale: true,
      pendingSince: null,
    });
  });
});

describe('GET /api/problems', () => {
  const seed = async () => {
    await Problem.create([
      {
        user: user._id, platform: 'leetcode', title: 'Two Sum', difficulty: 'Easy', tags: ['Array', 'Hash Table'], status: 'Solved',
        submissions: [sub('2026-10-01T00:00:00Z', 'Wrong Answer', { code: 'bad' }), ac('2026-10-02T00:00:00Z', { code: 'good', language: 'python3' })],
        aiAnalysis: { codeSnapshotHash: md5('bad') }, aiAnalysisStatus: 'ready',
      },
      {
        user: user._id, platform: 'codeforces', title: 'A+B Problem', difficulty: 'Div2', tags: ['math'], status: 'Attempted',
        submissions: [sub('2026-10-05T00:00:00Z', 'TLE')],
      },
      { user: user._id, platform: 'leetcode', title: 'AxB Problem', difficulty: 'Hard', tags: ['math'], status: 'Solved' },
    ]);
  };

  test('default response is unchanged: every problem, full submissions with code', async () => {
    await seed();
    const { body } = await get('/api/problems');
    assert.equal(body.success, true);
    assert.equal(body.count, 3);
    const twoSum = body.data.find((p) => p.title === 'Two Sum');
    assert.equal(twoSum.submissions[1].code, 'good');
    assert.ok(twoSum.aiAnalysis);
    assert.equal(body.page, undefined);
  });

  test('view=list returns lightweight rows with derived fields and no code', async () => {
    await seed();
    const { status, body } = await get('/api/problems?view=list&sort=title');
    assert.equal(status, 200);
    assert.equal(body.total, 3);
    assert.equal(body.page, 1);
    assert.equal(body.limit, 50);
    assert.deepEqual(body.data.map((p) => p.title), ['A+B Problem', 'AxB Problem', 'Two Sum']);

    for (const p of body.data) {
      assert.equal(p.submissions, undefined);
      assert.equal(p.aiAnalysis, undefined);
      assert.equal(JSON.stringify(p).includes('good'), false);
    }

    const twoSum = body.data.find((p) => p.title === 'Two Sum');
    assert.equal(twoSum.submissionCount, 2);
    assert.equal(twoSum.acceptedCount, 1);
    assert.equal(twoSum.hasCode, true);
    assert.equal(twoSum.latestVerdict, 'Accepted');
    assert.equal(twoSum.latestLanguage, 'python3');
    assert.equal(twoSum.lastSubmittedAt, '2026-10-02T00:00:00.000Z');
    assert.equal(twoSum.firstSolvedAt, '2026-10-02T00:00:00.000Z');
    assert.equal(twoSum.hasAiAnalysis, true);
    assert.equal(twoSum.aiStatus, 'ready');
    assert.equal(twoSum.aiIsStale, true);

    const ab = body.data.find((p) => p.title === 'A+B Problem');
    assert.equal(ab.hasCode, false);
    assert.equal(ab.latestVerdict, 'TLE');
    assert.equal(ab.firstSolvedAt, null);
    assert.equal(ab.aiStatus, 'idle');
    assert.equal(ab.aiIsStale, false);

    const axb = body.data.find((p) => p.title === 'AxB Problem');
    assert.equal(axb.submissionCount, 0);
    assert.equal(axb.latestVerdict, null);
  });

  test('view=list paginates', async () => {
    await seed();
    const { body } = await get('/api/problems?view=list&sort=title&limit=2&page=2');
    assert.equal(body.total, 3);
    assert.equal(body.page, 2);
    assert.equal(body.limit, 2);
    assert.deepEqual(body.data.map((p) => p.title), ['Two Sum']);
  });

  test('view=list search treats regex characters literally', async () => {
    await seed();
    const { body } = await get(`/api/problems?view=list&search=${encodeURIComponent('A+B')}`);
    assert.deepEqual(body.data.map((p) => p.title), ['A+B Problem']);

    const dot = await get(`/api/problems?view=list&search=${encodeURIComponent('.*')}`);
    assert.equal(dot.body.total, 0);
  });

  test('view=list filters by difficulty, status, platform and tag', async () => {
    await seed();
    const byDiff = await get('/api/problems?view=list&difficulty=Easy,Div2');
    assert.equal(byDiff.body.total, 2);
    const byStatus = await get('/api/problems?view=list&status=Solved');
    assert.equal(byStatus.body.total, 2);
    const byPlatform = await get('/api/problems?view=list&platform=codeforces');
    assert.equal(byPlatform.body.total, 1);
    const byTag = await get('/api/problems?view=list&tag=MATH');
    assert.equal(byTag.body.total, 2);
    const byTagRegex = await get(`/api/problems?view=list&tag=${encodeURIComponent('m.*')}`);
    assert.equal(byTagRegex.body.total, 0);
  });

  test('view=list derives status from submissions, not the stored default', async () => {
    // Sync creates the doc first, so it gets the schema default status 'Solved'
    await Problem.create({
      user: user._id, platform: 'codeforces', title: 'Synced WA', difficulty: 'Div3',
      submissions: [sub('2026-10-05T00:00:00Z', 'Wrong Answer')],
    });
    const { body } = await get('/api/problems?view=list');
    assert.equal(body.data[0].storedStatus, 'Solved');
    assert.equal(body.data[0].status, 'Attempted');
    assert.equal((await get('/api/problems?view=list&status=Solved')).body.total, 0);
    assert.equal((await get('/api/problems?view=list&status=Attempted')).body.total, 1);
  });

  test('view=list sorts by derived fields and rejects unknown sort keys', async () => {
    await seed();
    const { body } = await get('/api/problems?view=list&sort=-submissionCount');
    assert.deepEqual(body.data.map((p) => p.submissionCount), [2, 1, 0]);
    const bad = await get('/api/problems?view=list&sort=password');
    assert.equal(bad.status, 400);
  });
});

describe('GET /api/analytics/summary (HTTP)', () => {
  test('returns the summary for the logged-in user with their daily target', async () => {
    await Problem.create({ user: user._id, platform: 'leetcode', title: 'P', difficulty: 'Easy', submissions: [ac(new Date())] });
    const { status, body } = await get('/api/analytics/summary?tz=Asia/Kolkata&platform=leetcode');
    assert.equal(status, 200);
    assert.equal(body.data.timezone, 'Asia/Kolkata');
    assert.equal(body.data.platform, 'leetcode');
    assert.equal(body.data.today.target, 2);
    assert.equal(body.data.today.solved, 1);
  });

  test('rejects bad platform and tz', async () => {
    assert.equal((await get('/api/analytics/summary?platform=hackerrank')).status, 400);
    assert.equal((await get('/api/analytics/summary?tz=Mars/Base')).status, 400);
  });

  test('requires auth', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/summary`);
    assert.equal(res.status, 401);
  });
});
