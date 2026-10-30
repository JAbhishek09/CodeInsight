import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { startDb, stopDb, clearDb, ac, sub } from './helpers.js';
import app from '../app.js';
import Problem from '../models/Problem.js';
import User from '../models/User.js';
import Review from '../models/Review.js';
import generateToken from '../utils/generateToken.js';
import { chooseFocus } from '../services/practiceService.js';
import { completeReview, scheduleReview, seedReviewsFromHistory } from '../services/reviewService.js';

let server;
let baseUrl;
let user;
let token;
const DAY = 24 * 60 * 60 * 1000;

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
const upload = (slug, submissionId, verdict) => call('POST', '/api/extensions/leetcode/submission', {
  problemSlug: slug, submissionId: String(submissionId), title: slug, verdict, language: 'cpp',
  code: 'int main() { return 0; }', submittedAt: new Date().toISOString(), leetcodeUsername: 'student1',
  _nonce: crypto.randomBytes(16).toString('hex'), _ts: Date.now(),
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

describe('review scheduling', () => {
  test('“got it” stretches the interval, “struggled” brings it back in 2 days, long intervals retire', async () => {
    const r = await scheduleReview(user._id, 'two-sum', 'manual', Date.now());
    let x = await completeReview(user._id, r._id, 'easy');
    assert.equal(x.intervalDays, 3);
    x = await completeReview(user._id, r._id, 'easy');
    assert.equal(x.intervalDays, 8);
    x = await completeReview(user._id, r._id, 'hard');
    assert.equal(x.intervalDays, 2);
    assert.ok(Math.abs(x.dueAt - Date.now() - 2 * DAY) < 5000);
    x.intervalDays = 30; await x.save();
    x = await completeReview(user._id, r._id, 'easy');
    assert.equal(x.done, true);
  });

  test('only mapped problems are queued; scheduling again never pushes a due date later', async () => {
    assert.equal(await scheduleReview(user._id, 'not-mapped', 'manual', Date.now()), null);
    await scheduleReview(user._id, 'two-sum', 'manual', Date.now() + 5 * DAY);
    await scheduleReview(user._id, 'two-sum', 'manual', Date.now() + 10 * DAY);
    const r = await Review.findOne({ user: user._id, slug: 'two-sum' });
    assert.ok(r.dueAt - Date.now() < 6 * DAY);
  });

  test('a missed guess queues a recognition review in 2 days', async () => {
    await call('POST', '/api/predictions', { slug: 'coin-change', predicted: 'heap-top-k', source: 'app' });
    const r = await Review.findOne({ user: user._id, slug: 'coin-change' });
    assert.equal(r.reason, 'recognition');
    assert.ok(Math.abs(r.dueAt - Date.now() - 2 * DAY) < 5000);
  });

  test('a correct guess does not queue anything', async () => {
    await call('POST', '/api/predictions', { slug: 'coin-change', predicted: 'dp-1d', source: 'app' });
    assert.equal(await Review.countDocuments({ user: user._id }), 0);
  });

  test('accepting after 4 tries (via the extension) queues a struggle review a week later; re-solving later doesn’t', async () => {
    for (const [i, v] of ['Wrong Answer', 'TLE', 'Wrong Answer'].entries()) await upload('house-robber', 300 + i, v);
    await upload('house-robber', 303, 'Accepted');
    const r = await Review.findOne({ user: user._id, slug: 'house-robber' });
    assert.equal(r.reason, 'struggle');
    assert.ok(r.dueAt - Date.now() > 6 * DAY);
    await Review.updateOne({ _id: r._id }, { $set: { done: true } });
    await upload('house-robber', 304, 'Accepted');
    assert.equal((await Review.findById(r._id)).done, true, 'second accept is not a new struggle');
  });

  test('history seeding spreads overdue struggles one per day and runs only once', async () => {
    const old = (d) => new Date(Date.now() - d * DAY).toISOString();
    for (const slug of ['house-robber', 'climbing-stairs', 'coin-change']) {
      await lc(slug, [sub(old(40), 'Wrong Answer'), sub(old(40), 'TLE'), sub(old(40), 'RE'), ac(old(39))]);
    }
    await lc('two-sum', [ac(old(30))]); // clean, not seeded
    const now = new Date();
    assert.equal(await seedReviewsFromHistory(user._id, now), 3);
    const dues = (await Review.find({ user: user._id }).sort({ dueAt: 1 })).map((r) => r.dueAt.getTime());
    assert.equal(new Set(dues).size, 3);
    assert.equal(dues[1] - dues[0], DAY);
    assert.equal(await seedReviewsFromHistory(user._id, now), 0);
  });
});

describe('focus pattern', () => {
  const pat = (key, level, requires, solved, attempted, total) => ({ key, name: key, level, requires, solved, attempted, total });

  test('picks the least-solved ready pattern, skipping mastered and locked ones', () => {
    const f = chooseFocus([
      pat('a', 1, [], 9, 0, 10),        // mastered
      pat('b', 1, [], 2, 1, 10),        // weak
      pat('c', 2, ['x'], 0, 0, 10),     // locked (x not started / missing)
      pat('d', 2, ['a'], 5, 0, 10),
    ]);
    assert.equal(f.key, 'b');
  });

  test('poor recognition can make a mostly-solved pattern the focus', () => {
    const f = chooseFocus(
      [pat('a', 1, [], 8, 0, 10), pat('b', 1, [], 4, 0, 10)],
      new Map([['a', { attempts: 5, accuracy: 0 }]])
    );
    assert.equal(f.key, 'a');
  });
});

describe('GET /api/practice/today', () => {
  test('due reviews first, then a retry, then new problems in the focus pattern; done today listed', async () => {
    await lc('two-sum', [ac(new Date().toISOString())]);                        // solved today (prefix-hashing)
    await lc('valid-parentheses', [sub('2026-10-01', 'Wrong Answer')]);          // attempted (stack)
    await scheduleReview(user._id, 'binary-search', 'recognition', Date.now() - DAY);

    const { status, body } = await call('GET', '/api/practice/today?tz=UTC');
    assert.equal(status, 200);
    const d = body.data;
    assert.equal(d.plan[0].kind, 'review');
    assert.equal(d.plan[0].slug, 'binary-search');
    assert.ok(d.plan[0].reviewId);
    assert.ok(d.plan.some((p) => p.kind === 'retry' && p.slug === 'valid-parentheses'));
    const fresh = d.plan.filter((p) => p.kind === 'new');
    assert.ok(fresh.length >= 1);
    assert.ok(fresh.every((p) => p.slug !== 'two-sum'), 'never suggests solved problems as new');
    assert.equal(d.plan.length, 4);
    assert.ok(d.focus && d.focus.key);
    assert.equal(fresh[0].pattern.key, d.focus.key, 'new problems come from the focus pattern');
    assert.equal(fresh[0].difficulty, 'Easy', 'easiest first');
    assert.deepEqual(d.doneToday.map((x) => x.slug), ['two-sum']);
    assert.equal(d.reviews.due, 1);
  });

  test('POST /reviews/:id reschedules and the review leaves today’s plan', async () => {
    const r = await scheduleReview(user._id, 'binary-search', 'recognition', Date.now() - DAY);
    const res = await call('POST', `/api/practice/reviews/${r._id}`, { result: 'easy' });
    assert.equal(res.status, 200);
    const { body } = await call('GET', '/api/practice/today');
    assert.ok(!body.data.plan.some((p) => p.kind === 'review'));
    assert.equal((await call('POST', `/api/practice/reviews/${r._id}`, { result: 'meh' })).status, 400);
  });

  test('bad tz is rejected', async () => {
    assert.equal((await call('GET', '/api/practice/today?tz=Not/AZone')).status, 400);
  });
});

describe('daily goal and streak on Home', () => {
  test('match the Analytics numbers: first solves today vs target, and the solving streak', async () => {
    await User.updateOne({ _id: user._id }, { targetDailySolved: 3 });
    const now = Date.now();
    const daysAgo = (d, h = 0) => new Date(now - d * DAY - h * 3600e3).toISOString();
    await lc('two-sum', [ac(daysAgo(0))]);                                    // first solve today
    await lc('valid-anagram', [sub(daysAgo(0), 'Wrong Answer'), ac(daysAgo(0))]); // first solve today
    await lc('house-robber', [ac(daysAgo(1))]);                               // yesterday
    await lc('climbing-stairs', [ac(daysAgo(2)), ac(daysAgo(0))]);            // re-solved today: streak day, not a new solve
    await lc('coin-change', [sub(daysAgo(0), 'TLE')]);                       // attempted only

    const home = (await call('GET', '/api/practice/today?tz=UTC')).body.data;
    assert.equal(home.goal.solved, 2);
    assert.equal(home.goal.target, 3);
    assert.equal(home.goal.remaining, 1);
    assert.equal(home.goal.goalMet, false);
    assert.equal(home.streak.current, 3);
    assert.equal(home.streak.activeToday, true);

    const summary = (await call('GET', '/api/analytics/summary?tz=UTC')).body.data;
    assert.deepEqual(home.goal, summary.today);
    assert.deepEqual(home.streak, summary.streak);
  });

  test('a streak that ended yesterday is still alive until today is over', async () => {
    const now = Date.now();
    await lc('two-sum', [ac(new Date(now - DAY).toISOString())]);
    await lc('house-robber', [ac(new Date(now - 2 * DAY).toISOString())]);
    const { streak, goal } = (await call('GET', '/api/practice/today?tz=UTC')).body.data;
    assert.equal(streak.current, 2);
    assert.equal(streak.activeToday, false);
    assert.equal(goal.solved, 0);
    assert.equal(goal.target, 1, 'default target');
  });
});
