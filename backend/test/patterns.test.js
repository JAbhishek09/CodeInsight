import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { startDb, stopDb, clearDb, ac, sub } from './helpers.js';
import app from '../app.js';
import Problem from '../models/Problem.js';
import User from '../models/User.js';
import generateToken from '../utils/generateToken.js';
import { PATTERNS, PATTERN_KEYS } from '../data/patterns.js';
import { PROBLEM_PATTERNS } from '../data/problemPatterns.js';

let server;
let baseUrl;
let user;
let token;

const get = async (path) => {
  const res = await fetch(`${baseUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await res.json() };
};
const lc = (slug, fields = {}) =>
  Problem.create({ user: user._id, platform: 'leetcode', platformProblemId: slug, title: slug, difficulty: 'Medium', ...fields });

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

describe('knowledge base data', () => {
  test('every mapped problem points at a real pattern, slugs are unique', () => {
    const slugs = PROBLEM_PATTERNS.map((p) => p.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for (const p of PROBLEM_PATTERNS) {
      assert.ok(PATTERN_KEYS.includes(p.pattern), p.slug);
      if (p.secondary) assert.ok(PATTERN_KEYS.includes(p.secondary), p.slug);
      assert.ok(p.cue && p.complexity, p.slug);
    }
  });

  test('every pattern has teaching content and prerequisites that exist', () => {
    for (const p of PATTERNS) {
      assert.ok(p.explanation && p.template && p.cues.length >= 3 && p.wrongTurns.length >= 2, p.key);
      for (const r of p.requires) assert.ok(PATTERN_KEYS.includes(r), `${p.key} requires ${r}`);
      assert.ok(PROBLEM_PATTERNS.some((x) => x.pattern === p.key), `${p.key} has problems`);
    }
  });
});

describe('GET /api/patterns', () => {
  test('counts solved and attempted mapped problems per pattern, ignoring unmapped ones', async () => {
    await lc('two-sum', { submissions: [ac('2026-10-01')] });                       // prefix-hashing, solved
    await lc('contains-duplicate', { submissions: [sub('2026-10-01', 'Wrong Answer')] }); // prefix-hashing, attempted
    await lc('3sum', { submissions: [sub('2026-10-01', 'TLE'), ac('2026-10-02')] }); // two-pointers, solved
    await lc('some-unmapped-problem', { submissions: [ac('2026-10-01')] });
    await Problem.create({ user: user._id, platform: 'codeforces', platformProblemId: 'two-sum', title: 'cf', difficulty: 'Div2', submissions: [ac('2026-10-01')] });

    const { status, body } = await get('/api/patterns');
    assert.equal(status, 200);
    const by = Object.fromEntries(body.data.patterns.map((p) => [p.key, p]));
    assert.equal(by['prefix-hashing'].solved, 1);
    assert.equal(by['prefix-hashing'].attempted, 1);
    assert.equal(by['two-pointers'].solved, 1);
    assert.equal(by['sliding-window'].solved, 0);
    assert.equal(body.data.totals.solved, 2);
    assert.equal(body.data.totals.problems, PROBLEM_PATTERNS.length);
    assert.equal('explanation' in by['two-pointers'], false, 'list stays light');
  });

  test('requires auth', async () => {
    const res = await fetch(`${baseUrl}/api/patterns`);
    assert.equal(res.status, 401);
  });
});

describe('GET /api/patterns/:key', () => {
  test('returns teaching content and each problem with the student’s status and problem id', async () => {
    const doc = await lc('daily-temperatures', { submissions: [ac('2026-10-01')] });
    const { status, body } = await get('/api/patterns/stack');
    assert.equal(status, 200);
    assert.equal(body.data.name, 'Stack & monotonic stack');
    assert.ok(body.data.cues.length >= 3);
    const dt = body.data.problems.find((p) => p.slug === 'daily-temperatures');
    assert.equal(dt.status, 'solved');
    assert.equal(dt.problemId, String(doc._id));
    const other = body.data.problems.find((p) => p.slug === 'valid-parentheses');
    assert.equal(other.status, 'todo');
    assert.equal(other.problemId, null);
    // secondary mappings appear too (sliding-window-maximum uses a monotonic deque)
    assert.ok(body.data.problems.some((p) => p.slug === 'sliding-window-maximum' && p.primary === false));
    // Easy problems come first
    assert.equal(body.data.problems[0].difficulty, 'Easy');
  });

  test('404 for an unknown pattern', async () => {
    assert.equal((await get('/api/patterns/nope')).status, 404);
  });
});

describe('GET /api/problems/:id pattern field', () => {
  test('mapped LeetCode problems carry their pattern; others get null', async () => {
    const mapped = await lc('number-of-islands');
    const unmapped = await lc('some-unmapped-problem');
    const a = await get(`/api/problems/${mapped._id}`);
    assert.equal(a.body.data.pattern.key, 'bfs-dfs');
    assert.ok(a.body.data.pattern.cue);
    const b = await get(`/api/problems/${unmapped._id}`);
    assert.equal(b.body.data.pattern, null);
  });
});
