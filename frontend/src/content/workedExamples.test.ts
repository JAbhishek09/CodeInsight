// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WORKED_EXAMPLES } from './workedExamples.ts';
// The knowledge base lives in the backend; plain JS, so it loads directly
// @ts-ignore — no type declarations for the backend's JS modules
import { PATTERNS } from '../../../backend/data/patterns.js';
// @ts-ignore
import { problemPatternBySlug } from '../../../backend/data/problemPatterns.js';

test('one worked example per pattern, on a problem mapped to that pattern', () => {
  const keys = (PATTERNS as { key: string }[]).map((p) => p.key).sort();
  assert.deepEqual(Object.keys(WORKED_EXAMPLES).sort(), keys);
  for (const [key, ex] of Object.entries(WORKED_EXAMPLES)) {
    const m = (problemPatternBySlug as Map<string, { pattern: string; title: string; difficulty: string }>).get(ex.slug);
    assert.ok(m, `${ex.slug} is in the knowledge base`);
    assert.equal(m.pattern, key, `${ex.slug} is a ${key} problem`);
    assert.equal(m.title, ex.title);
    assert.equal(m.difficulty, ex.difficulty);
  }
});

test('every clue appears word for word in its statement, without overlapping another', () => {
  for (const [key, ex] of Object.entries(WORKED_EXAMPLES)) {
    const ranges = ex.clues.map((c) => {
      const at = ex.statement.indexOf(c.quote);
      assert.ok(at >= 0, `${key}: "${c.quote}" is in the statement`);
      return [at, at + c.quote.length] as const;
    }).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ranges.length; i++) assert.ok(ranges[i][0] >= ranges[i - 1][1], `${key}: clues overlap`);
    assert.ok(ex.steps.length >= 3 && ex.code.includes('\n'));
  }
});
