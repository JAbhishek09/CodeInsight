import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { startDb, stopDb, clearDb } from './helpers.js';
import app from '../app.js';
import User from '../models/User.js';
import Prediction from '../models/Prediction.js';
import generateToken from '../utils/generateToken.js';

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
const guess = (slug, predicted, source = 'extension') => call('POST', '/api/predictions', { slug, predicted, source });
const upload = (slug, submissionId, verdict) => call('POST', '/api/extensions/leetcode/submission', {
  problemSlug: slug,
  submissionId: String(submissionId),
  title: slug,
  verdict,
  language: 'cpp',
  code: 'int main() { return 0; }',
  submittedAt: new Date().toISOString(),
  leetcodeUsername: 'student1',
  _nonce: crypto.randomBytes(16).toString('hex'),
  _ts: Date.now(),
});

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
  user = await User.create({ name: 'S', email: 's@example.com', password: 'secret123', leetcodeHandle: 'student1' });
  token = generateToken(user._id.toString());
});

describe('predict → submit → feedback (extension)', () => {
  test('a guess reveals nothing; the next submission returns feedback', async () => {
    const g = await guess('longest-substring-without-repeating-characters', 'sliding-window');
    assert.equal(g.status, 201);
    assert.equal(g.body.data.feedback, null, 'answer must not be revealed before submitting');

    const u = await upload('longest-substring-without-repeating-characters', 101, 'Accepted');
    assert.equal(u.status, 201);
    const f = u.body.feedback;
    assert.equal(f.outcome, 'recognised');
    assert.equal(f.isCorrect, true);
    assert.equal(f.pattern.key, 'sliding-window');
    assert.match(f.title, /Right/);
  });

  test('wrong guess + TLE is labelled a wrong approach with the clue', async () => {
    await guess('two-sum', 'two-pointers');
    const { body } = await upload('two-sum', 102, 'TLE');
    assert.equal(body.feedback.outcome, 'wrong-approach');
    assert.equal(body.feedback.pattern.key, 'prefix-hashing');
    assert.match(body.feedback.title, /This is Prefix sums & hashing, not Two pointers/);
    assert.match(body.feedback.message, /complement/);
  });

  test('right guess but wrong answer points at the implementation', async () => {
    await guess('binary-search', 'binary-search');
    const { body } = await upload('binary-search', 103, 'Wrong Answer');
    assert.equal(body.feedback.outcome, 'right-pattern-bug');
  });

  test('changing your mind updates the open guess; only the latest counts', async () => {
    await guess('number-of-islands', 'dp-1d');
    await guess('number-of-islands', 'bfs-dfs');
    assert.equal(await Prediction.countDocuments({ user: user._id }), 1);
    const { body } = await upload('number-of-islands', 104, 'Accepted');
    assert.equal(body.feedback.predicted, 'bfs-dfs');
    assert.equal(body.feedback.isCorrect, true);
  });

  test('re-sending the same submission returns the same feedback; a later submission has none', async () => {
    await guess('valid-parentheses', 'stack');
    const first = await upload('valid-parentheses', 105, 'Accepted');
    const again = await upload('valid-parentheses', 105, 'Accepted');
    assert.equal(again.body.duplicate, true);
    assert.equal(again.body.feedback.predictionId, first.body.feedback.predictionId);
    const later = await upload('valid-parentheses', 106, 'Accepted');
    assert.equal(later.body.feedback, null, 'no open guess left');
  });

  test('submissions without a guess still work and carry no feedback', async () => {
    const { status, body } = await upload('climbing-stairs', 107, 'Accepted');
    assert.equal(status, 201);
    assert.equal(body.feedback, null);
  });

  test('a secondary pattern also counts as correct', async () => {
    await guess('sliding-window-maximum', 'stack');
    const { body } = await upload('sliding-window-maximum', 108, 'Accepted');
    assert.equal(body.feedback.isCorrect, true);
  });
});

describe('app guesses and stats', () => {
  test('app guesses resolve immediately with feedback; unmapped problems say so', async () => {
    const a = await guess('house-robber', 'dp-1d', 'app');
    assert.equal(a.body.data.feedback.isCorrect, true);
    const b = await guess('some-unmapped-problem', 'stack', 'app');
    assert.equal(b.body.data.feedback.outcome, 'unmapped');
    const latest = await call('GET', '/api/predictions/latest?slug=house-robber');
    assert.equal(latest.body.data.predictionId, a.body.data.predictionId);
  });

  test('accuracy counts unsure as a miss, ignores unmapped, and lists confusions', async () => {
    await guess('house-robber', 'dp-1d', 'app');              // correct
    await guess('coin-change', 'heap-top-k', 'app');          // wrong: dp-1d mistaken for heap
    await guess('climbing-stairs', 'unsure', 'app');          // unsure
    await guess('some-unmapped-problem', 'stack', 'app');     // ignored
    const { body } = await call('GET', '/api/predictions/stats');
    const s = body.data;
    assert.equal(s.attempts, 3);
    assert.equal(s.correct, 1);
    assert.ok(Math.abs(s.accuracy - 1 / 3) < 1e-9);
    const dp = s.perPattern.find((p) => p.key === 'dp-1d');
    assert.deepEqual([dp.attempts, dp.correct, dp.unsure], [3, 1, 1]);
    assert.equal(s.confusions[0].actual, 'dp-1d');
    assert.equal(s.confusions[0].predicted, 'heap-top-k');
  });

  test('rejects unknown patterns, bad slugs and other users’ data', async () => {
    assert.equal((await guess('two-sum', 'magic')).status, 400);
    assert.equal((await guess('Two Sum!', 'stack')).status, 400);
    await guess('house-robber', 'dp-1d', 'app');
    const other = await User.create({ name: 'O', email: 'o@example.com', password: 'secret123' });
    token = generateToken(other._id.toString());
    const { body } = await call('GET', '/api/predictions/stats');
    assert.equal(body.data.attempts, 0);
  });
});
