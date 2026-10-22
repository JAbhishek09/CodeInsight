// Run with: npm test (node --test, TypeScript runs natively on Node 22.18+).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  binarySearchSteps, gridBfsSteps, heapTopKSteps, houseRobberSteps, monotonicStackSteps,
  prefixSumSteps, slidingWindowSteps, twoPointerSteps, type Cell,
} from './steps.ts';

// Small deterministic random inputs, so each trace is checked beyond the guide's example
let seed = 42;
const rnd = (lo: number, hi: number) => {
  seed = (seed * 16807) % 2147483647;
  return lo + (seed % (hi - lo + 1));
};
const randArray = (n: number, lo: number, hi: number) => Array.from({ length: n }, () => rnd(lo, hi));
const last = <T>(xs: T[]) => xs[xs.length - 1];

describe('two pointers', () => {
  test('guide example: finds 4 + 6 = 10 after five checks', () => {
    const f = twoPointerSteps([1, 3, 4, 6, 8, 11], 10);
    const end = last(f);
    assert.equal(end.verdict, 'match');
    assert.deepEqual([end.l, end.r], [2, 3]);
    assert.equal(f.filter((x) => x.verdict !== 'start').length, 5);
    assert.ok(f.some((x) => x.verdict === 'big') && f.some((x) => x.verdict === 'small'), 'shows both moves');
  });

  test('pointers only move inward and the answer matches brute force', () => {
    for (let run = 0; run < 200; run++) {
      const nums = randArray(rnd(2, 9), -10, 20).sort((a, b) => a - b);
      const target = rnd(-15, 35);
      const f = twoPointerSteps(nums, target);
      for (let i = 1; i < f.length; i++) {
        assert.ok(f[i].l >= f[i - 1].l && f[i].r <= f[i - 1].r);
      }
      const brute = nums.some((a, i) => nums.some((b, j) => i < j && a + b === target));
      const end = last(f);
      assert.equal(end.verdict === 'match', brute, `${nums} → ${target}`);
      if (end.verdict === 'match') assert.equal(nums[end.l] + nums[end.r], target);
    }
  });
});

describe('prefix sums + hash map', () => {
  test('guide example: 3 subarrays of [1, 2, 1, −1, 2] add up to 3', () => {
    const f = prefixSumSteps([1, 2, 1, -1, 2], 3);
    assert.equal(last(f).count, 3);
    assert.deepEqual(f.flatMap((x) => x.found), [[0, 1], [1, 2], [0, 3]]);
    assert.ok(f.some((x) => x.caption.includes('sliding window')), 'explains why a window fails on negatives');
  });

  test('count and highlighted subarrays match brute force', () => {
    for (let run = 0; run < 200; run++) {
      const nums = randArray(rnd(1, 9), -4, 6);
      const k = rnd(-3, 8);
      const f = prefixSumSteps(nums, k);
      const brute: [number, number][] = [];
      for (let a = 0; a < nums.length; a++) {
        let s = 0;
        for (let b = a; b < nums.length; b++) { s += nums[b]; if (s === k) brute.push([a, b]); }
      }
      assert.equal(last(f).count, brute.length, `${nums} k=${k}`);
      for (const fr of f) {
        assert.equal(fr.found.length, fr.hits);
        for (const [a, b] of fr.found) assert.equal(nums.slice(a, b + 1).reduce((x, y) => x + y, 0), k);
      }
    }
  });
});

describe('sliding window', () => {
  test('guide example: "abcabcbb" → "abc", length 3', () => {
    const f = slidingWindowSteps('abcabcbb');
    assert.equal(last(f).best, 3);
    assert.deepEqual(last(f).bestRange, [0, 2]);
    assert.ok(f.some((x) => x.conflict !== null));
  });

  test('every window is repeat-free, edges only move right, best matches brute force', () => {
    for (let run = 0; run < 200; run++) {
      const s = Array.from({ length: rnd(0, 10) }, () => 'abcd'[rnd(0, 3)]).join('');
      const f = slidingWindowSteps(s);
      let prevL = 0;
      for (const fr of f) {
        const w = s.slice(fr.l, fr.r + 1);
        assert.equal(new Set(w).size, w.length, `window "${w}" in "${s}"`);
        assert.ok(fr.l >= prevL);
        prevL = fr.l;
        if (fr.conflict !== null) assert.equal(s[fr.dup as number], s[fr.conflict]);
      }
      let brute = 0;
      for (let a = 0; a < s.length; a++) for (let b = a; b < s.length; b++) {
        const w = s.slice(a, b + 1);
        if (new Set(w).size === w.length) brute = Math.max(brute, w.length);
      }
      assert.equal(last(f).best, brute, s);
    }
  });
});

describe('binary search', () => {
  test('guide example: 10 would go at index 5 after three checks', () => {
    const f = binarySearchSteps([1, 3, 5, 7, 9, 11, 13, 15], 10);
    assert.equal(last(f).lo, 5);
    assert.equal(f.filter((x) => x.mid !== null).length, 3);
  });

  test('the range always shrinks and lands on the first value ≥ target', () => {
    for (let run = 0; run < 200; run++) {
      const nums = [...new Set(randArray(rnd(0, 12), 0, 30))].sort((a, b) => a - b);
      const target = rnd(-2, 32);
      const f = binarySearchSteps(nums, target);
      for (let i = 1; i < f.length - 1; i++) assert.ok(f[i + 1].hi - f[i + 1].lo < f[i].hi - f[i].lo);
      const brute = nums.findIndex((x) => x >= target);
      assert.equal(last(f).lo, brute === -1 ? nums.length : brute, `${nums} → ${target}`);
      assert.ok(f.length - 2 <= Math.ceil(Math.log2(nums.length + 1)), 'O(log n) checks');
    }
  });
});

describe('monotonic stack', () => {
  test('guide example: daily temperatures', () => {
    const f = monotonicStackSteps([73, 74, 75, 71, 69, 72, 76, 73]);
    assert.deepEqual(last(f).ans, [1, 1, 4, 2, 1, 1, 0, 0]);
  });

  test('stack temperatures never rise toward the top; answers match brute force', () => {
    for (let run = 0; run < 200; run++) {
      const t = randArray(rnd(1, 10), 60, 75);
      const f = monotonicStackSteps(t);
      for (const fr of f) {
        for (let i = 1; i < fr.stack.length; i++) assert.ok(t[fr.stack[i]] <= t[fr.stack[i - 1]]);
      }
      const brute = t.map((x, i) => { const j = t.findIndex((y, jj) => jj > i && y > x); return j === -1 ? 0 : j - i; });
      assert.deepEqual(last(f).ans, brute, String(t));
    }
  });
});

describe('grid BFS', () => {
  test('guide example: rotting oranges takes 4 minutes, one frame per minute', () => {
    const f = gridBfsSteps([[2, 1, 1], [1, 1, 0], [0, 1, 1]]);
    assert.equal(last(f).answer, 4);
    assert.deepEqual(f.filter((x) => !x.done).map((x) => x.minute), [0, 1, 2, 3, 4]);
    assert.deepEqual(last(f).rotAt, [[0, 1, 2], [1, 2, null], [null, 3, 4]]);
  });

  test('unreachable oranges give −1; minutes match a brute-force flood', () => {
    assert.equal(last(gridBfsSteps([[2, 1, 1], [0, 1, 1], [1, 0, 1]])).answer, -1);
    assert.equal(last(gridBfsSteps([[0, 2]])).answer, 0);
    for (let run = 0; run < 150; run++) {
      const rows = rnd(1, 4);
      const cols = rnd(1, 4);
      const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => [0, 1, 1, 2][rnd(0, 3)] as Cell));
      // Brute force: re-scan the whole grid each minute
      const g = grid.map((r) => [...r]);
      let minutes = 0;
      for (;;) {
        const rot: [number, number][] = [];
        g.forEach((row, r) => row.forEach((c, cc) => {
          if (c === 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dr, dc]) => g[r + dr]?.[cc + dc] === 2)) rot.push([r, cc]);
        }));
        if (!rot.length) break;
        rot.forEach(([r, c]) => { g[r][c] = 2; });
        minutes += 1;
      }
      const expected = g.some((row) => row.includes(1)) ? -1 : minutes;
      assert.equal(last(gridBfsSteps(grid)).answer, expected, JSON.stringify(grid));
    }
  });
});

describe('heap top-k', () => {
  test('guide example: KthLargest(3, [4, 5, 8, 2]) then add 3, 5, 10, 9, 4', () => {
    const f = heapTopKSteps(3, [4, 5, 8, 2], [3, 5, 10, 9, 4]);
    assert.deepEqual(last(f).outputs, [4, 5, 5, 8, 8]);
    assert.ok(f.some((x) => x.action === 'skip') && f.some((x) => x.action === 'replace'));
  });

  test('keeps at most k numbers and returns the k-th largest each time', () => {
    for (let run = 0; run < 200; run++) {
      const k = rnd(1, 4);
      const initial = randArray(rnd(k, k + 3), 0, 20);
      const adds = randArray(rnd(1, 6), 0, 20);
      const f = heapTopKSteps(k, initial, adds);
      for (const fr of f) assert.ok(fr.heap.length <= k);
      const brute = adds.map((_, i) => [...initial, ...adds.slice(0, i + 1)].sort((a, b) => b - a)[k - 1]);
      assert.deepEqual(last(f).outputs, brute);
    }
  });
});

describe('1-D DP', () => {
  test('guide example: [2, 7, 9, 3, 1] → 12 from houses 0, 2, 4', () => {
    const f = houseRobberSteps([2, 7, 9, 3, 1]);
    assert.deepEqual(last(f).best, [2, 7, 11, 11, 12]);
    assert.deepEqual(last(f).taken, [0, 2, 4]);
  });

  test('matches brute force over every take/skip choice; the plan is valid', () => {
    for (let run = 0; run < 200; run++) {
      const nums = randArray(rnd(1, 10), 0, 15);
      const f = houseRobberSteps(nums);
      let brute = 0;
      for (let mask = 0; mask < 1 << nums.length; mask++) {
        if (mask & (mask >> 1)) continue; // two neighbours
        let s = 0;
        nums.forEach((x, i) => { if (mask & (1 << i)) s += x; });
        brute = Math.max(brute, s);
      }
      const end = last(f);
      assert.equal(end.best[nums.length - 1], brute, String(nums));
      const taken = end.taken as number[];
      for (let i = 1; i < taken.length; i++) assert.ok(taken[i] - taken[i - 1] >= 2);
      assert.equal(taken.reduce((s, i) => s + nums[i], 0), brute);
    }
  });
});
