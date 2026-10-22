// Run with: npm test
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTimeline, duration, laterLabel, shortGap, verdictKind, SITTING_GAP_MS } from './attempts.ts';

const MIN = 60_000;
const t0 = Date.parse('2026-10-01T10:00:00Z');
const sub = (id: string, minutesAfter: number, verdict: string, code = 'x') =>
  ({ _id: id, submittedAt: new Date(t0 + minutesAfter * MIN).toISOString(), verdict, code });

describe('formatting', () => {
  test('short gaps and durations', () => {
    assert.equal(shortGap(45_000), '+45s');
    assert.equal(shortGap(4 * MIN), '+4m');
    assert.equal(shortGap(130 * MIN), '+2h');
    assert.equal(shortGap(3 * 24 * 60 * MIN), '+3d');
    assert.equal(duration(40_000), '40 sec');
    assert.equal(duration(38 * MIN), '38 min');
    assert.equal(duration(125 * MIN), '2 h 5 min');
    assert.equal(duration(120 * MIN), '2 h');
    assert.equal(duration(3 * 24 * 60 * MIN), '3 days');
  });

  test('later labels', () => {
    assert.equal(laterLabel(3 * 60 * MIN), '3 hours later');
    assert.equal(laterLabel(24 * 60 * MIN), '1 day later');
    assert.equal(laterLabel(15 * 24 * 60 * MIN), '2 weeks later');
    assert.equal(laterLabel(90 * 24 * 60 * MIN), '3 months later');
  });

  test('verdict kinds', () => {
    assert.equal(verdictKind('Accepted'), 'ok');
    assert.equal(verdictKind('Wrong Answer'), 'wrong');
    assert.equal(verdictKind('MLE'), 'slow');
    assert.equal(verdictKind('CE'), 'crash');
    assert.equal(verdictKind('Pending'), 'pending');
  });
});

describe('the story of a problem', () => {
  test('accepted after a few tries, then re-solved weeks later', () => {
    const tl = buildTimeline([
      // given newest first, as the API sorts them
      sub('e', 21 * 24 * 60, 'Accepted'),
      sub('d', 38, 'Accepted'),
      sub('c', 30, 'TLE'),
      sub('b', 12, 'Wrong Answer'),
      sub('a', 0, 'Wrong Answer'),
    ]);
    assert.deepEqual(tl.attempts.map((a) => a.id), ['a', 'b', 'c', 'd', 'e']);
    assert.equal(tl.firstAcceptedIndex, 3);
    assert.equal(tl.summary, 'Accepted on try 4, 38 min after your first try.');
    assert.equal(tl.detail, 'Before that: 2 wrong answers and 1 time or memory limit. Re-solved once since.');
    assert.deepEqual(tl.attempts.map((a) => a.gap), [null, '+12m', '+18m', '+8m', null]);
    assert.equal(tl.attempts[4].breakMs, 21 * 24 * 60 * MIN - 38 * MIN);
    assert.equal(tl.attempts.filter((a) => a.firstAccepted).length, 1);
  });

  test('first-try accept, unsolved, and empty', () => {
    assert.equal(buildTimeline([sub('a', 0, 'Accepted')]).summary, 'Accepted on the first try.');
    assert.equal(buildTimeline([sub('a', 0, 'Accepted')]).detail, null);
    const unsolved = buildTimeline([sub('a', 0, 'Wrong Answer'), sub('b', 5, 'RE'), sub('c', 9, 'Wrong Answer')]);
    assert.equal(unsolved.summary, 'Not accepted yet — 3 tries so far.');
    assert.equal(unsolved.detail, '2 wrong answers and 1 runtime or compile error');
    assert.equal(buildTimeline([]).summary, 'No attempts recorded yet.');
  });

  test('tries after the first accept that all failed are called out', () => {
    const tl = buildTimeline([sub('a', 0, 'Accepted'), sub('b', 3 * 24 * 60, 'Wrong Answer')]);
    assert.equal(tl.detail, '1 more try since, none accepted.');
  });

  test('a new sitting starts after more than two hours', () => {
    const tl = buildTimeline([sub('a', 0, 'Wrong Answer'), sub('b', 119, 'Wrong Answer'), sub('c', 119 + 121, 'Accepted')]);
    assert.deepEqual(tl.attempts.map((a) => a.breakMs !== null), [false, false, true]);
    assert.ok(SITTING_GAP_MS === 120 * MIN);
    assert.equal(tl.attempts[1].gap, '+2h');
  });

  test('attempts without code are marked', () => {
    const tl = buildTimeline([sub('a', 0, 'Wrong Answer', ''), sub('b', 5, 'Accepted')]);
    assert.deepEqual(tl.attempts.map((a) => a.hasCode), [false, true]);
  });
});
