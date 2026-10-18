import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { startDb, stopDb, clearDb } from './helpers.js';
import app from '../app.js';
import User from '../models/User.js';
import Problem from '../models/Problem.js';
import Prediction from '../models/Prediction.js';
import generateToken from '../utils/generateToken.js';
import { onboardingStatus, weekStartOf, weeklyRecognition } from '../services/pilotService.js';

let server;
let baseUrl;
let user;
let token;

const call = async (method, path, body, auth = true) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};
const guess = (slug, predicted, isCorrect, resolvedAt, source = 'drill') =>
  Prediction.create({ user: user._id, slug, source, predicted, actual: 'dp-1d', isCorrect, resolvedAt: new Date(resolvedAt) });

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
  delete process.env.PILOT_INVITE_CODE;
  user = await User.create({ name: 'S', email: 's@example.com', password: 'secret123' });
  token = generateToken(user._id.toString());
});

describe('weekly recognition', () => {
  test('weeks start on Monday', () => {
    assert.equal(weekStartOf('2026-10-18'), '2026-10-12'); // Sunday
    assert.equal(weekStartOf('2026-10-12'), '2026-10-12'); // Monday
    assert.equal(weekStartOf('2026-10-14'), '2026-10-12');
  });

  test('buckets by week in the student’s zone; first try ignores repeats; unsure counts as wrong', async () => {
    const now = new Date('2026-10-18T12:00:00Z');
    await guess('coin-change', 'two-pointers', false, '2026-10-06T10:00:00Z');       // wk 10-05, first try wrong
    await guess('coin-change', 'dp-1d', true, '2026-10-13T10:00:00Z');              // wk 10-12, repeat
    await guess('house-robber', 'dp-1d', true, '2026-10-14T10:00:00Z', 'extension'); // wk 10-12, first try right
    await guess('climbing-stairs', 'unsure', null, '2026-10-15T10:00:00Z');         // wk 10-12, first try "wrong"
    // 23:30 UTC Sunday is Monday in Kolkata → next week there
    await guess('decode-ways', 'dp-1d', true, '2026-10-11T23:30:00Z');

    const utc = await weeklyRecognition(user._id, { tz: 'UTC', weeks: 3, now });
    assert.deepEqual(utc.map((w) => w.weekStart), ['2026-09-28', '2026-10-05', '2026-10-12']);
    const [, prev, cur] = utc;
    assert.equal(prev.attempts, 2);
    assert.equal(cur.attempts, 3);
    assert.equal(cur.correct, 2);
    assert.deepEqual(cur.firstTry, { attempts: 2, correct: 1, accuracy: 0.5 });
    assert.equal(cur.bySource.extension, 1);
    assert.equal(cur.activeDays, 3);

    const ist = await weeklyRecognition(user._id, { tz: 'Asia/Kolkata', weeks: 3, now });
    assert.equal(ist[1].attempts, 1);
    assert.equal(ist[2].attempts, 4);
  });

  test('GET /api/predictions/weekly returns empty weeks and validates tz', async () => {
    const { status, body } = await call('GET', '/api/predictions/weekly?tz=UTC&weeks=4');
    assert.equal(status, 200);
    assert.equal(body.data.length, 4);
    assert.equal(body.data[3].accuracy, null);
    assert.equal((await call('GET', '/api/predictions/weekly?tz=Mars/Base')).status, 400);
  });
});

describe('onboarding', () => {
  test('tracks LeetCode link, import, first drill and extension use', async () => {
    assert.deepEqual(await onboardingStatus(user._id), { leetcodeLinked: false, imported: false, drilled: false, extension: false, done: false });
    await User.updateOne({ _id: user._id }, { leetcodeHandle: 'student1' });
    await Problem.create({ user: user._id, platform: 'leetcode', platformProblemId: 'two-sum', title: 'Two Sum', difficulty: 'Easy' });
    await call('POST', '/api/predictions', { slug: 'two-sum', predicted: 'prefix-hashing', source: 'drill' });
    await call('POST', '/api/predictions', { slug: 'coin-change', predicted: 'dp-1d', source: 'extension' });
    const s = await onboardingStatus(user._id);
    assert.equal(s.done, true);
    const today = (await call('GET', '/api/practice/today?tz=UTC')).body.data;
    assert.equal(today.onboarding.done, true);
  });

  test('an extension upload marks the extension as connected', async () => {
    await User.updateOne({ _id: user._id }, { leetcodeHandle: 'student1' });
    await call('POST', '/api/extensions/leetcode/submission', {
      problemSlug: 'two-sum', submissionId: '1', title: 'Two Sum', verdict: 'Accepted', language: 'cpp',
      code: 'int main() { return 0; }', submittedAt: new Date().toISOString(), leetcodeUsername: 'student1',
      _nonce: crypto.randomBytes(16).toString('hex'), _ts: Date.now(),
    });
    assert.ok((await User.findById(user._id)).extensionSeenAt);
  });
});

describe('pilot invite code', () => {
  const reg = (invite) => call('POST', '/api/auth/register', { name: 'New', email: `n${Math.random()}@example.com`, password: 'secret123', invite }, false);

  test('open sign-up when no code is configured', async () => {
    assert.equal((await call('GET', '/api/auth/config', null, false)).body.data.inviteRequired, false);
    assert.equal((await reg()).status, 201);
  });

  test('with PILOT_INVITE_CODE set, sign-up needs it (case-insensitive)', async () => {
    process.env.PILOT_INVITE_CODE = 'Patterns2026';
    assert.equal((await call('GET', '/api/auth/config', null, false)).body.data.inviteRequired, true);
    assert.equal((await reg()).status, 403);
    assert.equal((await reg('wrong')).status, 403);
    assert.equal((await reg(' patterns2026 ')).status, 201);
  });
});
