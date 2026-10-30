import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  binarySearchSteps, fmt, gridBfsSteps, ordinal, heapTopKSteps, houseRobberSteps, monotonicStackSteps,
  prefixSumSteps, slidingWindowSteps, twoPointerSteps, type Cell, type GridFrame, type HeapFrame,
} from '@/lib/walkthroughs/steps';
import Player from './Player';
import { ArrayView, Bag, Chip, Readout, type Mark, type Pointer } from './parts';

// Inputs match the worked example on each page (see content/workedExamples.ts)
export const EXAMPLES = {
  twoPointers: { nums: [1, 3, 4, 6, 8, 11], target: 10 },
  prefix: { nums: [1, 2, 1, -1, 2], k: 3 },
  window: { s: 'abcabcbb' },
  search: { nums: [1, 3, 5, 7, 9, 11, 13, 15], target: 10 },
  stack: { temps: [73, 74, 75, 71, 69, 72, 76, 73] },
  grid: { grid: [[2, 1, 1], [1, 1, 0], [0, 1, 1]] as Cell[][] },
  heap: { k: 3, initial: [4, 5, 8, 2], adds: [3, 5, 10, 9, 4] },
  dp: { nums: [2, 7, 9, 3, 1] },
};

const Stack = ({ children }: { children: React.ReactNode }) => <div className="flex w-full flex-col items-center gap-5">{children}</div>;

// ── Two pointers ──────────────────────────────────────────────────────────────

function TwoPointers() {
  const { nums, target } = EXAMPLES.twoPointers;
  const frames = useMemo(() => twoPointerSteps(nums, target), [nums, target]);
  return (
    <Player frames={frames} label="Two pointers walkthrough" render={(f) => {
      const marks: Mark[] = nums.map((_, i) => (i < f.l || i > f.r ? 'dim'
        : i === f.l || i === f.r ? (f.verdict === 'match' ? 'good' : 'focus') : 'none'));
      const pointers: Pointer[] = [
        { at: f.l, label: 'L', hint: f.verdict === 'small' ? '→' : undefined },
        { at: f.r, label: 'R', hint: f.verdict === 'big' ? '←' : undefined },
      ];
      const rel = f.verdict === 'big' ? '>' : f.verdict === 'small' ? '<' : '=';
      return (
        <Stack>
          <ArrayView values={nums} marks={marks} pointers={pointers} />
          <Readout>
            {f.sum === null
              ? <>target = {fmt(target)}</>
              : <>{fmt(nums[f.l])} + {fmt(nums[f.r])} = <b>{fmt(f.sum)}</b> {rel} {fmt(target)}</>}
          </Readout>
        </Stack>
      );
    }} />
  );
}

// ── Prefix sums + hash map ────────────────────────────────────────────────────

function PrefixSums() {
  const { nums, k } = EXAMPLES.prefix;
  const frames = useMemo(() => prefixSumSteps(nums, k), [nums, k]);
  return (
    <Player frames={frames} label="Prefix sums and hashing walkthrough" render={(f) => {
      const inFound = (i: number) => f.found.some(([a, b]) => i >= a && i <= b);
      const marks: Mark[] = nums.map((_, i) => (inFound(i) ? 'good' : i === f.i ? 'focus' : i < f.i ? 'in' : 'none'));
      return (
        <Stack>
          <ArrayView label={`nums · k = ${fmt(k)}`} values={nums.map(fmt)} marks={marks}
            pointers={f.i >= 0 && f.i < nums.length ? [{ at: f.i, label: 'i' }] : []} />
          <ArrayView label="running sum" values={f.prefixes.map((p) => (p === null ? null : fmt(p)))} indices={false} small
            marks={f.prefixes.map((p, i) => (p === null ? 'none' : i === f.i ? 'focus' : 'in'))} />
          <div className="grid w-full max-w-md gap-3 sm:grid-cols-[1fr_auto]">
            <Bag label="running sums seen (sum × times)">
              {f.seen.map(([key, n]) => (
                <Chip key={key} tone={f.need !== null && key === f.need ? 'good' : 'none'}>{fmt(key)} <span className="text-muted-foreground">×{n}</span></Chip>
              ))}
            </Bag>
            <Bag label="count">
              <span className="px-2 text-lg font-semibold tabular-nums text-foreground">{f.count}</span>
            </Bag>
          </div>
          {f.need !== null && (
            <Readout>look for {fmt(f.prefix)} − {fmt(k)} = <b>{fmt(f.need)}</b> → {f.hits ? `seen ${f.hits}×` : 'not seen'}</Readout>
          )}
        </Stack>
      );
    }} />
  );
}

// ── Sliding window ────────────────────────────────────────────────────────────

function SlidingWindow() {
  const { s } = EXAMPLES.window;
  const chars = [...s];
  const frames = useMemo(() => slidingWindowSteps(s), [s]);
  return (
    <Player frames={frames} label="Sliding window walkthrough" render={(f) => {
      const empty = f.r < f.l;
      const marks: Mark[] = chars.map((_, i) => (i === f.conflict || i === f.dup ? 'bad'
        : !empty && i >= f.l && i <= f.r ? (i === f.r && f.conflict === null ? 'focus' : 'in') : 'none'));
      const pointers: Pointer[] = empty ? [] : [{ at: f.l, label: 'L', hint: f.conflict !== null ? '→' : undefined }, { at: f.r, label: 'R' }];
      if (f.conflict !== null) pointers.push({ at: f.conflict, label: 'next', muted: true });
      const windowText = empty ? '' : s.slice(f.l, f.r + 1);
      return (
        <Stack>
          <ArrayView values={chars} marks={marks} pointers={pointers} band={empty ? null : [f.l, f.r]} />
          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            <Bag label="in the window">
              {windowText ? [...windowText].map((c, i) => <Chip key={c + i} tone={f.dup !== null && s[f.dup] === c ? 'bad' : 'none'}>{c}</Chip>)
                : <span className="px-1 text-xs text-subtle">empty</span>}
            </Bag>
            <Bag label="best so far">
              <span className="px-1 text-sm font-semibold text-foreground">{f.best}</span>
              {f.bestRange && <Chip tone="good">"{s.slice(f.bestRange[0], f.bestRange[1] + 1)}"</Chip>}
            </Bag>
          </div>
        </Stack>
      );
    }} />
  );
}

// ── Binary search ─────────────────────────────────────────────────────────────

function BinarySearch() {
  const { nums, target } = EXAMPLES.search;
  const frames = useMemo(() => binarySearchSteps(nums, target), [nums, target]);
  return (
    <Player frames={frames} label="Binary search walkthrough" render={(f) => {
      const marks: Mark[] = nums.map((_, i) => (f.verdict === 'done' && i === f.lo ? 'good'
        : i === f.mid ? 'focus' : i < f.lo || i >= f.hi ? 'dim' : 'none'));
      const pointers: Pointer[] = [
        { at: f.lo, label: 'lo' },
        { at: f.hi, label: 'hi', muted: true },
      ];
      if (f.mid !== null) pointers.push({ at: f.mid, label: 'mid' });
      return (
        <Stack>
          <ArrayView label={`find the first value ≥ ${fmt(target)}`} values={nums} marks={marks} pointers={pointers} ghosts={1} />
          <Readout>
            {f.mid === null
              ? (f.verdict === 'done' ? <>answer: index <b>{f.lo}</b></> : <>range [lo, hi) = [{f.lo}, {f.hi})</>)
              : <>nums[{f.mid}] = {fmt(nums[f.mid])} {f.verdict === 'less' ? '<' : '≥'} {fmt(target)}</>}
          </Readout>
        </Stack>
      );
    }} />
  );
}

// ── Monotonic stack ───────────────────────────────────────────────────────────

function MonotonicStack() {
  const { temps } = EXAMPLES.stack;
  const frames = useMemo(() => monotonicStackSteps(temps), [temps]);
  return (
    <Player frames={frames} label="Monotonic stack walkthrough" render={(f) => {
      const onStack = new Set(f.stack);
      const marks: Mark[] = temps.map((_, i) => (f.popped.includes(i) ? 'good' : i === f.i ? 'focus' : onStack.has(i) ? 'in' : 'none'));
      return (
        <div className="flex w-full flex-wrap items-end justify-center gap-6">
          <div className="space-y-4">
            <ArrayView label="temperature" values={temps} marks={marks}
              pointers={f.i >= 0 && f.i < temps.length ? [{ at: f.i, label: 'today' }] : []} />
            <ArrayView label="days to wait" values={f.ans.map((a) => a)} indices={false} small
              marks={f.ans.map((a, i) => (a === null ? 'none' : f.popped.includes(i) ? 'good' : 'in'))} />
          </div>
          <div className="w-32 space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-subtle">waiting · top ↑</p>
            <div className="flex min-h-40 flex-col-reverse justify-start gap-1 rounded-lg border border-border bg-surface-1 p-1.5">
              {f.stack.map((d) => (
                <div key={d} className={cn('flex items-center justify-between rounded-md border px-2 py-1 text-xs tabular-nums transition-colors duration-300',
                  d === f.i ? 'border-[color-mix(in_oklab,var(--pc)_80%,transparent)] bg-[color-mix(in_oklab,var(--pc)_20%,transparent)]' : 'border-border bg-surface-2')}>
                  <span className="font-semibold text-foreground">{temps[d]}°</span>
                  <span className="text-muted-foreground">day {d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }} />
  );
}

// ── Grid BFS ──────────────────────────────────────────────────────────────────

function GridCell({ f, r, c }: { f: GridFrame; r: number; c: number }) {
  const v = f.grid[r][c];
  const fresh = v === 1;
  const isNew = f.newly.some(([a, b]) => a === r && b === c);
  return (
    <div className={cn('flex size-14 flex-col items-center justify-center rounded-lg border text-xs transition-all duration-500 sm:size-16',
      v === 0 && 'border-transparent bg-transparent',
      fresh && 'border-border bg-surface-2',
      v === 2 && !isNew && 'border-[color-mix(in_oklab,var(--pc)_45%,transparent)] bg-[color-mix(in_oklab,var(--pc)_14%,transparent)]',
      v === 2 && isNew && 'border-[color-mix(in_oklab,var(--pc)_90%,transparent)] bg-[color-mix(in_oklab,var(--pc)_30%,transparent)] shadow-[0_0_16px_color-mix(in_oklab,var(--pc)_40%,transparent)]')}
      aria-label={v === 0 ? 'empty' : fresh ? 'fresh orange' : `rotten at minute ${f.rotAt[r][c]}`}>
      {v === 0 ? <span className="text-subtle">·</span>
        : fresh ? <><span className="size-4 rounded-full border-2 border-warning bg-warning/20" aria-hidden /><span className="mt-1 text-[10px] text-muted-foreground">fresh</span></>
        : <><span className="text-base font-semibold tabular-nums text-foreground">{f.rotAt[r][c]}</span><span className="text-[10px] text-muted-foreground">min</span></>}
    </div>
  );
}

function GridBfs() {
  const { grid } = EXAMPLES.grid;
  const frames = useMemo(() => gridBfsSteps(grid), [grid]);
  return (
    <Player frames={frames} label="Grid BFS walkthrough" render={(f) => (
      <div className="flex w-full flex-wrap items-center justify-center gap-6">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${grid[0].length}, auto)` }}>
          {f.grid.map((row, r) => row.map((_, c) => <GridCell key={`${r}-${c}`} f={f} r={r} c={c} />))}
        </div>
        <div className="space-y-3">
          <Bag label="minute">
            <span className="px-2 text-2xl font-semibold tabular-nums text-foreground">{f.minute}</span>
          </Bag>
          <Bag label={f.done ? 'queue (empty)' : 'queue for next minute'}>
            {f.done || !f.newly.length ? <span className="px-1 text-xs text-subtle">—</span>
              : f.newly.map(([r, c]) => <Chip key={`${r}${c}`} tone="focus">({r},{c})</Chip>)}
          </Bag>
          <Bag label="fresh left">
            <span className="px-2 text-sm font-semibold tabular-nums text-foreground">{f.fresh}</span>
          </Bag>
        </div>
      </div>
    )} />
  );
}

// ── Heap: k-th largest ────────────────────────────────────────────────────────

/** The kept numbers drawn as a min-heap (a sorted array is a valid heap). */
function HeapTree({ f, k }: { f: HeapFrame; k: number }) {
  const slots = Array.from({ length: k }, (_, i) => f.heap[i] ?? null);
  // Complete binary tree positions for up to 7 nodes, as % of the box
  const pos = (i: number) => {
    const level = Math.floor(Math.log2(i + 1));
    const first = 2 ** level - 1;
    const count = 2 ** level;
    return { x: ((i - first + 0.5) / count) * 100, y: 18 + level * 42 };
  };
  return (
    <div className="relative h-36 w-52">
      <svg className="absolute inset-0 size-full" aria-hidden>
        {slots.map((_, i) => {
          if (i === 0) return null;
          const a = pos(Math.floor((i - 1) / 2));
          const b = pos(i);
          return <line key={i} x1={`${a.x}%`} y1={`${a.y}%`} x2={`${b.x}%`} y2={`${b.y}%`} stroke="var(--border-strong)" strokeWidth="1" />;
        })}
      </svg>
      {slots.map((v, i) => {
        const p = pos(i);
        const top = i === 0 && v !== null;
        return (
          <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
            <div className={cn('flex size-11 items-center justify-center rounded-full border text-sm font-semibold tabular-nums transition-all duration-300',
              v === null ? 'border-border bg-transparent text-subtle'
                : top ? 'border-[color-mix(in_oklab,var(--pc)_85%,transparent)] bg-[color-mix(in_oklab,var(--pc)_24%,transparent)] text-foreground'
                : 'border-border bg-surface-2 text-foreground')}>
              {v === null ? '·' : fmt(v)}
            </div>
          </div>
        );
      })}
      <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-full whitespace-nowrap text-[10px] font-medium text-muted-foreground">top = {ordinal(k)} largest</span>
    </div>
  );
}

function HeapTopK() {
  const { k, initial, adds } = EXAMPLES.heap;
  const frames = useMemo(() => heapTopKSteps(k, initial, adds), [k, initial, adds]);
  return (
    <Player frames={frames} label="Heap top-k walkthrough" render={(f) => {
      const marks: Mark[] = f.stream.map((_, i) => (i === f.i ? (f.action === 'skip' ? 'dim' : 'focus') : i < f.i ? 'in' : 'none'));
      return (
        <div className="flex w-full flex-wrap items-center justify-center gap-6">
          <div className="space-y-3">
            <ArrayView label={`stream · first ${f.startCount} given, then add()`} values={f.stream} marks={marks}
              pointers={f.i >= 0 && f.i < f.stream.length ? [{ at: f.i, label: 'now' }] : []} />
            <Bag label="add() returned">
              {f.outputs.length ? f.outputs.map((o, n) => <Chip key={n} tone={n === f.outputs.length - 1 && f.i >= f.startCount && f.i < f.stream.length ? 'focus' : 'none'}>{fmt(o)}</Chip>)
                : <span className="px-1 text-xs text-subtle">—</span>}
            </Bag>
          </div>
          <div className="flex flex-col items-center gap-2 pt-4">
            <HeapTree f={f} k={k} />
            <p className="h-4 text-xs text-muted-foreground">{f.removed !== null ? <>out: <span className="line-through">{fmt(f.removed)}</span></> : f.action === 'skip' ? 'ignored' : ''}</p>
          </div>
        </div>
      );
    }} />
  );
}

// ── 1-D DP ────────────────────────────────────────────────────────────────────

function HouseRobber() {
  const { nums } = EXAMPLES.dp;
  const frames = useMemo(() => houseRobberSteps(nums), [nums]);
  return (
    <Player frames={frames} label="Dynamic programming walkthrough" render={(f) => {
      const deciding = f.i >= 0 && f.i < nums.length;
      const houseMarks: Mark[] = nums.map((_, i) => (f.taken ? (f.taken.includes(i) ? 'good' : 'dim') : i === f.i ? 'focus' : 'none'));
      const bestMarks: Mark[] = f.best.map((b, i) => (b === null ? 'none'
        : f.taken ? (i === nums.length - 1 ? 'good' : 'in')
        : i === f.i ? 'focus' : 'in'));
      const pointers: Pointer[] = [];
      if (deciding && f.i >= 1) pointers.push({ at: f.i - 1, label: 'skip', muted: f.choice !== 'skip' });
      if (deciding && f.i >= 2) pointers.push({ at: f.i - 2, label: 'take +', muted: f.choice !== 'take' });
      if (deciding) pointers.push({ at: f.i, label: 'i' });
      return (
        <Stack>
          <ArrayView label="money in each house" values={nums} marks={houseMarks} />
          <ArrayView label="best[i]" values={f.best} marks={bestMarks} pointers={pointers} indices={false} />
          <Readout>
            {deciding && f.skip !== null && f.take !== null
              ? <>skip → {fmt(f.skip)} · take → {fmt(f.take)} ⇒ <b>{f.choice}</b></>
              : f.taken ? <>houses {f.taken.join(', ')} → <b>{fmt(f.best[nums.length - 1] as number)}</b></> : <>best[i] = max(skip, take)</>}
          </Readout>
        </Stack>
      );
    }} />
  );
}

/** The animated walkthrough for each pattern (keys match the knowledge base). */
export const WALKTHROUGHS: Record<string, { problem: string; View: () => React.ReactElement }> = {
  'two-pointers': { problem: 'Two Sum II', View: TwoPointers },
  'prefix-hashing': { problem: 'Subarray Sum Equals K', View: PrefixSums },
  'sliding-window': { problem: 'Longest Substring Without Repeating Characters', View: SlidingWindow },
  'binary-search': { problem: 'Search Insert Position', View: BinarySearch },
  stack: { problem: 'Daily Temperatures', View: MonotonicStack },
  'bfs-dfs': { problem: 'Rotting Oranges', View: GridBfs },
  'heap-top-k': { problem: 'Kth Largest Element in a Stream', View: HeapTopK },
  'dp-1d': { problem: 'House Robber', View: HouseRobber },
};
