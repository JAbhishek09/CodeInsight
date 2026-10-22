/**
 * steps.ts — step-by-step traces of each pattern's core move, for the
 * animated walkthroughs on the pattern guide pages.
 *
 * Every function runs the real algorithm on an input and records a frame per
 * decision, with a caption that explains it. The frames are computed, never
 * hand-written, so a caption can't disagree with what the algorithm does
 * (steps.test.ts checks the answers against brute force).
 *
 * No imports on purpose: the tests run this file directly under Node.
 */

/** Typographic minus for negative numbers. */
export const fmt = (n: number) => (n < 0 ? `−${-n}` : String(n));
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** 1st, 2nd, 3rd, 4th, 11th… */
export const ordinal = (n: number) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : Math.min(n % 10, 4) % 4]}`;

// ── Two pointers: pair with a target sum in a sorted array ──────────────────

export interface TwoPointerFrame {
  l: number;
  r: number;
  sum: number | null;
  verdict: 'start' | 'big' | 'small' | 'match' | 'none';
  caption: string;
}

export function twoPointerSteps(nums: number[], target: number): TwoPointerFrame[] {
  const frames: TwoPointerFrame[] = [];
  let l = 0;
  let r = nums.length - 1;
  frames.push({
    l, r, sum: null, verdict: 'start',
    caption: `The array is sorted, so put L on the smallest number and R on the largest. We want two numbers that add up to ${fmt(target)}.`,
  });
  let checks = 0;
  while (l < r) {
    const sum = nums[l] + nums[r];
    checks += 1;
    if (sum === target) {
      frames.push({
        l, r, sum, verdict: 'match',
        caption: `${fmt(nums[l])} + ${fmt(nums[r])} = ${fmt(sum)}. Found after ${plural(checks, 'check')}: each one moves a pointer inward, so it's O(n). Trying every pair would be O(n²).`,
      });
      return frames;
    }
    if (sum > target) {
      frames.push({
        l, r, sum, verdict: 'big',
        caption: `${fmt(nums[l])} + ${fmt(nums[r])} = ${fmt(sum)}, more than ${fmt(target)}. Every other partner for ${fmt(nums[r])} is even bigger, so ${fmt(nums[r])} can't be in the pair: move R left.`,
      });
      r -= 1;
    } else {
      frames.push({
        l, r, sum, verdict: 'small',
        caption: `${fmt(nums[l])} + ${fmt(nums[r])} = ${fmt(sum)}, less than ${fmt(target)}. Every other partner for ${fmt(nums[l])} is even smaller, so ${fmt(nums[l])} can't be in the pair: move L right.`,
      });
      l += 1;
    }
  }
  frames.push({ l, r, sum: null, verdict: 'none', caption: 'The pointers met without a match: no two numbers add up to the target.' });
  return frames;
}

// ── Prefix sums + hash map: count subarrays that sum to k ───────────────────

export interface PrefixFrame {
  /** Index just added; −1 before the first number, nums.length at the end. */
  i: number;
  prefix: number;
  need: number | null;
  hits: number;
  count: number;
  /** The map (running sum → times seen) as used for this step's lookup. */
  seen: [number, number][];
  /** Subarrays [start, end] that end at i and sum to k. */
  found: [number, number][];
  /** Running sum after each index so far. */
  prefixes: (number | null)[];
  caption: string;
}

export function prefixSumSteps(nums: number[], k: number): PrefixFrame[] {
  const frames: PrefixFrame[] = [];
  const seen = new Map<number, number>([[0, 1]]);
  const prefixes: number[] = [];
  const entries = () => [...seen.entries()].sort((a, b) => a[0] - b[0]);
  const pad = (list: number[]) => nums.map((_, j) => list[j] ?? null);
  frames.push({
    i: -1, prefix: 0, need: null, hits: 0, count: 0, seen: entries(), found: [], prefixes: pad([]),
    caption: 'Keep a running sum, and a map of how many times each running sum has appeared. It starts with 0 seen once — the empty start.',
  });

  let sum = 0;
  let count = 0;
  nums.forEach((x, i) => {
    sum += x;
    const need = sum - k;
    const hits = seen.get(need) ?? 0;
    const found: [number, number][] = [];
    if (need === 0) found.push([0, i]);
    prefixes.forEach((p, j) => { if (p === need) found.push([j + 1, i]); });
    found.sort((a, b) => a[0] - b[0]);
    count += hits;
    const shown = (a: number, b: number) => `[${nums.slice(a, b + 1).map(fmt).join(', ')}]`;
    const drop = x < 0 ? ` The ${fmt(x)} made the sum drop — a sliding window can't cope with that; the map can.` : '';
    const caption = hits === 0
      ? `Add ${fmt(x)}: running sum ${fmt(sum)}. A subarray ending here adds up to ${fmt(k)} only if an earlier running sum was ${fmt(sum)} − ${fmt(k)} = ${fmt(need)}. It isn't in the map. Store ${fmt(sum)}.${drop}`
      : `Add ${fmt(x)}: running sum ${fmt(sum)}. ${fmt(need)} was seen ${hits === 1 ? 'once' : `${hits} times`}, so ${plural(hits, 'subarray')} ending here add${hits === 1 ? 's' : ''} up to ${fmt(k)}: ${found.map(([a, b]) => shown(a, b)).join(' and ')}. Count = ${count}. Store ${fmt(sum)}.${drop}`;
    frames.push({ i, prefix: sum, need, hits, count, seen: entries(), found, prefixes: pad([...prefixes, sum]), caption });
    prefixes.push(sum);
    seen.set(sum, (seen.get(sum) ?? 0) + 1);
  });

  frames.push({
    i: nums.length, prefix: sum, need: null, hits: 0, count, seen: entries(), found: [], prefixes: pad(prefixes),
    caption: `${plural(count, 'subarray')} add${count === 1 ? 's' : ''} up to ${fmt(k)}, found in one pass: O(n) time, plus O(n) space for the map.`,
  });
  return frames;
}

// ── Sliding window: longest substring without repeats ────────────────────────

export interface WindowFrame {
  l: number;
  /** Right edge (inclusive); r < l means the window is empty. */
  r: number;
  /** Index of the incoming character that repeats, and its copy inside the window. */
  conflict: number | null;
  dup: number | null;
  best: number;
  bestRange: [number, number] | null;
  caption: string;
}

export function slidingWindowSteps(s: string): WindowFrame[] {
  const frames: WindowFrame[] = [];
  const inWindow = new Set<string>();
  let l = 0;
  let best = 0;
  let bestRange: [number, number] | null = null;
  frames.push({
    l: 0, r: -1, conflict: null, dup: null, best, bestRange,
    caption: 'Grow a window over the string from the left. Its rule: no character twice inside it.',
  });
  for (let r = 0; r < s.length; r++) {
    const c = s[r];
    if (inWindow.has(c)) {
      const dup = s.lastIndexOf(c, r - 1);
      frames.push({
        l, r: r - 1, conflict: r, dup, best, bestRange,
        caption: `'${c}' is already in the window. Move the left edge right until the earlier '${c}' is out.`,
      });
      while (inWindow.has(c)) {
        inWindow.delete(s[l]);
        l += 1;
      }
    }
    inWindow.add(c);
    const len = r - l + 1;
    const improved = len > best;
    if (improved) { best = len; bestRange = [l, r]; }
    frames.push({
      l, r, conflict: null, dup: null, best, bestRange,
      caption: improved
        ? `Add '${c}': "${s.slice(l, r + 1)}" has no repeats. Length ${len} — a new best.`
        : `Add '${c}': "${s.slice(l, r + 1)}", length ${len}. The best is still ${best}.`,
    });
  }
  const [a, b] = bestRange ?? [0, -1];
  frames.push({
    l, r: s.length - 1, conflict: null, dup: null, best, bestRange,
    caption: `Longest window without a repeat: "${s.slice(a, b + 1)}", length ${best}. Each character enters once and leaves at most once: O(n).`,
  });
  return frames;
}

// ── Binary search: first position with a value ≥ target ─────────────────────

export interface SearchFrame {
  lo: number;
  hi: number;
  mid: number | null;
  verdict: 'start' | 'less' | 'atLeast' | 'done';
  caption: string;
}

export function binarySearchSteps(nums: number[], target: number): SearchFrame[] {
  const frames: SearchFrame[] = [];
  let lo = 0;
  let hi = nums.length;
  frames.push({
    lo, hi, mid: null, verdict: 'start',
    caption: `Find the first position whose value is ≥ ${fmt(target)}. The answer is somewhere in [lo, hi) = [0, ${hi}).`,
  });
  let checks = 0;
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    checks += 1;
    if (nums[mid] < target) {
      frames.push({
        lo, hi, mid, verdict: 'less',
        caption: `Middle is index ${mid}: ${fmt(nums[mid])} < ${fmt(target)}, so the answer is to its right. Drop the left half: lo = ${mid + 1}.`,
      });
      lo = mid + 1;
    } else {
      frames.push({
        lo, hi, mid, verdict: 'atLeast',
        caption: `Middle is index ${mid}: ${fmt(nums[mid])} ≥ ${fmt(target)}, so it could be the answer — but something earlier might be too. Drop the right half: hi = ${mid}.`,
      });
      hi = mid;
    }
  }
  const at = lo < nums.length && nums[lo] === target;
  frames.push({
    lo, hi, mid: null, verdict: 'done',
    caption: (at
      ? `lo = hi = ${lo}: ${fmt(target)} is at index ${lo}.`
      : `lo = hi = ${lo}: ${fmt(target)} isn't in the array; it would go at index ${lo}${lo < nums.length ? `, just before ${fmt(nums[lo])}` : ', at the end'}.`)
      + ` ${plural(checks, 'check')} for ${nums.length} numbers: O(log n).`,
  });
  return frames;
}

// ── Monotonic stack: days until a warmer day ─────────────────────────────────

export interface StackFrame {
  /** Day just processed; −1 before the first, t.length at the end. */
  i: number;
  /** Waiting days after this step, bottom → top. */
  stack: number[];
  /** Days whose wait ended at this step. */
  popped: number[];
  ans: (number | null)[];
  caption: string;
}

export function monotonicStackSteps(t: number[]): StackFrame[] {
  const frames: StackFrame[] = [];
  const stack: number[] = [];
  const ans: (number | null)[] = t.map(() => null);
  frames.push({
    i: -1, stack: [], popped: [], ans: [...ans],
    caption: 'Walk through the days. A stack holds the days still waiting for a warmer one; the coldest waiting day is on top.',
  });
  t.forEach((temp, i) => {
    const popped: number[] = [];
    while (stack.length && temp > t[stack[stack.length - 1]]) {
      const j = stack.pop()!;
      ans[j] = i - j;
      popped.push(j);
    }
    const top = stack[stack.length - 1];
    let caption: string;
    if (popped.length) {
      const list = popped.map((j) => `${t[j]}° (day ${j} waited ${plural(i - j, 'day')})`).join(', ');
      caption = `${temp}° is warmer than ${list}. Pop ${popped.length === 1 ? 'it' : 'them'}.`
        + (top !== undefined ? ` ${t[top]}° is not colder, so it keeps waiting.` : '')
        + ` Push day ${i}.`;
    } else if (top !== undefined) {
      caption = `${temp}° is not warmer than ${t[top]}° on top, so nothing is resolved. Push day ${i}; it waits too.`;
    } else {
      caption = `Nothing is waiting. Push day ${i} (${temp}°).`;
    }
    stack.push(i);
    frames.push({ i, stack: [...stack], popped, ans: [...ans], caption });
  });
  const left = [...stack];
  const final = ans.map((a) => a ?? 0);
  frames.push({
    i: t.length, stack: left, popped: [], ans: final,
    caption: (left.length
      ? `Days still on the stack (${left.map((j) => `day ${j}`).join(', ')}) never see a warmer day: their answer is 0.`
      : 'Every day found a warmer one.')
      + ' Each day is pushed once and popped at most once: O(n).',
  });
  return frames;
}

// ── BFS on a grid: rotting oranges, one level per minute ────────────────────

export type Cell = 0 | 1 | 2; // empty, fresh, rotten

export interface GridFrame {
  minute: number;
  grid: Cell[][];
  /** Minute each orange rotted (null if fresh or empty). */
  rotAt: (number | null)[][];
  /** Cells that rotted in this step. */
  newly: [number, number][];
  fresh: number;
  done: boolean;
  /** Minutes until nothing is fresh, or −1 (set on the last frame). */
  answer: number | null;
  caption: string;
}

export function gridBfsSteps(start: Cell[][]): GridFrame[] {
  const frames: GridFrame[] = [];
  const grid = start.map((row) => [...row]) as Cell[][];
  const rotAt: (number | null)[][] = grid.map((row) => row.map((c) => (c === 2 ? 0 : null)));
  let queue: [number, number][] = [];
  let fresh = 0;
  grid.forEach((row, r) => row.forEach((c, col) => {
    if (c === 2) queue.push([r, col]);
    else if (c === 1) fresh += 1;
  }));
  const snap = () => ({ grid: grid.map((row) => [...row]) as Cell[][], rotAt: rotAt.map((row) => [...row]) });
  frames.push({
    minute: 0, ...snap(), newly: [...queue], fresh, done: false, answer: null,
    caption: `Minute 0: ${plural(queue.length, 'rotten orange')} go${queue.length === 1 ? 'es' : ''} into the queue together. ${plural(fresh, 'fresh orange')} to reach.`,
  });

  let minute = 0;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length && fresh > 0) {
    minute += 1;
    const next: [number, number][] = [];
    for (const [r, c] of queue) {
      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;
        if (grid[nr]?.[nc] !== 1) continue;
        grid[nr][nc] = 2;
        rotAt[nr][nc] = minute;
        fresh -= 1;
        next.push([nr, nc]);
      }
    }
    if (!next.length) { minute -= 1; break; }
    frames.push({
      minute, ...snap(), newly: next, fresh, done: false, answer: null,
      caption: `Minute ${minute}: ${plural(next.length, 'orange')} next to the rotten ones rot at the same time — one BFS level. ${fresh ? `${plural(fresh, 'fresh orange')} left.` : 'None left.'}`,
    });
    queue = next;
  }
  const answer = fresh === 0 ? minute : -1;
  frames.push({
    minute, ...snap(), newly: [], fresh, done: true, answer,
    caption: fresh === 0
      ? `No fresh oranges left after ${plural(minute, 'minute')} — the number of BFS levels. Each cell is visited once: O(rows × cols).`
      : `${plural(fresh, 'fresh orange')} can never be reached from a rotten one, so the answer is −1.`,
  });
  return frames;
}

// ── Heap: k-th largest in a stream ───────────────────────────────────────────

export interface HeapFrame {
  stream: number[];
  /** Numbers given up front (the rest arrive through add()). */
  startCount: number;
  /** Index in the stream just handled; −1 before, stream.length at the end. */
  i: number;
  /** The kept numbers, smallest first (the heap's top is heap[0]). */
  heap: number[];
  action: 'start' | 'push' | 'replace' | 'skip' | 'done';
  removed: number | null;
  /** The k-th largest so far, once k numbers are kept. */
  kth: number | null;
  /** What each add() returned so far. */
  outputs: number[];
  caption: string;
}

export function heapTopKSteps(k: number, initial: number[], adds: number[]): HeapFrame[] {
  const frames: HeapFrame[] = [];
  const stream = [...initial, ...adds];
  let heap: number[] = [];
  const outputs: number[] = [];
  frames.push({
    stream, startCount: initial.length, i: -1, heap: [], action: 'start', removed: null, kth: null, outputs: [],
    caption: `Keep only the ${k} largest numbers seen so far, in a min-heap. The smallest of those ${k} sits on top — that is the ${ordinal(k)} largest.`,
  });
  stream.forEach((x, i) => {
    const isAdd = i >= initial.length;
    const who = isAdd ? `add(${fmt(x)})` : `${fmt(x)}`;
    let action: HeapFrame['action'];
    let removed: number | null = null;
    let caption: string;
    if (heap.length < k) {
      heap = [...heap, x].sort((a, b) => a - b);
      action = 'push';
      caption = `${who}: the heap has room (${heap.length}/${k}), so keep it.`;
    } else if (x > heap[0]) {
      removed = heap[0];
      heap = [...heap.slice(1), x].sort((a, b) => a - b);
      action = 'replace';
      caption = `${who}: bigger than ${fmt(removed)} on top, so ${fmt(removed)} drops out of the top ${k} and ${fmt(x)} goes in.`;
    } else {
      action = 'skip';
      caption = `${who}: not bigger than ${fmt(heap[0])} on top, so it can't be in the top ${k}. Ignore it.`;
    }
    const kth = heap.length === k ? heap[0] : null;
    if (isAdd) {
      outputs.push(kth as number);
      caption += ` It returns ${kth === null ? 'nothing yet' : fmt(kth)}, the ${ordinal(k)} largest so far.`;
    }
    frames.push({ stream, startCount: initial.length, i, heap: [...heap], action, removed, kth, outputs: [...outputs], caption });
  });
  frames.push({
    stream, startCount: initial.length, i: stream.length, heap: [...heap], action: 'done', removed: null,
    kth: heap.length === k ? heap[0] : null, outputs: [...outputs],
    caption: `Each number costs at most one O(log k) heap update, and memory stays at ${k} numbers however long the stream gets.`,
  });
  return frames;
}

// ── 1-D DP: house robber ─────────────────────────────────────────────────────

export interface DpFrame {
  /** House just decided; −1 before, nums.length at the end. */
  i: number;
  best: (number | null)[];
  skip: number | null;
  take: number | null;
  choice: 'take' | 'skip' | null;
  /** Houses in the best plan (last frame only). */
  taken: number[] | null;
  caption: string;
}

export function houseRobberSteps(nums: number[]): DpFrame[] {
  const frames: DpFrame[] = [];
  const best: (number | null)[] = nums.map(() => null);
  frames.push({
    i: -1, best: [...best], skip: null, take: null, choice: null, taken: null,
    caption: 'best[i] = the most you can take from houses 0 to i. For each house: skip it (keep best[i−1]) or take it (best[i−2] + its money).',
  });
  nums.forEach((x, i) => {
    const skip = i >= 1 ? (best[i - 1] as number) : 0;
    const take = (i >= 2 ? (best[i - 2] as number) : 0) + x;
    const choice: 'take' | 'skip' = take > skip ? 'take' : 'skip';
    best[i] = Math.max(skip, take);
    let caption: string;
    if (i === 0) caption = `House 0 is the only one so far: take its ${fmt(x)}. best[0] = ${fmt(best[0] as number)}.`;
    else if (i === 1) caption = `House 1: skip it (keep ${fmt(skip)}) or take it (${fmt(x)}, but then not house 0). ${choice === 'take' ? 'Take' : 'Skip'} it: best[1] = ${fmt(best[1] as number)}.`;
    else caption = `House ${i}: skip it → best[${i - 1}] = ${fmt(skip)}; take it → best[${i - 2}] + ${fmt(x)} = ${fmt(take)}. ${choice === 'take' ? 'Take' : 'Skip'} it: best[${i}] = ${fmt(best[i] as number)}.`;
    frames.push({ i, best: [...best], skip, take, choice, taken: null, caption });
  });

  // Walk back through the table to recover which houses were taken
  const taken: number[] = [];
  for (let i = nums.length - 1; i >= 0;) {
    const prev = i >= 1 ? (best[i - 1] as number) : 0;
    if ((best[i] as number) !== prev && (best[i] as number) > 0) { taken.unshift(i); i -= 2; } else i -= 1;
  }
  const total = nums.length ? (best[nums.length - 1] as number) : 0;
  frames.push({
    i: nums.length, best: [...best], skip: null, take: null, choice: null, taken,
    caption: `The answer is best[${nums.length - 1}] = ${fmt(total)}: houses ${taken.join(', ')} (${taken.map((h) => fmt(nums[h])).join(' + ')}). Each value comes from the two before it: O(n) time, and keeping just those two makes it O(1) space.`,
  });
  return frames;
}
