import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb, ac, sub } from './helpers.js';
import app from '../app.js';
import Problem from '../models/Problem.js';
import User from '../models/User.js';
import AiUsage from '../models/AiUsage.js';
import generateToken from '../utils/generateToken.js';
import { __setGeneratorForTests, modelChain } from '../services/aiService.js';
import { diagnoseProblem } from '../services/diagnosisService.js';

let server;
let baseUrl;
let user;
let token;
let aiCalls;

const call = async (method, path, body) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
};
const lc = (slug, submissions) =>
  Problem.create({ user: user._id, platform: 'leetcode', platformProblemId: slug, title: slug, difficulty: 'Medium', submissions });

const TUTOR_REPLY = {
  diagnosis: 'wrong-pattern',
  summary: 'The nested loops over `nums` check every pair.',
  nudge: 'What if you remembered the numbers you have already seen?',
  checks: ['Count how many times the inner loop runs', 'Try n = 10^4'],
  patternTip: '"Have I seen the complement?" means hashing.',
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
  delete process.env.AI_DAILY_LIMIT;
  user = await User.create({ name: 'S', email: 's@example.com', password: 'secret123', leetcodeHandle: 'student1' });
  token = generateToken(user._id.toString());
  aiCalls = [];
  __setGeneratorForTests(async ({ prompt }) => { aiCalls.push(prompt); return JSON.stringify(TUTOR_REPLY); });
});
afterEach(() => { delete process.env.AI_DAILY_LIMIT; });

describe('diagnosis rules', () => {
  const p = (subs, slug = 'two-sum') => ({ platform: 'leetcode', platformProblemId: slug, submissions: subs });

  test('first-try accept is clean', () => {
    const d = diagnoseProblem(p([ac('2026-10-01')]));
    assert.equal(d.status, 'clean');
    assert.equal(d.signals[0].type, 'clean');
    assert.equal(d.pattern.key, 'prefix-hashing');
  });

  test('TLE before accept is flagged too slow with the optimal complexity', () => {
    const d = diagnoseProblem(p([sub('2026-10-01', 'TLE'), ac('2026-10-02')]));
    const s = d.signals.find((x) => x.type === 'too-slow');
    assert.ok(s);
    assert.match(s.detail, /O\(n\)/);
  });

  test('two wrong answers bring the pattern’s edge-case checklist', () => {
    const d = diagnoseProblem(p([sub('2026-10-01', 'Wrong Answer'), sub('2026-10-02', 'Wrong Answer')], 'binary-search'));
    assert.equal(d.status, 'in-progress');
    assert.ok(d.signals.some((x) => x.type === 'wrong-answers'));
    assert.ok(d.checklist.some((c) => /mid/.test(c)), 'binary search checklist');
  });

  test('accepted after 4+ tries schedules a review a week later', () => {
    const d = diagnoseProblem(p([
      sub('2026-10-01T00:00:00Z', 'Wrong Answer'), sub('2026-10-01T00:05:00Z', 'TLE'),
      sub('2026-10-01T00:10:00Z', 'RE'), ac('2026-10-01T00:20:00Z'),
    ]));
    assert.equal(d.status, 'solved-with-struggle');
    assert.equal(d.triesToAc, 4);
    assert.equal(d.reviewOn, '2026-10-08T00:20:00.000Z');
  });

  test('3 failures without an accept is stuck; a missed guess is a recognition miss', () => {
    const fb = { outcome: 'missed', predictedName: 'Two pointers', pattern: { name: 'Prefix sums & hashing', cue: 'complement' } };
    const d = diagnoseProblem(p([sub('2026-10-01', 'Wrong Answer'), sub('2026-10-02', 'TLE'), sub('2026-10-03', 'Wrong Answer')]), fb);
    assert.equal(d.status, 'stuck');
    assert.ok(d.signals.some((x) => x.type === 'recognition-miss'));
    assert.ok(d.signals.some((x) => x.type === 'stuck'));
  });

  test('problem detail includes the diagnosis', async () => {
    const doc = await lc('two-sum', [sub('2026-10-01', 'TLE'), ac('2026-10-02')]);
    const { body } = await call('GET', `/api/problems/${doc._id}`);
    assert.ok(body.data.diagnosis.signals.some((x) => x.type === 'too-slow'));
  });
});

describe('AI tutor', () => {
  test('explains the latest failed attempt with the known pattern in the prompt, then serves it from cache', async () => {
    const doc = await lc('two-sum', [
      sub('2026-10-01', 'TLE', { code: 'for i for j', submissionId: '11' }),
      sub('2026-10-02', 'Wrong Answer', { code: 'map attempt', submissionId: '12' }),
    ]);
    const first = await call('POST', `/api/tutor/${doc._id}`, {});
    assert.equal(first.status, 200);
    assert.equal(first.body.data.submissionId, '12', 'defaults to the newest failure');
    assert.equal(first.body.data.answer.diagnosis, 'wrong-pattern');
    assert.equal(first.body.data.cached, false);
    assert.equal(aiCalls.length, 1);
    assert.match(aiCalls[0], /Known pattern: Prefix sums & hashing/);
    assert.match(aiCalls[0], /Clue in the statement/);
    assert.match(aiCalls[0], /map attempt/);

    const again = await call('POST', `/api/tutor/${doc._id}`, { submissionId: '12' });
    assert.equal(again.body.data.cached, true);
    assert.equal(aiCalls.length, 1, 'cached answers don’t call the AI');
    assert.equal(await AiUsage.countDocuments({ user: user._id }), 1, 'and don’t use quota');

    const older = await call('POST', `/api/tutor/${doc._id}`, { submissionId: '11' });
    assert.equal(older.body.data.submissionId, '11');
    assert.equal(aiCalls.length, 2);

    const { body } = await call('GET', `/api/tutor/${doc._id}`);
    assert.equal(body.data.answers.length, 2);
    assert.equal(body.data.failed.length, 2);
    assert.equal(body.data.quota.used, 2);
  });

  test('refuses when there is nothing failed to explain', async () => {
    const doc = await lc('two-sum', [ac('2026-10-01', { code: 'ok' })]);
    const r = await call('POST', `/api/tutor/${doc._id}`, {});
    assert.equal(r.status, 400);
  });

  test('daily limit stops new questions with 429; cached answers still work', async () => {
    process.env.AI_DAILY_LIMIT = '1';
    const doc = await lc('two-sum', [
      sub('2026-10-01', 'TLE', { code: 'a', submissionId: '21' }),
      sub('2026-10-02', 'TLE', { code: 'b', submissionId: '22' }),
    ]);
    assert.equal((await call('POST', `/api/tutor/${doc._id}`, { submissionId: '22' })).status, 200);
    const blocked = await call('POST', `/api/tutor/${doc._id}`, { submissionId: '21' });
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.message, /1 AI requests/);
    assert.equal((await call('POST', `/api/tutor/${doc._id}`, { submissionId: '22' })).status, 200);
    const q = await call('GET', '/api/tutor/quota');
    assert.deepEqual([q.body.data.used, q.body.data.remaining], [1, 0]);
  });

  test('other users’ problems and bad ids are 404', async () => {
    const doc = await lc('two-sum', [sub('2026-10-01', 'TLE', { code: 'a' })]);
    const other = await User.create({ name: 'O', email: 'o@example.com', password: 'secret123' });
    token = generateToken(other._id.toString());
    assert.equal((await call('POST', `/api/tutor/${doc._id}`, {})).status, 404);
    assert.equal((await call('GET', '/api/tutor/not-an-id')).status, 404);
  });

  test('an incomplete AI answer is an error, not a blank card', async () => {
    __setGeneratorForTests(async () => JSON.stringify({ diagnosis: 'bogus' }));
    const doc = await lc('two-sum', [sub('2026-10-01', 'TLE', { code: 'a' })]);
    const r = await call('POST', `/api/tutor/${doc._id}`, {});
    assert.equal(r.status, 500);
    assert.match(r.body.message, /incomplete/);
  });
});

describe('AI analysis uses the daily limit', () => {
  test('manual analysis returns 429 when over the limit and leaves the problem usable', async () => {
    process.env.AI_DAILY_LIMIT = '1';
    __setGeneratorForTests(async () => JSON.stringify({
      complexityAnalysis: { current: 'O(n)', optimal: 'O(n)', explanation: 'x' },
      optimizationAreas: [], interviewerQuestions: [], hints: [], edgeCasesToConsider: [],
    }));
    const a = await lc('two-sum', [ac('2026-10-01', { code: 'one' })]);
    const b = await lc('valid-anagram', [ac('2026-10-01', { code: 'two' })]);
    assert.equal((await call('POST', `/api/analyze/${a._id}`)).status, 200);
    const blocked = await call('POST', `/api/analyze/${b._id}`);
    assert.equal(blocked.status, 429);
    const after = await Problem.findById(b._id);
    assert.equal(after.aiAnalysisStatus, 'idle', 'not left pending');
    // cached result for the first problem is still free
    assert.equal((await call('POST', `/api/analyze/${a._id}`)).body.fromCache, true);
  });
});

describe('quota refunds', () => {
  test('a failed AI call gives the request back', async () => {
    __setGeneratorForTests(async () => { throw new Error('Bad request: invalid argument'); });
    const doc = await lc('two-sum', [sub('2026-10-01', 'TLE', { code: 'a' })]);
    const r = await call('POST', `/api/tutor/${doc._id}`, {});
    assert.equal(r.status, 500);
    assert.equal(await AiUsage.countDocuments({ user: user._id }), 0);
  });
});

describe('diagnosis — single failure', () => {
  test('one wrong answer on an unsolved problem still surfaces a signal (so the tutor is offered)', () => {
    const d = diagnoseProblem({ platform: 'leetcode', platformProblemId: 'two-sum', submissions: [sub('2026-10-01', 'Wrong Answer')] });
    assert.equal(d.status, 'in-progress');
    assert.equal(d.signals[0].type, 'not-accepted');
  });
});

describe('AI provider errors', () => {
  test('provider quota errors are not retried on a model, and show a plain message once every model is out', async () => {
    const tried = [];
    __setGeneratorForTests(async ({ model }) => { tried.push(model); throw new Error('[429 Too Many Requests] You exceeded your current quota, please check your plan and billing details.'); });
    const doc = await lc('two-sum', [sub('2026-10-01', 'TLE', { code: 'a' })]);
    const r = await call('POST', `/api/tutor/${doc._id}`, {});
    assert.deepEqual(tried, modelChain(), 'each model tried once');
    assert.equal(r.body.message, 'The free AI allowance is used up for today. Everything else works — try the AI again tomorrow.');
    assert.equal(await AiUsage.countDocuments({ user: user._id }), 0, 'refunded');
  });
});
