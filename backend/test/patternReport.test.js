import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb, ac, sub } from './helpers.js';
import app from '../app.js';
import User from '../models/User.js';
import Problem from '../models/Problem.js';
import Prediction from '../models/Prediction.js';
import generateToken from '../utils/generateToken.js';
import { gapOf } from '../services/patternReportService.js';
import { contrastTip } from '../data/patternContrasts.js';
import { PATTERN_KEYS } from '../data/patterns.js';

let server;
let baseUrl;
let user;
let token;

const get = async (path) => {
  const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json() };
};
const lc = (slug, submissions, extra = {}) =>
  Problem.create({ user: user._id, platform: 'leetcode', platformProblemId: slug, title: slug, difficulty: 'Medium', submissions, ...extra });
const guess = (slug, actual, predicted, source = 'drill', isCorrect = predicted === actual) =>
  Prediction.create({ user: user._id, slug, source, predicted, actual, isCorrect: predicted === 'unsure' ? null : isCorrect, resolvedAt: new Date() });

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
  user = await User.create({ name: 'S', email: 's@example.com', password: 'secret123' });
  token = generateToken(user._id.toString());
});

describe('GET /api/analytics/patterns', () => {
  test('per pattern: solved, how submissions fail, first-try acceptance and tries to accept', async () => {
    await lc('house-robber', [sub('2026-10-01T10:00Z', 'Wrong Answer'), sub('2026-10-01T10:05Z', 'TLE'), ac('2026-10-01T10:10Z')]);
    await lc('climbing-stairs', [ac('2026-10-02')]);
    await lc('coin-change', [sub('2026-10-03', 'RE')]);           // attempted
    await lc('two-sum', [ac('2026-10-04')]);                        // another pattern
    await lc('not-mapped-problem', [sub('2026-10-04', 'Wrong Answer')]); // ignored

    const { status, body } = await get('/api/analytics/patterns');
    assert.equal(status, 200);
    const dp = body.data.patterns.find((p) => p.key === 'dp-1d');
    assert.equal(dp.solved, 2);
    assert.equal(dp.attempted, 1);
    assert.deepEqual(dp.failures, { wrongAnswer: 1, slow: 1, crash: 1 });
    assert.deepEqual(dp.firstSubmit, { solved: 2, accepted: 1, rate: 0.5 });
    assert.equal(dp.attemptsToAccept, 2); // (3 + 1) / 2
    assert.equal(body.data.totals.solved, 3);
    assert.equal(body.data.totals.failures.wrongAnswer, 1, 'unmapped problems are left out');
    assert.equal(body.data.patterns.length, PATTERN_KEYS.length);
  });

  test('the mix-up grid puts right guesses on the diagonal and lists mix-ups with tips', async () => {
    await guess('coin-change', 'dp-1d', 'dp-1d');
    await guess('house-robber', 'dp-1d', 'sliding-window');
    await guess('decode-ways', 'dp-1d', 'sliding-window', 'extension');
    await guess('word-break', 'dp-1d', 'unsure');
    // A secondary-pattern guess is marked correct → counts as spotted
    await guess('two-sum', 'prefix-hashing', 'two-pointers', 'drill', true);

    const { matrix, mixups, patterns } = (await get('/api/analytics/patterns')).body.data;
    const row = matrix.rows.indexOf('dp-1d');
    assert.equal(matrix.counts[row][matrix.columns.indexOf('dp-1d')], 1);
    assert.equal(matrix.counts[row][matrix.columns.indexOf('sliding-window')], 2);
    assert.equal(matrix.counts[row][matrix.columns.indexOf('unsure')], 1);
    const ph = matrix.rows.indexOf('prefix-hashing');
    assert.equal(matrix.counts[ph][matrix.columns.indexOf('prefix-hashing')], 1);
    assert.equal(matrix.counts[ph][matrix.columns.indexOf('two-pointers')], 0);

    assert.deepEqual(mixups, [{ actual: 'dp-1d', predicted: 'sliding-window', count: 2, tip: contrastTip('dp-1d', 'sliding-window') }]);
    const dp = patterns.find((p) => p.key === 'dp-1d');
    assert.deepEqual(dp.recognition, { attempts: 4, correct: 1, accuracy: 0.25 });
  });

  test('needs a sign-in', async () => {
    const res = await fetch(`${baseUrl}/api/analytics/patterns`);
    assert.equal(res.status, 401);
  });
});

describe('biggest gap per pattern', () => {
  const base = (over = {}) => ({
    solved: 3, attempted: 0,
    recognition: { attempts: 0, correct: 0, accuracy: null },
    failures: { wrongAnswer: 0, slow: 0, crash: 0 },
    firstSubmit: { solved: 3, accepted: 3, rate: 1 },
    ...over,
  });

  test('picks recognition first, then speed, then edge cases, then unfinished', () => {
    assert.equal(gapOf(base({ solved: 0 })), 'not-started');
    assert.equal(gapOf(base({ recognition: { attempts: 5, correct: 1, accuracy: 0.2 }, failures: { wrongAnswer: 9, slow: 9, crash: 0 } })), 'recognition');
    assert.equal(gapOf(base({ recognition: { attempts: 2, correct: 0, accuracy: 0 } })), 'on-track', 'two guesses are too few to judge');
    assert.equal(gapOf(base({ failures: { wrongAnswer: 2, slow: 3, crash: 0 } })), 'speed');
    assert.equal(gapOf(base({ failures: { wrongAnswer: 4, slow: 1, crash: 0 }, firstSubmit: { solved: 3, accepted: 1, rate: 1 / 3 } })), 'edge-cases');
    assert.equal(gapOf(base({ failures: { wrongAnswer: 4, slow: 1, crash: 0 } })), 'on-track', 'wrong answers but usually right first time');
    assert.equal(gapOf(base({ solved: 1, attempted: 2 })), 'unfinished');
  });
});

describe('problem list: pattern and guess', () => {
  test('rows carry their pattern and the latest guess made while solving (not drills)', async () => {
    await lc('coin-change', [ac('2026-10-01')]);
    await lc('two-sum', [ac('2026-10-01')]);
    await lc('house-robber', [ac('2026-10-01')]);
    await Problem.create({ user: user._id, platform: 'codeforces', platformProblemId: '1A', title: 'Theatre', difficulty: 'Div2', submissions: [ac('2026-10-01')] });
    await guess('coin-change', 'dp-1d', 'bfs-dfs', 'extension');
    await guess('coin-change', 'dp-1d', 'dp-1d', 'drill'); // drills don't count here
    await guess('two-sum', 'prefix-hashing', 'unsure', 'app');

    const { body } = await get('/api/problems?view=list&sort=title');
    const by = Object.fromEntries(body.data.map((p) => [p.title, p]));
    assert.deepEqual(by['coin-change'].pattern, { key: 'dp-1d', name: '1-D dynamic programming' });
    assert.deepEqual(by['coin-change'].guess, { predicted: 'bfs-dfs', predictedName: 'Graph & grid BFS/DFS', result: 'missed' });
    assert.equal(by['two-sum'].guess.result, 'unsure');
    assert.equal(by['house-robber'].guess, null);
    assert.equal(by.Theatre.pattern, null);
  });

  test('filters by pattern; unknown patterns are rejected', async () => {
    await lc('coin-change', [ac('2026-10-01')]);
    await lc('house-robber', [ac('2026-10-01')]);
    await lc('two-sum', [ac('2026-10-01')]);
    const dp = (await get('/api/problems?view=list&pattern=dp-1d')).body;
    assert.deepEqual(dp.data.map((p) => p.title).sort(), ['coin-change', 'house-robber']);
    assert.equal(dp.total, 2);
    assert.equal((await get('/api/problems?view=list&pattern=dp-1d&platform=codeforces')).body.total, 0);
    assert.equal((await get('/api/problems?view=list&pattern=nope')).status, 400);
  });
});
