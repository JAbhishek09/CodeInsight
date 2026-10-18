import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb } from './helpers.js';
import app from '../app.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import Prediction from '../models/Prediction.js';
import generateToken from '../utils/generateToken.js';
import { PROBLEM_PATTERNS } from '../data/problemPatterns.js';
import { PROBLEM_PROMPTS } from '../data/problemPrompts.js';
import { PATTERNS } from '../data/patterns.js';

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
const guess = (slug, predicted) => call('POST', '/api/predictions', { slug, predicted, source: 'drill' });

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

describe('drill prompts', () => {
  test('every mapped problem has a prompt, and no prompt names a pattern', () => {
    const giveaways = /two pointers?|sliding window|binary search|\bstack\b|\bheap\b|priority queue|\bbfs\b|\bdfs\b|dynamic programming|prefix sum|hash ?map/i;
    for (const m of PROBLEM_PATTERNS) {
      assert.ok(PROBLEM_PROMPTS[m.slug], `missing prompt: ${m.slug}`);
      assert.doesNotMatch(PROBLEM_PROMPTS[m.slug], giveaways, m.slug);
    }
  });
});

describe('GET /api/practice/drill', () => {
  test('a mixed deck of 10 hides titles and patterns and caps each pattern', async () => {
    const { status, body } = await call('GET', '/api/practice/drill');
    assert.equal(status, 200);
    const { cards, options } = body.data;
    assert.equal(cards.length, 10);
    assert.equal(options.length, PATTERNS.length);
    for (const c of cards) {
      assert.deepEqual(Object.keys(c).sort(), ['difficulty', 'missedBefore', 'prompt', 'slug']);
    }
    const counts = {};
    for (const c of cards) {
      const p = PROBLEM_PATTERNS.find((m) => m.slug === c.slug).pattern;
      counts[p] = (counts[p] ?? 0) + 1;
    }
    assert.ok(Math.max(...Object.values(counts)) <= 4);
  });

  test('a missed guess comes back next deck; one guessed right today does not', async () => {
    await guess('coin-change', 'two-pointers');
    await guess('two-sum', 'prefix-hashing');
    const { body } = await call('GET', '/api/practice/drill');
    const missed = body.data.cards.find((c) => c.slug === 'coin-change');
    assert.ok(missed && missed.missedBefore);
    assert.ok(!body.data.cards.some((c) => c.slug === 'two-sum'));
  });

  test('a single-pattern deck stays in that pattern; unknown patterns are rejected', async () => {
    const { body } = await call('GET', '/api/practice/drill?pattern=stack');
    assert.equal(body.data.pattern.key, 'stack');
    const stack = new Set(PROBLEM_PATTERNS.filter((m) => m.pattern === 'stack').map((m) => m.slug));
    assert.ok(body.data.cards.length > 0 && body.data.cards.every((c) => stack.has(c.slug)));
    assert.equal((await call('GET', '/api/practice/drill?pattern=nope')).status, 400);
  });
});

describe('drill answers', () => {
  test('reveal the problem, count toward accuracy, and never queue a re-solve', async () => {
    const { status, body } = await guess('house-robber', 'sliding-window');
    assert.equal(status, 201);
    const f = body.data.feedback;
    assert.equal(f.outcome, 'missed');
    assert.equal(f.problem.title, 'House Robber');
    assert.equal(f.pattern.key, 'dp-1d');
    assert.equal(await Review.countDocuments({ user: user._id }), 0);

    const stats = (await call('GET', '/api/predictions/stats')).body.data;
    assert.equal(stats.attempts, 1);

    const latest = (await call('GET', '/api/predictions/latest?slug=house-robber')).body.data;
    assert.equal(latest, null, 'drills don’t show up as the problem page’s feedback');
    assert.equal(await Prediction.countDocuments({ source: 'drill' }), 1);
  });
});
