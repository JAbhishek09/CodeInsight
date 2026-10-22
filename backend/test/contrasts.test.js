import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb, ac, sub } from './helpers.js';
import app from '../app.js';
import User from '../models/User.js';
import Problem from '../models/Problem.js';
import Prediction from '../models/Prediction.js';
import generateToken from '../utils/generateToken.js';
import { ALL_PAIRS, contrastTip } from '../data/patternContrasts.js';

let server;
let baseUrl;
let user;
let token;

const call = async (method, path, body) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
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
  user = await User.create({ name: 'S', email: 's@example.com', password: 'secret123' });
  token = generateToken(user._id.toString());
});

describe('how to tell patterns apart', () => {
  test('every pair of patterns has a tip, in either order', () => {
    assert.equal(ALL_PAIRS.length, 28);
    for (const [a, b] of ALL_PAIRS) {
      assert.ok(contrastTip(a, b), `${a} vs ${b}`);
      assert.equal(contrastTip(a, b), contrastTip(b, a));
    }
    assert.equal(contrastTip('stack', 'stack'), null);
  });

  test('a wrong guess explains how to tell the two apart; a right or unsure guess does not', async () => {
    const wrong = (await call('POST', '/api/predictions', { slug: 'coin-change', predicted: 'sliding-window', source: 'drill' })).body.data.feedback;
    assert.equal(wrong.contrast.key, 'sliding-window');
    assert.equal(wrong.contrast.tip, contrastTip('dp-1d', 'sliding-window'));

    const right = (await call('POST', '/api/predictions', { slug: 'two-sum', predicted: 'prefix-hashing', source: 'drill' })).body.data.feedback;
    assert.equal(right.contrast, null);
    const unsure = (await call('POST', '/api/predictions', { slug: 'house-robber', predicted: 'unsure', source: 'drill' })).body.data.feedback;
    assert.equal(unsure.contrast, null);
  });

  test('"patterns you mix up" carry the tip', async () => {
    await call('POST', '/api/predictions', { slug: 'coin-change', predicted: 'bfs-dfs', source: 'drill' });
    const { confusions } = (await call('GET', '/api/predictions/stats')).body.data;
    assert.equal(confusions[0].tip, contrastTip('dp-1d', 'bfs-dfs'));
  });
});

describe('focus pattern', () => {
  test('the pattern map and Home pick the same focus, recognition included', async () => {
    // Solving is weakest in heap, but recognition is terrible in two-pointers
    for (const slug of ['valid-palindrome', 'move-zeroes', 'merge-sorted-array', '3sum', 'two-sum', 'binary-search'])
      await Problem.create({ user: user._id, platform: 'leetcode', platformProblemId: slug, title: slug, difficulty: 'Easy', submissions: [ac('2026-10-01')] });
    await Problem.create({ user: user._id, platform: 'leetcode', platformProblemId: 'last-stone-weight', title: 'x', difficulty: 'Easy', submissions: [sub('2026-10-01', 'Wrong Answer')] });
    for (let i = 0; i < 5; i++) {
      await Prediction.create({ user: user._id, slug: 'valid-palindrome', source: 'drill', predicted: 'stack', actual: 'two-pointers', isCorrect: false, resolvedAt: new Date() });
    }
    const map = (await call('GET', '/api/patterns')).body.data;
    const home = (await call('GET', '/api/practice/today?tz=UTC')).body.data;
    assert.ok(map.focusKey);
    assert.equal(map.focusKey, home.focus.key);
  });
});
