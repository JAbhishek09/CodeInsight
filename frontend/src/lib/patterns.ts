import type { CSSProperties } from 'react';

export type PatternKey =
  | 'two-pointers' | 'prefix-hashing' | 'sliding-window' | 'binary-search'
  | 'stack' | 'bfs-dfs' | 'heap-top-k' | 'dp-1d';

/** Inline style that sets --pc to the pattern's colour, for the .pat-* classes. */
export function patternStyle(key: string): CSSProperties {
  return { ['--pc' as string]: `var(--pat-${key}, var(--primary))` } as CSSProperties;
}

/** Mastery state of a pattern from solved/total on its mapped problems. */
export function masteryOf(solved: number, attempted: number, total: number): 'mastered' | 'learning' | 'new' {
  if (total > 0 && solved / total >= 0.7) return 'mastered';
  if (solved + attempted > 0) return 'learning';
  return 'new';
}

/** The patterns a student can guess. Keep in sync with backend/data/patterns.js. */
export const PATTERN_OPTIONS: { key: PatternKey; name: string }[] = [
  { key: 'two-pointers', name: 'Two pointers' },
  { key: 'prefix-hashing', name: 'Prefix sums & hashing' },
  { key: 'sliding-window', name: 'Sliding window' },
  { key: 'binary-search', name: 'Binary search' },
  { key: 'stack', name: 'Stack & monotonic stack' },
  { key: 'bfs-dfs', name: 'Graph & grid BFS/DFS' },
  { key: 'heap-top-k', name: 'Heap & top-K' },
  { key: 'dp-1d', name: '1-D dynamic programming' },
];

/** Short labels for tight spots (grid headers, phone tables). */
export const PATTERN_ABBR: Record<string, string> = {
  'two-pointers': '2 ptrs',
  'prefix-hashing': 'Hash',
  'sliding-window': 'Window',
  'binary-search': 'Bin. search',
  stack: 'Stack',
  'bfs-dfs': 'Graph',
  'heap-top-k': 'Heap',
  'dp-1d': 'DP',
  unsure: 'Not sure',
};
