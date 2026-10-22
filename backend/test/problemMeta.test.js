import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb, ac } from './helpers.js';
import app from '../app.js';
import User from '../models/User.js';
import Problem from '../models/Problem.js';
import generateToken from '../utils/generateToken.js';
import {
  __setMetaFetcherForTests, countMissingMeta, fillMissingMeta, fillMissingMetaSoon, isFillingMeta,
} from '../services/problemMetaService.js';

let server;
let baseUrl;
let user;
let token;

// What LeetCode would answer (null: no such problem); slugs left out get no answer (blocked, network)
const LEETCODE = {
  'two-sum': { title: 'Two Sum', difficulty: 'Easy', tags: ['Array', 'Hash Table'] },
  'trapping-rain-water': { title: 'Trapping Rain Water', difficulty: 'Hard', tags: ['Array', 'Two Pointers', 'Stack'] },
  'tagless-problem': { title: 'Tagless', difficulty: 'Medium', tags: [] },
  'deleted-problem': null,
};
let asked;
const fakeLeetCode = async (slugs) => {
  asked.push(...slugs);
  return new Map(slugs.filter((s) => s in LEETCODE).map((s) => [s, LEETCODE[s]]));
};

const problem = (slug, fields = {}) => Problem.create({
  user: user._id, platform: 'leetcode', platformProblemId: slug, title: slug, submissions: [ac('2026-10-10T10:00:00Z')], ...fields,
});
const tagsOf = async (slug) => (await Problem.findOne({ platformProblemId: slug }).lean()).tags;
const summary = async () => (await (await fetch(`${baseUrl}/api/analytics/summary?tz=UTC`, {
  headers: { Authorization: `Bearer ${token}` },
})).json()).data;

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
  asked = [];
  __setMetaFetcherForTests(fakeLeetCode);
  user = await User.create({ name: 'S', email: 's@example.com', password: 'secret123' });
  token = generateToken(user._id.toString());
});

describe('filling LeetCode tags and difficulty', () => {
  test('problems without tags get them, with the real difficulty; others are left alone', async () => {
    await problem('two-sum');                               // e.g. created by the extension: 'Medium' by default
    await problem('trapping-rain-water', { difficulty: 'Medium' });
    await problem('valid-anagram', { tags: ['String'], difficulty: 'Easy' });
    await Problem.create({ user: user._id, platform: 'codeforces', platformProblemId: '1A', title: 'CF', tags: [] });

    assert.equal(await countMissingMeta(user._id), 2);
    assert.equal(await fillMissingMeta(user._id), 2);
    assert.deepEqual(asked.sort(), ['trapping-rain-water', 'two-sum']);

    const twoSum = await Problem.findOne({ platformProblemId: 'two-sum' }).lean();
    assert.deepEqual(twoSum.tags, ['Array', 'Hash Table']);
    assert.equal(twoSum.difficulty, 'Easy');
    assert.equal((await Problem.findOne({ platformProblemId: 'trapping-rain-water' }).lean()).difficulty, 'Hard');
    assert.deepEqual(await tagsOf('valid-anagram'), ['String']);
    assert.equal(await countMissingMeta(user._id), 0);
  });

  test('a problem LeetCode has no tags for isn’t asked about again; an unanswered one is', async () => {
    await problem('tagless-problem');
    await problem('deleted-problem');
    await problem('not-answered');

    assert.equal(await fillMissingMeta(user._id), 0);
    assert.equal(await countMissingMeta(user._id), 1, 'only the unanswered one is still missing');

    asked = [];
    await fillMissingMeta(user._id);
    assert.deepEqual(asked, ['not-answered']);

    // A week later, the answered ones are checked again
    asked = [];
    await fillMissingMeta(user._id, { now: Date.now() + 8 * 24 * 60 * 60 * 1000 });
    assert.deepEqual(asked.sort(), ['deleted-problem', 'not-answered', 'tagless-problem']);
  });

  test('the background fill runs at most every 10 minutes per student', async () => {
    await problem('two-sum');
    assert.equal(fillMissingMetaSoon(user._id), true);
    assert.equal(isFillingMeta(user._id), true);
    assert.equal(fillMissingMetaSoon(user._id), false);
    while (isFillingMeta(user._id)) await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(await tagsOf('two-sum'), ['Array', 'Hash Table']);
    assert.equal(fillMissingMetaSoon(user._id), false, 'cooling down');
  });
});

describe('GET /api/analytics/summary topics', () => {
  test('starts the fill and says so; the next look has the topics', async () => {
    await problem('two-sum');
    await problem('trapping-rain-water');

    const first = await summary();
    assert.equal(first.topicsLoading, true);
    assert.deepEqual(first.topics, []);

    while (isFillingMeta(user._id)) await new Promise((r) => setTimeout(r, 10));
    const second = await summary();
    assert.equal(second.topicsLoading, false);
    assert.deepEqual(second.topics.map((t) => [t.tag, t.total]), [['Array', 2], ['Hash Table', 1], ['Stack', 1], ['Two Pointers', 1]]);
    assert.equal(second.byDifficulty.Hard.total, 1);
  });

  test('nothing to fetch, or nothing LeetCode would answer: not loading', async () => {
    await problem('valid-anagram', { tags: ['String'] });
    assert.equal((await summary()).topicsLoading, false);

    await problem('not-answered');
    assert.equal((await summary()).topicsLoading, true);
    while (isFillingMeta(user._id)) await new Promise((r) => setTimeout(r, 10));
    assert.equal((await summary()).topicsLoading, false, 'tried recently; the page shows what it has');
  });
});
