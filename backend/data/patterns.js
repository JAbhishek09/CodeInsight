/**
 * patterns.js — the shared pattern knowledge base (MVP: 8 patterns).
 *
 * A problem's pattern is the same for every student, so this lives in code,
 * not in per-user AI output. See docs/PATTERN_MVP_PLAN.md.
 *
 * level: position in the skill tree (1 = learn first). requires: patterns that
 * should come before this one.
 */

export const PATTERNS = [
  {
    key: 'two-pointers',
    name: 'Two pointers',
    short: 'Walk two indices toward each other or in step to avoid a nested loop.',
    level: 1,
    requires: [],
    explanation:
      'Keep two indices into the same array (or two arrays) and move them based on a comparison. ' +
      'Because each pointer only moves forward, the work is O(n) instead of the O(n²) of trying every pair. ' +
      'It works when the data is sorted, or when the answer only depends on the two ends you are looking at.',
    cues: [
      'The array is sorted (or you can sort it) and you need a pair or triplet with a target sum',
      'Compare characters or values from both ends (palindromes, reversing)',
      'Rearrange or remove elements in place without extra memory',
      'Merge two sorted sequences',
    ],
    wrongTurns: [
      'Checking every pair with two nested loops — O(n²) where O(n) is possible',
      'Using two pointers on unsorted data where order doesn’t tell you which pointer to move',
      'Reaching for a hash map when the input is already sorted and pointers need no extra space',
    ],
    edgeChecklist: [
      "Empty array or a single element",
      "Pointers crossing (`l < r` vs `l <= r`)",
      "Duplicates — skip equal values to avoid repeated answers",
      "Moving the wrong pointer after a match",
    ],
    template: `int l = 0, r = nums.size() - 1;
while (l < r) {
    int cur = nums[l] + nums[r];
    if (cur == target) return {l, r};
    if (cur < target) l++;   // need a bigger sum
    else r--;                // need a smaller sum
}`,
  },
  {
    key: 'prefix-hashing',
    name: 'Prefix sums & hashing',
    short: 'Remember what you have seen so each element is checked once.',
    level: 1,
    requires: [],
    explanation:
      'Store something about the elements you have already passed — counts, indices, or running sums — in a hash map or array. ' +
      'Then each new element answers its question with one lookup. Prefix sums turn "sum of any range" into one subtraction, ' +
      'and a map of prefix sums counts subarrays with a given sum in one pass.',
    cues: [
      '"Have I seen this (or its complement) before?" — duplicates, two-sum style lookups',
      'Sum, count or product over a range or subarray, especially "equals k"',
      'Grouping by a key (anagrams, frequencies)',
      'Range queries asked many times on data that doesn’t change',
    ],
    wrongTurns: [
      'Recomputing every subarray sum with nested loops instead of a running prefix',
      'Sliding window on arrays with negative numbers — the window can’t shrink safely, prefix sums can',
      'Sorting to find duplicates when a set answers it in O(n)',
    ],
    edgeChecklist: [
      "Initialise the map with prefix 0 (`seen[0] = 1`)",
      "Look up before inserting the current element",
      "Integer overflow on running sums",
      "Negative numbers and zero",
    ],
    template: `unordered_map<int, int> seen;   // prefix sum -> how many times
seen[0] = 1;
int prefix = 0, count = 0;
for (int x : nums) {
    prefix += x;
    if (seen.count(prefix - k)) count += seen[prefix - k];
    seen[prefix]++;
}`,
  },
  {
    key: 'sliding-window',
    name: 'Sliding window',
    short: 'Grow and shrink a contiguous window instead of re-scanning it.',
    level: 2,
    requires: ['two-pointers', 'prefix-hashing'],
    explanation:
      'Keep a window [left, right] over a contiguous part of the array or string. Move right to add elements and move left ' +
      'to drop them when the window breaks a rule. Each element enters and leaves once, so the whole scan is O(n). ' +
      'Fixed-size windows slide by one; variable windows grow until invalid, then shrink until valid again.',
    cues: [
      'Contiguous subarray or substring',
      '"Longest", "shortest" or "maximum" with a condition (at most k distinct, no repeats, sum ≥ target)',
      'A window of fixed size k',
      'Anagram or permutation of a pattern inside a string',
    ],
    wrongTurns: [
      'Re-checking every substring with nested loops — O(n²) or worse',
      'Using it when elements can be negative and a sum condition is involved (use prefix sums)',
      'Shrinking with `if` instead of `while`, leaving the window invalid',
    ],
    edgeChecklist: [
      "Shrink with `while`, not `if`",
      "Update the answer after the window is valid again",
      "Remove the left element’s count before moving left",
      "Window larger than the input",
    ],
    template: `unordered_map<char, int> inWindow;
int left = 0, best = 0;
for (int right = 0; right < s.size(); right++) {
    inWindow[s[right]]++;
    while (/* window is invalid */ inWindow[s[right]] > 1) {
        inWindow[s[left]]--;
        left++;
    }
    best = max(best, right - left + 1);
}`,
  },
  {
    key: 'binary-search',
    name: 'Binary search',
    short: 'Halve the search space when the answer is monotonic.',
    level: 2,
    requires: ['two-pointers'],
    explanation:
      'If you can split the possibilities into "too small" and "big enough" with a yes/no check, you can find the boundary in ' +
      'O(log n) checks. That covers sorted arrays, rotated arrays, and "binary search on the answer": guess a value, test if it ' +
      'is feasible, and move toward the smallest (or largest) feasible one.',
    cues: [
      'Sorted (or rotated sorted) input and a target to find',
      '"Minimum possible maximum" / "smallest capacity / speed / days that works"',
      'A feasibility check that flips from false to true exactly once',
      'O(log n) required by the constraints',
    ],
    wrongTurns: [
      'Scanning linearly through a sorted array',
      'Trying every candidate answer instead of binary searching the answer range',
      'Off-by-one loops: mixing `l < r` with `r = mid - 1` and missing the boundary',
    ],
    edgeChecklist: [
      "`mid = lo + (hi - lo) / 2` to avoid overflow",
      "Loop condition matches the update (`lo < hi` with `hi = mid`)",
      "Answer may be at the boundaries",
      "Search range of the answer, not the array indices",
    ],
    template: `// smallest x in [lo, hi] where ok(x) is true
int lo = 1, hi = maxValue;
while (lo < hi) {
    int mid = lo + (hi - lo) / 2;
    if (ok(mid)) hi = mid;   // mid works, look left
    else lo = mid + 1;       // mid fails, look right
}
return lo;`,
  },
  {
    key: 'stack',
    name: 'Stack & monotonic stack',
    short: 'Keep unresolved items on a stack until something resolves them.',
    level: 2,
    requires: ['prefix-hashing'],
    explanation:
      'A stack remembers things you can’t answer yet, most recent first — open brackets, pending operands. A monotonic stack keeps ' +
      'its values increasing or decreasing; when a new value breaks the order, it is the answer ("next greater/smaller") for ' +
      'everything it pops. Each element is pushed and popped once, so it is O(n).',
    cues: [
      'Matching or nested structure: brackets, parentheses, tags, undo',
      '"Next greater / next smaller / previous smaller" element',
      'How far a value extends left or right (spans, histogram areas)',
      'Evaluate an expression or simulate collisions',
    ],
    wrongTurns: [
      'For each element, scanning forward to find the next greater one — O(n²)',
      'Storing values when you need indices to compute distances',
      'Forgetting to process what is still on the stack at the end',
    ],
    edgeChecklist: [
      "Pop until the condition fails, not just once",
      "Store indices when you need distances",
      "Handle items still on the stack at the end",
      "Empty stack before `top()`/`pop()`",
    ],
    template: `vector<int> nextGreater(n, -1);
stack<int> st;                         // indices, values decreasing
for (int i = 0; i < n; i++) {
    while (!st.empty() && nums[st.top()] < nums[i]) {
        nextGreater[st.top()] = nums[i];
        st.pop();
    }
    st.push(i);
}`,
  },
  {
    key: 'bfs-dfs',
    name: 'Graph & grid BFS/DFS',
    short: 'Explore connected cells or nodes; BFS for fewest steps.',
    level: 3,
    requires: ['stack'],
    explanation:
      'Treat the grid or graph as nodes with edges and visit each once, marking it seen. DFS (recursion or a stack) is enough for ' +
      'counting regions and connectivity. BFS (a queue) visits in rings of distance, so the first time you reach a node is the ' +
      'shortest number of steps. Starting BFS from many sources at once finds distances to the nearest source.',
    cues: [
      'A grid of cells or a list of edges / neighbours',
      'Count islands, regions, provinces or connected components',
      '"Minimum number of steps / moves / minutes" in an unweighted graph',
      'Spread from several starting points at once (rotting, distances, flooding)',
    ],
    wrongTurns: [
      'Using DFS when the question asks for the shortest number of steps',
      'Forgetting to mark cells as visited, causing infinite loops or repeated work',
      'Starting a BFS from every cell instead of one multi-source BFS',
    ],
    edgeChecklist: [
      "Mark visited when you push, not when you pop",
      "Grid bounds before indexing",
      "Disconnected parts — start from every unvisited node",
      "Recursion depth on large grids (use BFS or an explicit stack)",
    ],
    template: `queue<pair<int,int>> q;
// push all starting cells, mark them visited
int steps = 0, dr[] = {1,-1,0,0}, dc[] = {0,0,1,-1};
while (!q.empty()) {
    for (int sz = q.size(); sz > 0; sz--) {
        auto [r, c] = q.front(); q.pop();
        for (int d = 0; d < 4; d++) {
            int nr = r + dr[d], nc = c + dc[d];
            if (inside(nr, nc) && !seen[nr][nc]) { seen[nr][nc] = true; q.push({nr, nc}); }
        }
    }
    steps++;
}`,
  },
  {
    key: 'heap-top-k',
    name: 'Heap & top-K',
    short: 'Keep only the k best candidates in a priority queue.',
    level: 3,
    requires: ['prefix-hashing'],
    explanation:
      'A heap gives you the smallest (or largest) item in O(log n). To find the top k of n items, keep a heap of size k and ' +
      'drop the worst whenever it grows past k — O(n log k) instead of sorting everything. Two heaps can track a running median, ' +
      'and a min-heap of list heads merges k sorted lists.',
    cues: [
      '"k-th largest / smallest", "top k most frequent", "k closest"',
      'Repeatedly take the largest or smallest item while new ones arrive',
      'Merge k sorted lists or streams',
      'Median or order statistics of a stream',
    ],
    wrongTurns: [
      'Sorting the whole input when only k items matter',
      'Using a max-heap of everything for "k largest" instead of a min-heap of size k',
      'Re-sorting after every insertion in a stream',
    ],
    edgeChecklist: [
      "Min-heap vs max-heap (`greater<>` keeps the k largest)",
      "Pop when the heap grows past k",
      "Ties in the comparator",
      "k larger than the input",
    ],
    template: `priority_queue<int, vector<int>, greater<int>> minHeap;  // keeps k largest
for (int x : nums) {
    minHeap.push(x);
    if (minHeap.size() > k) minHeap.pop();
}
return minHeap.top();   // k-th largest`,
  },
  {
    key: 'dp-1d',
    name: '1-D dynamic programming',
    short: 'Build each answer from smaller answers you already computed.',
    level: 3,
    requires: ['prefix-hashing'],
    explanation:
      'When the best answer for position i depends only on answers for earlier positions, store those answers in an array ' +
      '(dp[i]) and fill it in order. Define what dp[i] means, write how it is built from earlier entries (the recurrence), ' +
      'and set the base cases. It replaces exponential recursion with an O(n) or O(n·k) loop.',
    cues: [
      '"Number of ways", "minimum cost", "maximum profit" to reach position i',
      'At each step you choose between options (take / skip, 1 step / 2 steps)',
      'A plain recursive solution recomputes the same subproblems',
      'Can the string / amount be built from pieces? (word break, coin change)',
    ],
    wrongTurns: [
      'Plain recursion without memoisation — exponential time (TLE)',
      'Greedy choices where a locally best step isn’t globally best',
      'Not defining exactly what dp[i] means before writing the recurrence',
    ],
    edgeChecklist: [
      "Base cases (`dp[0]`, `dp[1]`)",
      "Array size n + 1 when indexing by length",
      "Order of the loop: build from smaller answers",
      "Use `long long` for counts that grow fast",
    ],
    template: `vector<long long> dp(n + 1, 0);
dp[0] = 1;                     // base case
for (int i = 1; i <= n; i++) {
    dp[i] = dp[i - 1];         // option 1
    if (i >= 2) dp[i] += dp[i - 2];   // option 2
}
return dp[n];`,
  },
];

export const PATTERN_KEYS = PATTERNS.map((p) => p.key);
export const patternByKey = new Map(PATTERNS.map((p) => [p.key, p]));
