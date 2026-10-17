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
