import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { startDb, stopDb, clearDb } from './helpers.js';
import app from '../app.js';
import User from '../models/User.js';
import Problem from '../models/Problem.js';
import generateToken from '../utils/generateToken.js';
import { __setGeneratorForTests, generateJson, modelChain } from '../services/aiService.js';

const QUOTA = '[429 Too Many Requests] You exceeded your current quota, please check your plan and billing details.';
let server;
let baseUrl;
let user;
let token;

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
  delete process.env.GEMINI_MODELS;
  delete process.env.AI_AUTO_REVIEW;
  user = await User.create({ name: 'S', email: 's@example.com', password: 'secret123', leetcodeHandle: 'student1' });
  token = generateToken(user._id.toString());
});

describe('model chain (free tier)', () => {
  test('GEMINI_MODELS sets the chain; GEMINI_MODEL alone goes first', () => {
    process.env.GEMINI_MODELS = 'a, b,a';
    assert.deepEqual(modelChain(), ['a', 'b']);
    delete process.env.GEMINI_MODELS;
    process.env.GEMINI_MODEL = 'mine';
    assert.equal(modelChain()[0], 'mine');
    delete process.env.GEMINI_MODEL;
  });

  test('a model out of quota hands over to the next, and is skipped afterwards', async () => {
    process.env.GEMINI_MODELS = 'one,two';
    const tried = [];
    __setGeneratorForTests(async ({ model }) => {
      tried.push(model);
      if (model === 'one') throw new Error(QUOTA);
      return '{"ok":true}';
    });
    assert.deepEqual(await generateJson({ system: 's', prompt: 'p' }), { ok: true });
    assert.deepEqual(await generateJson({ system: 's', prompt: 'p' }), { ok: true });
    assert.deepEqual(tried, ['one', 'two', 'two']);
  });

  test('a retired or unavailable model is skipped', async () => {
    process.env.GEMINI_MODELS = 'gone,two';
    __setGeneratorForTests(async ({ model }) => {
      if (model === 'gone') throw new Error('[404 Not Found] models/gone is not found for API version v1beta');
      return '{"ok":1}';
    });
    assert.deepEqual(await generateJson({ system: 's', prompt: 'p' }), { ok: 1 });
  });

  test('a bad request is not repeated on other models', async () => {
    process.env.GEMINI_MODELS = 'one,two';
    const tried = [];
    __setGeneratorForTests(async ({ model }) => { tried.push(model); throw new Error('[400 Bad Request] invalid argument'); });
    await assert.rejects(generateJson({ system: 's', prompt: 'p' }), /unavailable right now/);
    assert.deepEqual(tried, ['one']);
  });

  test('once every model is out, requests fail fast without calling the provider', async () => {
    process.env.GEMINI_MODELS = 'one,two';
    let calls = 0;
    __setGeneratorForTests(async () => { calls += 1; throw new Error(QUOTA); });
    await assert.rejects(generateJson({ system: 's', prompt: 'p' }), /free AI allowance is used up/);
    assert.equal(calls, 2);
    await assert.rejects(generateJson({ system: 's', prompt: 'p' }), /free AI allowance is used up/);
    assert.equal(calls, 2);
  });

  test('JSON wrapped in prose (Gemma) is still read', async () => {
    process.env.GEMINI_MODELS = 'gemma-x';
    __setGeneratorForTests(async () => 'Sure! Here it is:\n{"a": 1}\nHope that helps.');
    assert.deepEqual(await generateJson({ system: 's', prompt: 'p' }), { a: 1 });
  });
});

describe('automatic AI reviews', () => {
  const upload = (submissionId) => fetch(`${baseUrl}/api/extensions/leetcode/submission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      problemSlug: 'two-sum', submissionId: String(submissionId), title: 'Two Sum', verdict: 'Accepted', language: 'cpp',
      code: `int main() { return ${submissionId}; }`, submittedAt: new Date().toISOString(), leetcodeUsername: 'student1',
      _nonce: crypto.randomBytes(16).toString('hex'), _ts: Date.now(),
    }),
  }).then((r) => r.json());

  test('are off by default: an accepted submission spends no AI', async () => {
    let calls = 0;
    __setGeneratorForTests(async () => { calls += 1; return '{}'; });
    const body = await upload(1);
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(body.aiInvalidated, false);
    assert.equal(calls, 0);
    const p = await Problem.findOne({ user: user._id, platformProblemId: 'two-sum' });
    assert.notEqual(p.aiAnalysisStatus, 'pending');
  });

  test('AI_AUTO_REVIEW=true turns them back on', async () => {
    process.env.AI_AUTO_REVIEW = 'true';
    const body = await upload(2);
    assert.equal(body.aiInvalidated, true);
  });
});
