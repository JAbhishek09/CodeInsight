/**
 * workedExamples.ts — one problem per pattern, worked through: the statement
 * with its clue phrases, why each clue points to the pattern, the reasoning,
 * a C++ solution, complexity and the classic bug.
 *
 * Statements are written in our own words. Each problem's example input is
 * the one the animated walkthrough on the same page runs (see
 * components/walkthrough/visuals.tsx). workedExamples.test.ts checks that
 * every clue appears in its statement and that each problem is mapped to
 * this pattern in the knowledge base.
 */

export interface WorkedExample {
  slug: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  statement: string;
  example: { input: string; output: string };
  /** Each quote must appear word for word in the statement; it gets highlighted. */
  clues: { quote: string; why: string }[];
  steps: string[];
  brute: { idea: string; cost: string };
  complexity: { time: string; space: string };
  code: string;
  pitfall: string;
}

export const WORKED_EXAMPLES: Record<string, WorkedExample> = {
  'two-pointers': {
    slug: 'two-sum-ii-input-array-is-sorted',
    title: 'Two Sum II - Input Array Is Sorted',
    difficulty: 'Medium',
    statement: 'You get an array of integers sorted in ascending order and a target. Return the positions of the two numbers that add up to the target, counting from 1. Exactly one answer exists, and you may only use constant extra space.',
    example: { input: 'numbers = [1, 3, 4, 6, 8, 11], target = 10', output: '[3, 4] — 4 + 6' },
    clues: [
      { quote: 'sorted in ascending order', why: 'Order tells you which way to move: a sum that is too small can only grow by moving the left pointer right.' },
      { quote: 'two numbers that add up to the target', why: 'A pair with a target sum. Check the two ends and walk inward.' },
      { quote: 'constant extra space', why: 'Rules out a hash map. Two indices need no extra memory.' },
    ],
    steps: [
      'Put L on the smallest number and R on the largest.',
      'Sum too big? Nothing left can pair with nums[R] — every partner is at least nums[L]. Move R left.',
      'Sum too small? Nothing can pair with nums[L], for the same reason. Move L right.',
      'Every check rules out one number, so you finish in at most n steps.',
    ],
    brute: { idea: 'Try every pair', cost: 'O(n²)' },
    complexity: { time: 'O(n)', space: 'O(1)' },
    code: `vector<int> twoSum(vector<int>& numbers, int target) {
    int l = 0, r = numbers.size() - 1;
    while (l < r) {
        int sum = numbers[l] + numbers[r];
        if (sum == target) return {l + 1, r + 1};  // from 1
        if (sum < target) l++;   // need a bigger sum
        else r--;                // need a smaller sum
    }
    return {};
}`,
    pitfall: 'Returning positions counted from 0 — this problem counts from 1, so add 1 to both.',
  },

  'prefix-hashing': {
    slug: 'subarray-sum-equals-k',
    title: 'Subarray Sum Equals K',
    difficulty: 'Medium',
    statement: 'Given an array of integers and a number k, count the contiguous subarrays whose sum is exactly k. The numbers can be negative.',
    example: { input: 'nums = [1, 2, 1, −1, 2], k = 3', output: '3 — [1, 2], [2, 1] and [1, 2, 1, −1]' },
    clues: [
      { quote: 'count', why: 'You need how many, not which: a map of counts adds up every match at once.' },
      { quote: 'contiguous subarrays whose sum is exactly k', why: 'A range’s sum is the difference of two running sums. “Exactly k” means: look up running sum − k.' },
      { quote: 'can be negative', why: 'Negatives make the sum drop as a window grows, so a sliding window can’t decide when to shrink.' },
    ],
    steps: [
      'Keep a running sum of everything so far.',
      'A subarray ending here adds up to k exactly when an earlier running sum equals running sum − k.',
      'So keep a map: running sum → how many times seen. Start it with {0: 1} for the empty start.',
      'At each number, add map[sum − k] to the count, then record sum.',
    ],
    brute: { idea: 'Add up every subarray', cost: 'O(n²)' },
    complexity: { time: 'O(n)', space: 'O(n)' },
    code: `int subarraySum(vector<int>& nums, int k) {
    // running sum -> times seen; {0: 1} is the empty start
    unordered_map<int, int> seen{{0, 1}};
    int sum = 0, count = 0;
    for (int x : nums) {
        sum += x;
        auto it = seen.find(sum - k);
        if (it != seen.end()) count += it->second;
        seen[sum]++;
    }
    return count;
}`,
    pitfall: 'Forgetting to start the map with {0: 1} — subarrays that begin at index 0 are never counted.',
  },

  'sliding-window': {
    slug: 'longest-substring-without-repeating-characters',
    title: 'Longest Substring Without Repeating Characters',
    difficulty: 'Medium',
    statement: 'Given a string, find the length of the longest substring in which no character appears twice.',
    example: { input: 's = "abcabcbb"', output: '3 — "abc"' },
    clues: [
      { quote: 'longest substring', why: 'A contiguous piece, and you want the longest: grow a window and keep the best length.' },
      { quote: 'no character appears twice', why: 'A rule you can repair: on a repeat, shrink from the left until it holds again.' },
    ],
    steps: [
      'Move the right edge one character at a time.',
      'If the new character is already inside, move the left edge past its earlier copy.',
      'The window is valid again: record its length if it is the best.',
      'Each character enters once and leaves at most once: O(n).',
    ],
    brute: { idea: 'Check every substring for repeats', cost: 'O(n²) with a set' },
    complexity: { time: 'O(n)', space: 'O(k) — k distinct characters' },
    code: `int lengthOfLongestSubstring(string s) {
    unordered_set<char> window;
    int left = 0, best = 0;
    for (int right = 0; right < (int)s.size(); right++) {
        // a repeat: shrink from the left until it's gone
        while (window.count(s[right])) {
            window.erase(s[left]);
            left++;
        }
        window.insert(s[right]);
        best = max(best, right - left + 1);
    }
    return best;
}`,
    pitfall: 'Shrinking with if instead of while — one step isn’t always enough to remove the repeat.',
  },

  'binary-search': {
    slug: 'search-insert-position',
    title: 'Search Insert Position',
    difficulty: 'Easy',
    statement: 'Given a sorted array of distinct integers and a target, return the index of the target, or the index where it would be inserted to keep the order. It must run in O(log n) time.',
    example: { input: 'nums = [1, 3, 5, 7, 9, 11, 13, 15], target = 10', output: '5 — just before 11' },
    clues: [
      { quote: 'sorted array', why: 'Sorted data: one comparison with the middle tells you which half can’t hold the answer.' },
      { quote: 'where it would be inserted', why: 'That is the first position whose value is ≥ target — a boundary search.' },
      { quote: 'O(log n) time', why: 'Logarithmic time almost always means halving the search space.' },
    ],
    steps: [
      'Keep a range [lo, hi) that must contain the answer. Start with [0, n).',
      'Look at the middle. If it is smaller than the target, the answer is to its right: lo = mid + 1.',
      'Otherwise the middle might be the answer: hi = mid.',
      'When lo == hi, that is the first position ≥ target.',
    ],
    brute: { idea: 'Scan from the left', cost: 'O(n)' },
    complexity: { time: 'O(log n)', space: 'O(1)' },
    code: `int searchInsert(vector<int>& nums, int target) {
    int lo = 0, hi = nums.size();  // answer in [lo, hi)
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;  // no overflow
        if (nums[mid] < target) lo = mid + 1;
        else hi = mid;  // mid might be the answer
    }
    return lo;
}`,
    pitfall: 'Mixing hi = n with while (lo <= hi) — pick one range style, or you’ll loop forever or read past the end.',
  },

  stack: {
    slug: 'daily-temperatures',
    title: 'Daily Temperatures',
    difficulty: 'Medium',
    statement: 'Given a list of daily temperatures, return for each day how many days you have to wait until a warmer temperature. If no warmer day comes, the answer is 0.',
    example: { input: 'temperatures = [73, 74, 75, 71, 69, 72, 76, 73]', output: '[1, 1, 4, 2, 1, 1, 0, 0]' },
    clues: [
      { quote: 'for each day', why: 'Many days wait at once; settle them all when a warmer day finally arrives.' },
      { quote: 'how many days you have to wait until a warmer temperature', why: 'For each day: the next greater element to its right.' },
    ],
    steps: [
      'Walk through the days, keeping a stack of days still waiting for a warmer one.',
      'Temperatures on the stack never rise from bottom to top: a monotonic stack.',
      'When today is warmer than the top, that day’s wait is over: pop it and record the gap. Repeat.',
      'Push today. Days still on the stack at the end never get a warmer day: 0.',
    ],
    brute: { idea: 'For each day, scan forward', cost: 'O(n²)' },
    complexity: { time: 'O(n)', space: 'O(n)' },
    code: `vector<int> dailyTemperatures(vector<int>& t) {
    vector<int> ans(t.size(), 0);
    // waiting days; temps never rise toward the top
    stack<int> waiting;
    for (int i = 0; i < (int)t.size(); i++) {
        while (!waiting.empty() && t[i] > t[waiting.top()]) {
            int j = waiting.top(); waiting.pop();
            ans[j] = i - j;  // day j waited i - j days
        }
        waiting.push(i);
    }
    return ans;
}`,
    pitfall: 'Pushing temperatures instead of indices — you need the index to know how many days passed.',
  },

  'bfs-dfs': {
    slug: 'rotting-oranges',
    title: 'Rotting Oranges',
    difficulty: 'Medium',
    statement: 'A grid holds 0 (empty), 1 (fresh orange) or 2 (rotten orange). Every minute, each fresh orange next to a rotten one, up, down, left or right, becomes rotten. Return the minutes until no fresh orange is left, or −1 if some can never rot.',
    example: { input: 'grid = [[2, 1, 1], [1, 1, 0], [0, 1, 1]]', output: '4' },
    clues: [
      { quote: 'Every minute', why: 'Change spreads one step at a time, everywhere at once: BFS, level by level.' },
      { quote: 'next to a rotten one, up, down, left or right', why: 'Cells connect to their neighbours: the grid is a graph.' },
      { quote: 'Return the minutes', why: 'The fewest steps to reach the last orange is the number of BFS levels.' },
    ],
    steps: [
      'Put every rotten orange in the queue first — they all spread at the same time.',
      'Process the queue one level at a time; one level is one minute.',
      'Each fresh neighbour rots and joins the queue for the next minute.',
      'When the queue runs out, any fresh orange left was unreachable: −1.',
    ],
    brute: { idea: 'Re-scan the whole grid every minute', cost: 'O((rows × cols)²)' },
    complexity: { time: 'O(rows × cols)', space: 'O(rows × cols)' },
    code: `int orangesRotting(vector<vector<int>>& grid) {
    int m = grid.size(), n = grid[0].size();
    int fresh = 0, minutes = 0;
    queue<pair<int, int>> q;
    for (int r = 0; r < m; r++)
        for (int c = 0; c < n; c++) {
            if (grid[r][c] == 2) q.push({r, c});
            else if (grid[r][c] == 1) fresh++;
        }
    auto isFreshAt = [&](int r, int c) {
        if (r < 0 || c < 0 || r >= m || c >= n) return false;
        return grid[r][c] == 1;
    };
    int dirs[4][2] = {{1, 0}, {-1, 0}, {0, 1}, {0, -1}};
    while (!q.empty() && fresh > 0) {
        // one level of the queue = one minute
        for (int k = q.size(); k > 0; k--) {
            auto [r, c] = q.front(); q.pop();
            for (auto& d : dirs) {
                int nr = r + d[0], nc = c + d[1];
                if (!isFreshAt(nr, nc)) continue;
                grid[nr][nc] = 2;  // mark when queued
                fresh--;
                q.push({nr, nc});
            }
        }
        minutes++;
    }
    return fresh == 0 ? minutes : -1;
}`,
    pitfall: 'Marking an orange rotten when you pop it instead of when you queue it — it can be queued twice, and the fresh count goes wrong.',
  },

  'heap-top-k': {
    slug: 'kth-largest-element-in-a-stream',
    title: 'Kth Largest Element in a Stream',
    difficulty: 'Easy',
    statement: 'Design a class that receives k and some starting numbers. Each time a new number arrives through add, return the k-th largest number seen so far.',
    example: { input: 'k = 3, start = [4, 5, 8, 2]; add 3, 5, 10, 9, 4', output: '4, 5, 5, 8, 8' },
    clues: [
      { quote: 'k-th largest', why: 'Only the top k matter: keep k numbers, not all of them.' },
      { quote: 'Each time a new number arrives', why: 'A stream: you can’t afford to sort everything again on every arrival.' },
    ],
    steps: [
      'Keep a min-heap of the k largest numbers so far.',
      'Its top — the smallest of those k — is the k-th largest.',
      'A new number that isn’t bigger than the top can’t make the top k: skip it.',
      'A bigger one replaces the top. Each update costs O(log k).',
    ],
    brute: { idea: 'Sort all numbers on every add', cost: 'O(n log n) per add' },
    complexity: { time: 'O(log k) per add', space: 'O(k)' },
    code: `class KthLargest {
    // min-heap of the k largest numbers so far
    priority_queue<int, vector<int>, greater<int>> heap;
    int k;
public:
    KthLargest(int k, vector<int>& nums) : k(k) {
        for (int x : nums) add(x);
    }
    int add(int val) {
        if ((int)heap.size() < k) heap.push(val);
        else if (val > heap.top()) {
            heap.pop();
            heap.push(val);
        }
        return heap.top();  // the k-th largest
    }
};`,
    pitfall: 'Using a max-heap — its top is the largest, not the k-th largest.',
  },

  'dp-1d': {
    slug: 'house-robber',
    title: 'House Robber',
    difficulty: 'Medium',
    statement: 'Houses in a row each hold some money. You can’t take from two houses that are next to each other. What is the most money you can take?',
    example: { input: 'nums = [2, 7, 9, 3, 1]', output: '12 — houses 0, 2 and 4 (2 + 9 + 1)' },
    clues: [
      { quote: 'can’t take from two houses that are next to each other', why: 'Each choice — take or skip — limits the next one: choices depend on earlier choices.' },
      { quote: 'the most money', why: 'An optimum over all choices: build it from the best answers for shorter rows.' },
    ],
    steps: [
      'Let best[i] be the most you can take from houses 0 to i.',
      'For house i: skip it (best[i − 1]) or take it (best[i − 2] + money[i]).',
      'best[i] = max(skip, take); the answer is the last value.',
      'Only the last two values are ever needed: O(1) space.',
    ],
    brute: { idea: 'Try every take/skip combination', cost: 'O(2ⁿ)' },
    complexity: { time: 'O(n)', space: 'O(1)' },
    code: `int rob(vector<int>& nums) {
    int prev2 = 0, prev1 = 0;  // best up to i-2 and i-1
    for (int x : nums) {
        int cur = max(prev1, prev2 + x);  // skip x, or take x
        prev2 = prev1;
        prev1 = cur;
    }
    return prev1;
}`,
    pitfall: 'Grabbing the biggest houses first — in [3, 4, 3], taking 4 blocks both 3s, but 3 + 3 = 6 is better.',
  },
};
