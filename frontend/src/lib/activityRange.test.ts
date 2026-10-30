// Run with: npm test
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buckets, firstActiveDay, fitRange, sumByBucket, weekStart } from './activityRange.ts';

const TODAY = '2026-10-22'; // a Thursday

describe('fitting the range to the history', () => {
  test('nothing in the last year: no range', () => {
    assert.equal(fitRange(null, TODAY), null);
    assert.equal(firstActiveDay([{ date: '2026-10-01', count: 0 }]), null);
  });

  test('a few days in: day by day, at least two weeks', () => {
    const r = fitRange('2026-10-19', TODAY)!;
    assert.deepEqual(r, { grain: 'day', from: '2026-10-09', to: TODAY, heatmapWeeks: 13 });
    assert.equal(buckets(r).length, 14);
    // A month in: every day since the first
    assert.equal(fitRange('2026-09-22', TODAY)!.from, '2026-09-22');
    assert.equal(fitRange('2026-09-22', TODAY)!.grain, 'day');
  });

  test('up to 26 weeks: week by week from the first active week, at least six', () => {
    const r = fitRange('2026-09-10', TODAY)!;
    assert.equal(r.grain, 'week');
    assert.equal(r.from, '2026-09-07'); // the Monday of that week
    assert.equal(buckets(r).length, 7);
    assert.equal(fitRange('2026-09-20', TODAY)!.from, '2026-09-14', 'six weeks back from this week');
    assert.equal(fitRange('2026-05-01', TODAY)!.grain, 'week');
    assert.equal(fitRange('2026-05-01', TODAY)!.heatmapWeeks, 26);
  });

  test('longer: month by month from the first active month, at most twelve', () => {
    const r = fitRange('2026-03-15', TODAY)!;
    assert.deepEqual([r.grain, r.from], ['month', '2026-03-01']);
    assert.deepEqual(buckets(r).map((b) => b.key), ['2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    const year = fitRange('2025-10-23', TODAY)!;
    assert.deepEqual([year.from, buckets(year).length, year.heatmapWeeks], ['2025-11-01', 12, 53]);
  });

  test('first active day across series', () => {
    const solved = [{ date: '2026-10-01', count: 0 }, { date: '2026-10-05', count: 1 }];
    const subs = [{ date: '2026-10-01', count: 0 }, { date: '2026-10-03', count: 2 }];
    assert.equal(firstActiveDay(solved, subs), '2026-10-03');
  });
});

describe('buckets', () => {
  test('weeks start on Monday and months end on their last day', () => {
    assert.equal(weekStart('2026-10-22'), '2026-10-19');
    assert.equal(weekStart('2026-10-19'), '2026-10-19');
    assert.equal(weekStart('2026-10-18'), '2026-10-12');
    const feb = buckets({ grain: 'month', from: '2028-02-01', to: '2028-03-05', heatmapWeeks: 13 });
    assert.deepEqual(feb.map((b) => [b.start, b.end]), [['2028-02-01', '2028-02-29'], ['2028-03-01', '2028-03-31']]);
  });

  test('day rows add up into their bucket; rows outside the range are ignored', () => {
    const range = fitRange('2026-09-10', TODAY)!; // weeks from 2026-09-07
    const rows = [
      { date: '2026-09-01', count: 5 }, // before the range
      { date: '2026-09-07', count: 1 },
      { date: '2026-09-13', count: 2 },
      { date: '2026-09-14', count: 4 },
      { date: TODAY, count: 3 },
    ];
    const sums = sumByBucket(rows, range, () => ({ n: 0 }), (v, r) => { v.n += r.count; });
    assert.deepEqual(sums.map((b) => [b.key, b.value.n]), [
      ['2026-09-07', 3], ['2026-09-14', 4], ['2026-09-21', 0], ['2026-09-28', 0], ['2026-10-05', 0], ['2026-10-12', 0], ['2026-10-19', 3],
    ]);
    assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  });
});
