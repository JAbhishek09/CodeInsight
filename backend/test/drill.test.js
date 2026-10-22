import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb } from './helpers.js';
import app from '../app.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import Prediction from '../models/Prediction.js';
import generateToken from '../utils/generateToken.js';
import { PROBLEM_PATTERNS } from '../data/problemPatterns.js';
import { PROBLEM_PROMPTS, PROMPT_CLUES } from '../data/problemPrompts.js';
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
const guess = (slug, predicted, hinted) => call('POST', '/api/predictions', { slug, predicted, source: 'drill', hinted });

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
  const giveaways = /two pointers?|sliding window|binary search|\bstack\b|\bheap\b|priority queue|\bbfs\b|\bdfs\b|dynamic programming|prefix sum|hash ?map/i;

  test('every mapped problem has a prompt, and no prompt names a pattern', () => {
    for (const m of PROBLEM_PATTERNS) {
      assert.ok(PROBLEM_PROMPTS[m.slug], `missing prompt: ${m.slug}`);
      assert.doesNotMatch(PROBLEM_PROMPTS[m.slug], giveaways, m.slug);
    }
  });

  test('every prompt has hint words, copied from it, that point without naming a pattern', () => {
    for (const m of PROBLEM_PATTERNS) {
      const prompt = PROBLEM_PROMPTS[m.slug];
      const clues = PROMPT_CLUES[m.slug];
      assert.ok(clues?.length >= 1 && clues.length <= 3, `clues: ${m.slug}`);
      for (const c of clues) {
        assert.ok(prompt.includes(c), `${m.slug}: "${c}" isn't in the prompt`);
        assert.doesNotMatch(c, giveaways, m.slug);
      }
      // A hint narrows the prompt down; it doesn't repeat it
      assert.ok(clues.join('').length < prompt.length * 0.7, `${m.slug}: the clues cover too much of the prompt`);
    }
    assert.deepEqual(Object.keys(PROMPT_CLUES).filter((slug) => !PROBLEM_PROMPTS[slug]), []);
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
      assert.deepEqual(Object.keys(c).sort(), ['clues', 'difficulty', 'hintedBefore', 'missedBefore', 'prompt', 'slug']);
      assert.deepEqual(c.clues, PROMPT_CLUES[c.slug]);
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

describe('drill hints', () => {
  test('a right answer after the hint is half credit everywhere, and the card comes back', async () => {
    const hinted = await guess('house-robber', 'dp-1d', true);
    assert.equal(hinted.status, 201);
    assert.equal(hinted.body.data.feedback.isCorrect, true);
    assert.equal(hinted.body.data.feedback.hinted, true);
    await guess('climbing-stairs', 'dp-1d');

    const stats = (await call('GET', '/api/predictions/stats')).body.data;
    assert.equal(stats.attempts, 2);
    assert.equal(stats.correct, 1.5);
    assert.equal(stats.perPattern.find((p) => p.key === 'dp-1d').accuracy, 0.75);

    const week = (await call('GET', '/api/predictions/weekly?tz=UTC&weeks=1')).body.data.at(-1);
    assert.equal(week.correct, 1.5);
    assert.equal(week.firstTry.correct, 1.5);

    const report = (await call('GET', '/api/analytics/patterns')).body.data;
    assert.equal(report.patterns.find((p) => p.key === 'dp-1d').recognition.correct, 1.5);
    const row = report.matrix.rows.indexOf('dp-1d');
    assert.equal(report.matrix.counts[row][report.matrix.columns.indexOf('dp-1d')], 2, 'still a right guess on the mix-up grid');

    const deck = (await call('GET', '/api/practice/drill?pattern=dp-1d')).body.data;
    const again = deck.cards.find((c) => c.slug === 'house-robber');
    assert.ok(again?.hintedBefore && !again.missedBefore, 'needed the hint, so it comes back');
    assert.ok(!deck.cards.some((c) => c.slug === 'climbing-stairs'), 'spotted unaided today, so it rests');
  });

  test('only drills keep the hint flag, and it must be true or false', async () => {
    const app = await call('POST', '/api/predictions', { slug: 'two-sum', predicted: 'prefix-hashing', source: 'app', hinted: true });
    assert.equal(app.status, 201);
    assert.equal(app.body.data.feedback.hinted, false);
    assert.equal((await call('GET', '/api/predictions/stats')).body.data.correct, 1);
    assert.equal((await guess('two-sum', 'prefix-hashing', 'yes')).status, 400);
  });
});

describe('daily drill streak', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const today = () => new Date().toISOString().slice(0, 10);
  const answered = (daysAgo, n, source = 'drill') => Prediction.insertMany(Array.from({ length: n }, () => ({
    user: user._id, slug: 'two-sum', source, predicted: 'prefix-hashing', actual: 'prefix-hashing', isCorrect: true,
    resolvedAt: new Date(Date.now() - daysAgo * DAY),
  })));
  const streak = async (query = '?tz=UTC') => (await call('GET', `/api/practice/drill/streak${query}`)).body.data;

  test('a day counts once 10 cards are answered, and the streak lasts until today ends', async () => {
    await answered(4, 10);
    await answered(3, 3); // not enough: breaks the run
    await answered(2, 12);
    await answered(1, 10);
    await answered(0, 4);

    let s = await streak();
    assert.equal(s.target, 10);
    assert.deepEqual(s.today, { date: today(), cards: 4, done: false });
    assert.equal(s.streak.current, 2, 'yesterday’s run is still alive');
    assert.equal(s.streak.activeToday, false);

    await answered(0, 6);
    s = await streak();
    assert.equal(s.today.done, true);
    assert.equal(s.streak.current, 3);
    assert.equal(s.streak.longest, 3);
    assert.equal(s.streak.activeToday, true);
  });

  test('only drill answers count, and the time zone must be real', async () => {
    await answered(0, 10, 'app');
    const s = await streak('');
    assert.equal(s.today.cards, 0);
    assert.equal(s.streak.current, 0);
    assert.equal((await call('GET', '/api/practice/drill/streak?tz=Mars/Olympus')).status, 400);
  });
});
