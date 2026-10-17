/**
 * problemPatterns.js — LeetCode problem → primary pattern (MVP mapping).
 *
 * slug: LeetCode titleSlug. cue: the phrase or property in the statement that
 * should make a student think of the pattern. complexity: expected optimal
 * time complexity, used to spot "wrong approach" failures.
 *
 * Every entry should be human-checked; a wrong label teaches the wrong thing.
 */

const P = (slug, title, difficulty, pattern, cue, complexity, extra = {}) =>
  ({ slug, title, difficulty, pattern, cue, complexity, ...extra });

export const PROBLEM_PATTERNS = [
  // ── Two pointers ───────────────────────────────────────────────────────────
  P('valid-palindrome', 'Valid Palindrome', 'Easy', 'two-pointers', 'Compare characters from both ends', 'O(n)'),
  P('merge-sorted-array', 'Merge Sorted Array', 'Easy', 'two-pointers', 'Two sorted arrays merged in place — fill from the back', 'O(m+n)'),
  P('remove-duplicates-from-sorted-array', 'Remove Duplicates from Sorted Array', 'Easy', 'two-pointers', 'Sorted + remove in place', 'O(n)'),
  P('move-zeroes', 'Move Zeroes', 'Easy', 'two-pointers', 'Rearrange in place, keep order', 'O(n)'),
  P('squares-of-a-sorted-array', 'Squares of a Sorted Array', 'Easy', 'two-pointers', 'Sorted with negatives — largest squares sit at the ends', 'O(n)'),
  P('two-sum-ii-input-array-is-sorted', 'Two Sum II - Input Array Is Sorted', 'Medium', 'two-pointers', 'Sorted array + pair with a target sum', 'O(n)'),
  P('3sum', '3Sum', 'Medium', 'two-pointers', 'Triplets summing to 0 — sort, fix one, two-pointer the rest', 'O(n²)'),
  P('3sum-closest', '3Sum Closest', 'Medium', 'two-pointers', 'Sorted triplet search toward a target', 'O(n²)'),
  P('4sum', '4Sum', 'Medium', 'two-pointers', 'Quadruplets — fix two, two-pointer the rest', 'O(n³)'),
  P('container-with-most-water', 'Container With Most Water', 'Medium', 'two-pointers', 'Area limited by the shorter side — move it inward', 'O(n)'),
  P('sort-colors', 'Sort Colors', 'Medium', 'two-pointers', 'Three values sorted in one pass (Dutch flag)', 'O(n)'),
  P('trapping-rain-water', 'Trapping Rain Water', 'Hard', 'two-pointers', 'Water level set by the lower of the two side maxima', 'O(n)'),

  // ── Prefix sums & hashing ─────────────────────────────────────────────────
  P('two-sum', 'Two Sum', 'Easy', 'prefix-hashing', 'Unsorted + "have I seen the complement?"', 'O(n)'),
  P('contains-duplicate', 'Contains Duplicate', 'Easy', 'prefix-hashing', '"Seen before?" — a set', 'O(n)'),
  P('valid-anagram', 'Valid Anagram', 'Easy', 'prefix-hashing', 'Compare character counts', 'O(n)'),
  P('range-sum-query-immutable', 'Range Sum Query - Immutable', 'Easy', 'prefix-hashing', 'Many range-sum queries on fixed data', 'O(1) per query'),
  P('find-pivot-index', 'Find Pivot Index', 'Easy', 'prefix-hashing', 'Left sum vs right sum at each index', 'O(n)'),
  P('group-anagrams', 'Group Anagrams', 'Medium', 'prefix-hashing', 'Group by a canonical key (sorted letters / counts)', 'O(n·k)'),
  P('longest-consecutive-sequence', 'Longest Consecutive Sequence', 'Medium', 'prefix-hashing', 'O(n) required — use a set, start only at run beginnings', 'O(n)'),
  P('product-of-array-except-self', 'Product of Array Except Self', 'Medium', 'prefix-hashing', 'Prefix and suffix products, no division', 'O(n)'),
  P('subarray-sum-equals-k', 'Subarray Sum Equals K', 'Medium', 'prefix-hashing', 'Count subarrays with sum k, negatives allowed', 'O(n)'),
  P('continuous-subarray-sum', 'Continuous Subarray Sum', 'Medium', 'prefix-hashing', 'Subarray sum multiple of k — prefix mod k', 'O(n)'),
  P('contiguous-array', 'Contiguous Array', 'Medium', 'prefix-hashing', 'Equal 0s and 1s — treat 0 as −1, first index of each prefix', 'O(n)'),

  // ── Sliding window ────────────────────────────────────────────────────────
  P('best-time-to-buy-and-sell-stock', 'Best Time to Buy and Sell Stock', 'Easy', 'sliding-window', 'Best pair with buy before sell — track the min so far', 'O(n)'),
  P('maximum-average-subarray-i', 'Maximum Average Subarray I', 'Easy', 'sliding-window', 'Fixed window of size k', 'O(n)'),
  P('longest-substring-without-repeating-characters', 'Longest Substring Without Repeating Characters', 'Medium', 'sliding-window', 'Longest substring with no repeats', 'O(n)'),
  P('longest-repeating-character-replacement', 'Longest Repeating Character Replacement', 'Medium', 'sliding-window', 'Longest window with at most k changes', 'O(n)'),
  P('permutation-in-string', 'Permutation in String', 'Medium', 'sliding-window', 'Permutation of a pattern inside a string — fixed window counts', 'O(n)'),
  P('find-all-anagrams-in-a-string', 'Find All Anagrams in a String', 'Medium', 'sliding-window', 'Every anagram position — fixed window counts', 'O(n)'),
  P('minimum-size-subarray-sum', 'Minimum Size Subarray Sum', 'Medium', 'sliding-window', 'Shortest subarray with sum ≥ target, positives only', 'O(n)'),
  P('max-consecutive-ones-iii', 'Max Consecutive Ones III', 'Medium', 'sliding-window', 'Longest window with at most k zeros', 'O(n)'),
  P('fruit-into-baskets', 'Fruit Into Baskets', 'Medium', 'sliding-window', 'Longest window with at most 2 distinct values', 'O(n)'),
  P('minimum-window-substring', 'Minimum Window Substring', 'Hard', 'sliding-window', 'Shortest window containing all required characters', 'O(n)'),
  P('sliding-window-maximum', 'Sliding Window Maximum', 'Hard', 'sliding-window', 'Max of every window of size k — monotonic deque', 'O(n)', { secondary: 'stack' }),

  // ── Binary search ─────────────────────────────────────────────────────────
  P('binary-search', 'Binary Search', 'Easy', 'binary-search', 'Sorted array + target', 'O(log n)'),
  P('search-insert-position', 'Search Insert Position', 'Easy', 'binary-search', 'Sorted + first position ≥ target', 'O(log n)'),
  P('search-a-2d-matrix', 'Search a 2D Matrix', 'Medium', 'binary-search', 'Fully sorted matrix = one sorted array', 'O(log(m·n))'),
  P('find-first-and-last-position-of-element-in-sorted-array', 'Find First and Last Position of Element in Sorted Array', 'Medium', 'binary-search', 'Two boundaries in a sorted array', 'O(log n)'),
  P('search-in-rotated-sorted-array', 'Search in Rotated Sorted Array', 'Medium', 'binary-search', 'Rotated sorted — one half is always sorted', 'O(log n)'),
  P('find-minimum-in-rotated-sorted-array', 'Find Minimum in Rotated Sorted Array', 'Medium', 'binary-search', 'Rotated sorted — compare mid with the right end', 'O(log n)'),
  P('find-peak-element', 'Find Peak Element', 'Medium', 'binary-search', 'O(log n) required — move toward the higher neighbour', 'O(log n)'),
  P('koko-eating-bananas', 'Koko Eating Bananas', 'Medium', 'binary-search', 'Minimum speed that works — binary search the answer', 'O(n log m)'),
  P('capacity-to-ship-packages-within-d-days', 'Capacity To Ship Packages Within D Days', 'Medium', 'binary-search', 'Minimum capacity that works — binary search the answer', 'O(n log m)'),
  P('time-based-key-value-store', 'Time Based Key-Value Store', 'Medium', 'binary-search', 'Latest timestamp ≤ t in a sorted list', 'O(log n) per get'),
  P('split-array-largest-sum', 'Split Array Largest Sum', 'Hard', 'binary-search', 'Minimise the largest part — binary search the answer', 'O(n log m)'),
  P('median-of-two-sorted-arrays', 'Median of Two Sorted Arrays', 'Hard', 'binary-search', 'O(log) required — binary search the partition', 'O(log min(m,n))'),

  // ── Stack & monotonic stack ───────────────────────────────────────────────
  P('valid-parentheses', 'Valid Parentheses', 'Easy', 'stack', 'Matching nested brackets', 'O(n)'),
  P('next-greater-element-i', 'Next Greater Element I', 'Easy', 'stack', '"Next greater" — monotonic stack', 'O(n)'),
  P('min-stack', 'Min Stack', 'Medium', 'stack', 'Track the minimum alongside each push', 'O(1) per op'),
  P('evaluate-reverse-polish-notation', 'Evaluate Reverse Polish Notation', 'Medium', 'stack', 'Operands wait on a stack for their operator', 'O(n)'),
  P('daily-temperatures', 'Daily Temperatures', 'Medium', 'stack', 'Days until a warmer day = next greater', 'O(n)'),
  P('next-greater-element-ii', 'Next Greater Element II', 'Medium', 'stack', 'Next greater in a circular array — loop twice', 'O(n)'),
  P('online-stock-span', 'Online Stock Span', 'Medium', 'stack', 'How far back values are ≤ today — previous greater', 'O(1) amortised'),
  P('asteroid-collision', 'Asteroid Collision', 'Medium', 'stack', 'Simulate collisions with the most recent survivor', 'O(n)'),
  P('remove-k-digits', 'Remove K Digits', 'Medium', 'stack', 'Smallest number — keep digits increasing', 'O(n)'),
  P('car-fleet', 'Car Fleet', 'Medium', 'stack', 'Sort by position, merge cars that catch up', 'O(n log n)'),
  P('reverse-substrings-between-each-pair-of-parentheses', 'Reverse Substrings Between Each Pair of Parentheses', 'Medium', 'stack', 'Nested parentheses — process innermost first', 'O(n)'),
  P('largest-rectangle-in-histogram', 'Largest Rectangle in Histogram', 'Hard', 'stack', 'How far each bar extends — previous/next smaller', 'O(n)'),

  // ── Graph & grid BFS/DFS ──────────────────────────────────────────────────
  P('flood-fill', 'Flood Fill', 'Easy', 'bfs-dfs', 'Recolour a connected region of a grid', 'O(m·n)'),
  P('number-of-islands', 'Number of Islands', 'Medium', 'bfs-dfs', 'Count connected regions in a grid', 'O(m·n)'),
  P('max-area-of-island', 'Max Area of Island', 'Medium', 'bfs-dfs', 'Size of the largest connected region', 'O(m·n)'),
  P('number-of-provinces', 'Number of Provinces', 'Medium', 'bfs-dfs', 'Count connected components', 'O(n²)'),
  P('keys-and-rooms', 'Keys and Rooms', 'Medium', 'bfs-dfs', 'Can every node be reached from node 0?', 'O(n+e)'),
  P('clone-graph', 'Clone Graph', 'Medium', 'bfs-dfs', 'Copy a graph — visit each node once with a map', 'O(n+e)'),
  P('rotting-oranges', 'Rotting Oranges', 'Medium', 'bfs-dfs', 'Minutes to spread from many sources — multi-source BFS', 'O(m·n)'),
  P('01-matrix', '01 Matrix', 'Medium', 'bfs-dfs', 'Distance to the nearest 0 — multi-source BFS', 'O(m·n)'),
  P('shortest-path-in-binary-matrix', 'Shortest Path in Binary Matrix', 'Medium', 'bfs-dfs', 'Fewest steps in a grid — BFS', 'O(n²)'),
  P('pacific-atlantic-water-flow', 'Pacific Atlantic Water Flow', 'Medium', 'bfs-dfs', 'Search backwards from both oceans’ borders', 'O(m·n)'),
  P('surrounded-regions', 'Surrounded Regions', 'Medium', 'bfs-dfs', 'Regions not touching the border — start from the border', 'O(m·n)'),
  P('word-ladder', 'Word Ladder', 'Hard', 'bfs-dfs', 'Fewest transformations — BFS over words', 'O(n·L²)'),

  // ── Heap & top-K ──────────────────────────────────────────────────────────
  P('last-stone-weight', 'Last Stone Weight', 'Easy', 'heap-top-k', 'Repeatedly take the two largest', 'O(n log n)'),
  P('kth-largest-element-in-a-stream', 'Kth Largest Element in a Stream', 'Easy', 'heap-top-k', 'k-th largest as values arrive — min-heap of size k', 'O(log k) per add'),
  P('kth-largest-element-in-an-array', 'Kth Largest Element in an Array', 'Medium', 'heap-top-k', 'k-th largest — min-heap of size k (or quickselect)', 'O(n log k)'),
  P('top-k-frequent-elements', 'Top K Frequent Elements', 'Medium', 'heap-top-k', 'Top k by frequency', 'O(n log k)'),
  P('top-k-frequent-words', 'Top K Frequent Words', 'Medium', 'heap-top-k', 'Top k by frequency with tie-break', 'O(n log k)'),
  P('k-closest-points-to-origin', 'K Closest Points to Origin', 'Medium', 'heap-top-k', 'k closest — max-heap of size k', 'O(n log k)'),
  P('sort-characters-by-frequency', 'Sort Characters By Frequency', 'Medium', 'heap-top-k', 'Order by frequency', 'O(n log k)'),
  P('task-scheduler', 'Task Scheduler', 'Medium', 'heap-top-k', 'Always run the most frequent available task', 'O(n)'),
  P('reorganize-string', 'Reorganize String', 'Medium', 'heap-top-k', 'Place the most frequent character, never twice in a row', 'O(n log k)'),
  P('merge-k-sorted-lists', 'Merge k Sorted Lists', 'Hard', 'heap-top-k', 'Merge k sorted streams — min-heap of heads', 'O(N log k)'),
  P('find-median-from-data-stream', 'Find Median from Data Stream', 'Hard', 'heap-top-k', 'Running median — two heaps', 'O(log n) per add'),

  // ── 1-D dynamic programming ───────────────────────────────────────────────
  P('climbing-stairs', 'Climbing Stairs', 'Easy', 'dp-1d', 'Number of ways using 1 or 2 steps', 'O(n)'),
  P('min-cost-climbing-stairs', 'Min Cost Climbing Stairs', 'Easy', 'dp-1d', 'Minimum cost to reach the top, 1 or 2 steps', 'O(n)'),
  P('house-robber', 'House Robber', 'Medium', 'dp-1d', 'Take or skip each house, no two adjacent', 'O(n)'),
  P('house-robber-ii', 'House Robber II', 'Medium', 'dp-1d', 'House robber on a circle — run it twice', 'O(n)'),
  P('maximum-subarray', 'Maximum Subarray', 'Medium', 'dp-1d', 'Best sum ending here: extend or restart (Kadane)', 'O(n)'),
  P('maximum-product-subarray', 'Maximum Product Subarray', 'Medium', 'dp-1d', 'Track both max and min ending here (negatives flip)', 'O(n)'),
  P('decode-ways', 'Decode Ways', 'Medium', 'dp-1d', 'Number of ways using 1 or 2 digits', 'O(n)'),
  P('coin-change', 'Coin Change', 'Medium', 'dp-1d', 'Fewest coins for an amount — build every amount up', 'O(n·amount)'),
  P('word-break', 'Word Break', 'Medium', 'dp-1d', 'Can the prefix up to i be built from words?', 'O(n²)'),
  P('longest-increasing-subsequence', 'Longest Increasing Subsequence', 'Medium', 'dp-1d', 'Best subsequence ending at i', 'O(n log n)'),
  P('perfect-squares', 'Perfect Squares', 'Medium', 'dp-1d', 'Fewest squares summing to n', 'O(n√n)'),
  P('partition-equal-subset-sum', 'Partition Equal Subset Sum', 'Medium', 'dp-1d', 'Can a subset reach sum/2? — 0/1 knapsack in one array', 'O(n·sum)'),
];

export const problemPatternBySlug = new Map(PROBLEM_PATTERNS.map((p) => [p.slug, p]));
