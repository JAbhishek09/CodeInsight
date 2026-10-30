/**
 * patternContrasts.js — how to tell two patterns apart, for every pair.
 *
 * Shown when a student mixes them up (feedback after a wrong guess, the drill
 * reveal, "Patterns you mix up"). Each tip is a decision test: what in the
 * problem statement points to one pattern rather than the other.
 */

import { PATTERN_KEYS } from './patterns.js';

const pairKey = (a, b) => [a, b].sort().join('|');

const TIPS = {
  [pairKey('two-pointers', 'prefix-hashing')]:
    'Sorted input (or you may sort it) and a pair/triplet target → two pointers. Unsorted and you must keep positions, or the question is “have I seen this before?” → hash map or prefix sums.',
  [pairKey('two-pointers', 'sliding-window')]:
    'Both move two indices. If the answer is one contiguous stretch whose rule you keep true as it grows and shrinks → sliding window. If you compare the two ends (pairs, palindromes, partitioning) → two pointers.',
  [pairKey('two-pointers', 'binary-search')]:
    'Sorted data and a pair that hits a target → pointers walk inward in O(n). Sorted data and one position or boundary to find, or a number you can test (“is k enough?”) → binary search in O(log n).',
  [pairKey('two-pointers', 'stack')]:
    'Matching brackets, or each item needs its nearest bigger/smaller neighbour → stack. Comparing the two ends of a sequence → two pointers.',
  [pairKey('two-pointers', 'bfs-dfs')]:
    'A grid, rooms or nodes connected to each other → BFS/DFS. One array or string scanned from its ends → two pointers.',
  [pairKey('two-pointers', 'heap-top-k')]:
    '“k largest / closest / most frequent”, or always taking the current best → heap. One sorted array scanned once → two pointers.',
  [pairKey('two-pointers', 'dp-1d')]:
    '“How many ways” or “best total” where each choice limits later ones → DP. One pass comparing the ends of sorted data → two pointers.',

  [pairKey('prefix-hashing', 'sliding-window')]:
    'Subarray sums with only non-negative numbers and “at least / at most” → sliding window. Negatives allowed, “exactly k”, or counting subarrays → prefix sums with a hash map.',
  [pairKey('prefix-hashing', 'binary-search')]:
    'Look up values in unsorted data → hash map, O(1) each. Sorted data, or a yes/no question that flips once as the value grows → binary search.',
  [pairKey('prefix-hashing', 'stack')]:
    '“Next greater/smaller” or matching brackets → stack. “Seen before?”, counts, or range sums → hashing / prefix sums.',
  [pairKey('prefix-hashing', 'bfs-dfs')]:
    'Connected cells, rooms or nodes to explore → BFS/DFS. Counting or looking up values in a flat list → hashing.',
  [pairKey('prefix-hashing', 'heap-top-k')]:
    'Counting frequencies is the hash-map part. If you then need only the top k of them → add a heap. If counts or lookups are the whole answer → hashing alone.',
  [pairKey('prefix-hashing', 'dp-1d')]:
    'Prefix sums store totals of what you have seen. DP stores the best answer for each prefix when there is a choice at every step (take or skip, which coin). A choice per step → DP.',

  [pairKey('sliding-window', 'binary-search')]:
    'A contiguous stretch with a rule → sliding window. “Smallest speed / capacity / size that works”, where checking one value is easy → binary search on the answer.',
  [pairKey('sliding-window', 'stack')]:
    'Longest or shortest contiguous stretch with a rule → window. Each element waits for the next bigger or smaller one → monotonic stack. (Window maximum combines both: a deque.)',
  [pairKey('sliding-window', 'bfs-dfs')]:
    'Neighbours in a grid or graph → BFS/DFS. A contiguous piece of one array or string → sliding window.',
  [pairKey('sliding-window', 'heap-top-k')]:
    'Top k of the whole input or of a stream → heap. Something about every contiguous stretch of length k → sliding window.',
  [pairKey('sliding-window', 'dp-1d')]:
    'A stretch you can repair by moving its left edge → window. Choices that depend on earlier choices (skip or take, ways to reach) → DP. Maximum subarray sum with negatives is DP (Kadane), not a window.',

  [pairKey('binary-search', 'stack')]:
    'Sorted data, or a yes/no test that flips once → binary search. Unsorted, and each item needs its nearest bigger/smaller neighbour → stack.',
  [pairKey('binary-search', 'bfs-dfs')]:
    '“Fewest steps” across a grid or graph → BFS. “Smallest value that works” on a number line → binary search.',
  [pairKey('binary-search', 'heap-top-k')]:
    'k-th largest of unsorted data or of a stream → heap. A position in already-sorted data → binary search.',
  [pairKey('binary-search', 'dp-1d')]:
    '“Minimise the largest” or “maximise the smallest” with an easy feasibility check → binary search on the answer. Counting ways or best totals built from smaller answers → DP.',

  [pairKey('stack', 'bfs-dfs')]:
    'Exploring connected cells or nodes → BFS/DFS (DFS may use a stack inside, but the pattern is the traversal). Matching or nearest-greater along one sequence → stack.',
  [pairKey('stack', 'heap-top-k')]:
    'You need the largest or smallest of everything so far, in any order → heap. You need the most recent unresolved item → stack.',
  [pairKey('stack', 'dp-1d')]:
    'Brackets, undo, or nearest greater → stack. Answers built from smaller answers with a choice at each step → DP.',

  [pairKey('bfs-dfs', 'heap-top-k')]:
    'Shortest path where every step costs the same → BFS. Repeatedly picking the current best of many candidates (merge k lists, scheduling) → heap.',
  [pairKey('bfs-dfs', 'dp-1d')]:
    'Fewest steps or reachability through connections → BFS/DFS. Number of ways or best total along a line of choices → DP. (Coin change can be done as BFS, but DP is the usual fit.)',

  [pairKey('heap-top-k', 'dp-1d')]:
    'Greedily taking the best item available right now → heap. A best total where today’s choice limits tomorrow’s → DP.',
};

/** How to tell pattern `a` from pattern `b`, or null (same pattern, unknown key). */
export function contrastTip(a, b) {
  if (!a || !b || a === b) return null;
  return TIPS[pairKey(a, b)] ?? null;
}

/** Every pair of known patterns has a tip (checked by the tests). */
export const ALL_PAIRS = PATTERN_KEYS.flatMap((a, i) => PATTERN_KEYS.slice(i + 1).map((b) => [a, b]));
