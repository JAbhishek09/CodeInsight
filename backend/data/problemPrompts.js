/**
 * problemPrompts.js — a short task description per mapped problem, in our own
 * words, for guess-the-pattern drills. The title is hidden during a drill
 * (many titles give the pattern away), so each prompt must describe the task
 * well enough to guess from — without naming the technique.
 */

export const PROBLEM_PROMPTS = {
  // Two pointers
  'valid-palindrome': 'Ignoring case and anything that isn’t a letter or digit, does a string read the same forwards and backwards?',
  'merge-sorted-array': 'Two arrays are already in ascending order. The first has empty slots at its end. Combine both into the first array, still sorted, without another array.',
  'remove-duplicates-from-sorted-array': 'An ascending array has repeated values. Keep one copy of each at the front, in place, and return how many unique values there are.',
  'move-zeroes': 'Shift every 0 in an array to the end while keeping the other numbers in their original order. Do it in place.',
  'squares-of-a-sorted-array': 'An ascending array may hold negative numbers. Return the squares of every value, also in ascending order, in linear time.',
  'two-sum-ii-input-array-is-sorted': 'An ascending array and a target. Find the two positions whose values add up to the target using only constant extra memory.',
  '3sum': 'Find every distinct group of three numbers in an array that add up to zero. No repeated groups in the answer.',
  '3sum-closest': 'Pick three numbers from an array so their sum is as close as possible to a given target. Return that sum.',
  '4sum': 'Find every distinct group of four numbers in an array whose sum equals a target. No repeated groups.',
  'container-with-most-water': 'Vertical lines of different heights stand at each index. Choose two lines that, with the x-axis, hold the most water.',
  'sort-colors': 'An array holds only 0s, 1s and 2s. Put them in order in a single pass without using a library sort.',
  'trapping-rain-water': 'Bar heights form an elevation map. How much rain water is held between the bars after it rains?',

  // Prefix sums & hashing
  'two-sum': 'Given an unordered array and a target, return the positions of the two numbers that add up to the target.',
  'contains-duplicate': 'Does any value appear at least twice in the array?',
  'valid-anagram': 'Can the letters of one string be rearranged to form another string exactly?',
  'range-sum-query-immutable': 'An array never changes, but you will be asked many times for the sum between two positions. Make each answer fast.',
  'find-pivot-index': 'Find the first position where the total of everything to its left equals the total of everything to its right.',
  'group-anagrams': 'Given a list of words, put words that use exactly the same letters into the same group.',
  'longest-consecutive-sequence': 'In an unordered array, find the length of the longest run of consecutive integers (like 4, 5, 6, 7) in O(n) time.',
  'product-of-array-except-self': 'For each position, return the product of every other element. Division is not allowed and it must run in O(n).',
  'subarray-sum-equals-k': 'Count the contiguous stretches of an array whose values add up to exactly k. Values can be negative.',
  'continuous-subarray-sum': 'Is there a contiguous stretch of at least two elements whose total is a multiple of k?',
  'contiguous-array': 'In a binary array, find the longest contiguous stretch with the same number of 0s and 1s.',

  // Sliding window
  'best-time-to-buy-and-sell-stock': 'Daily prices are listed in order. Buy on one day and sell on a later day — what is the best possible profit?',
  'maximum-average-subarray-i': 'Find the contiguous stretch of exactly k elements with the highest average.',
  'longest-substring-without-repeating-characters': 'How long is the longest stretch of a string in which no character repeats?',
  'longest-repeating-character-replacement': 'You may change up to k characters of an uppercase string. How long can the longest run of one identical letter become?',
  'permutation-in-string': 'Does the second string contain some rearrangement of the first string as a contiguous piece?',
  'find-all-anagrams-in-a-string': 'Return every start index in a string where a rearrangement of a shorter pattern string begins.',
  'minimum-size-subarray-sum': 'All numbers are positive. Find the shortest contiguous stretch whose sum is at least a target.',
  'max-consecutive-ones-iii': 'In a binary array you may flip at most k zeros to ones. How long can the longest run of ones get?',
  'fruit-into-baskets': 'Walk along a row of trees, picking one fruit from each, with two baskets that each hold one fruit type. What is the most fruit you can collect from a contiguous row?',
  'minimum-window-substring': 'Find the shortest piece of string s that contains every character of string t, counting repeats.',
  'sliding-window-maximum': 'For each run of k consecutive elements, report the largest value — for every position the run can start at.',

  // Binary search
  'binary-search': 'Return the index of a target in an ascending array, or −1. It must run in O(log n).',
  'search-insert-position': 'In an ascending array of distinct values, return the target’s index, or where it would be inserted to keep order. O(log n).',
  'search-a-2d-matrix': 'Each row of a grid is ascending, and each row starts above the previous row’s last value. Is a target in the grid? Better than O(m·n).',
  'find-first-and-last-position-of-element-in-sorted-array': 'In an ascending array with repeats, return the first and last index of a target in O(log n).',
  'search-in-rotated-sorted-array': 'An ascending array of distinct values was rotated at an unknown point. Find a target’s index in O(log n).',
  'find-minimum-in-rotated-sorted-array': 'An ascending array was rotated at an unknown point. Find its smallest value in O(log n).',
  'find-peak-element': 'Find any element larger than both of its neighbours, in O(log n). Ends count as next to −∞.',
  'koko-eating-bananas': 'Piles of bananas must all be eaten within h hours, at most one pile per hour, at a fixed speed. What is the slowest speed that works?',
  'capacity-to-ship-packages-within-d-days': 'Packages ship in their given order over d days. What is the smallest ship capacity that gets them all delivered in time?',
  'time-based-key-value-store': 'Store values for a key at increasing timestamps. A lookup asks for the value at the latest timestamp not after a given time.',
  'split-array-largest-sum': 'Split an array into k contiguous parts so that the largest part-sum is as small as possible.',
  'median-of-two-sorted-arrays': 'Return the median of two ascending arrays combined, in O(log(m+n)).',

  // Stack
  'valid-parentheses': 'Do the brackets ( ) [ ] { } in a string all open and close in the right order?',
  'next-greater-element-i': 'For each value of a small array, find the first larger value to its right in a bigger array that contains it.',
  'min-stack': 'Design a structure with push, pop, top and “get the current smallest value”, each in O(1).',
  'evaluate-reverse-polish-notation': 'Evaluate an arithmetic expression written in postfix order, like ["2","1","+","3","*"].',
  'daily-temperatures': 'For each day, how many days do you wait until a warmer temperature? 0 if it never comes.',
  'next-greater-element-ii': 'For each element of a circular array, find the next larger value going forward (wrapping round), or −1.',
  'online-stock-span': 'As each day’s price arrives, report how many consecutive days, ending today, had a price ≤ today’s.',
  'asteroid-collision': 'Asteroids move left or right in a row. When two meet, the smaller explodes (equal: both). What is left after all collisions?',
  'remove-k-digits': 'Remove k digits from a number string to make the smallest possible number.',
  'car-fleet': 'Cars drive toward a target at different speeds and can’t pass; a car that catches up joins the slower one. How many groups arrive?',
  'reverse-substrings-between-each-pair-of-parentheses': 'Reverse the text inside each pair of parentheses, innermost first, and return the string without parentheses.',
  'largest-rectangle-in-histogram': 'Bars of width 1 form a histogram. What is the area of the largest rectangle that fits inside it?',

  // Graph & grid BFS/DFS
  'flood-fill': 'Starting from one pixel of an image, recolour it and every connected pixel of the same original colour.',
  'number-of-islands': 'A grid of land (1) and water (0). Count the groups of land cells joined up, down, left or right.',
  'max-area-of-island': 'A grid of land and water. What is the size of the largest group of connected land cells?',
  'number-of-provinces': 'An adjacency matrix says which cities are directly connected. How many separate groups of connected cities are there?',
  'keys-and-rooms': 'Each room holds keys to other rooms. Starting with room 0 open, can you get into every room?',
  'clone-graph': 'Make a deep copy of a connected undirected graph, given one of its nodes.',
  'rotting-oranges': 'Every minute, rotten oranges spoil the fresh oranges next to them. How many minutes until none are fresh, or −1?',
  '01-matrix': 'For every cell in a 0/1 grid, give the distance to the nearest 0.',
  'shortest-path-in-binary-matrix': 'In a 0/1 grid, find the shortest route of 0-cells from the top-left to the bottom-right, moving in 8 directions.',
  'pacific-atlantic-water-flow': 'Rain flows to equal or lower neighbours. Which cells can drain into both the top/left ocean and the bottom/right ocean?',
  'surrounded-regions': 'Turn every region of O’s that is fully enclosed by X’s into X’s. Regions touching the border stay.',
  'word-ladder': 'Change one letter at a time, each step a word in a dictionary. What is the fewest words from the start word to the end word?',

  // Heap & top-K
  'last-stone-weight': 'Repeatedly smash the two heaviest stones together; equal ones vanish, otherwise the difference stays. What is left?',
  'kth-largest-element-in-a-stream': 'Numbers keep arriving. After each one, report the k-th largest value seen so far.',
  'kth-largest-element-in-an-array': 'Find the k-th largest element of an unsorted array without fully sorting it.',
  'top-k-frequent-elements': 'Return the k values that appear most often in the array, better than O(n log n).',
  'top-k-frequent-words': 'Return the k most frequent words, ties broken alphabetically.',
  'k-closest-points-to-origin': 'From a list of points on a plane, return the k nearest to (0, 0).',
  'sort-characters-by-frequency': 'Rearrange a string so the characters that appear most often come first.',
  'task-scheduler': 'Tasks are letters; the same task needs a gap of n time slots before repeating. What is the least time to finish them all?',
  'reorganize-string': 'Rearrange a string so no two neighbouring characters are the same, or report that it’s impossible.',
  'merge-k-sorted-lists': 'Merge k linked lists, each already in ascending order, into one ascending list.',
  'find-median-from-data-stream': 'Numbers arrive one by one; at any moment, report the median of everything seen so far.',

  // 1-D dynamic programming
  'climbing-stairs': 'You climb 1 or 2 steps at a time. How many different ways are there to reach step n?',
  'min-cost-climbing-stairs': 'Each step has a cost to stand on; you can go up 1 or 2 at a time. What is the cheapest way to the top?',
  'house-robber': 'Take money from houses in a row, but never from two houses next to each other. What is the most you can take?',
  'house-robber-ii': 'Same as never taking from two neighbouring houses, but the houses are in a circle.',
  'maximum-subarray': 'Find the contiguous stretch of an array with the largest sum.',
  'maximum-product-subarray': 'Find the contiguous stretch of an array with the largest product. Values may be negative or zero.',
  'decode-ways': 'Letters were encoded as 1–26. How many ways can a string of digits be decoded back into letters?',
  'coin-change': 'Given coin values and an amount, what is the fewest coins that add up to it exactly, or −1?',
  'word-break': 'Can a string be split into a sequence of words that are all in a given dictionary?',
  'longest-increasing-subsequence': 'How long is the longest strictly increasing sequence you can pick from an array, keeping the original order?',
  'perfect-squares': 'What is the fewest perfect squares (1, 4, 9, …) that add up to n?',
  'partition-equal-subset-sum': 'Can an array be split into two groups with exactly equal sums?',
};

/**
 * The drill's hint: the words in each prompt that carry the clue. Each one is
 * copied exactly from its prompt (the hint highlights it there), points at
 * the deciding detail and never names the technique.
 */
export const PROMPT_CLUES = {
  // Two pointers
  'valid-palindrome': ['the same forwards and backwards'],
  'merge-sorted-array': ['already in ascending order', 'empty slots at its end', 'without another array'],
  'remove-duplicates-from-sorted-array': ['An ascending array', 'in place'],
  'move-zeroes': ['keeping the other numbers in their original order', 'in place'],
  'squares-of-a-sorted-array': ['An ascending array may hold negative numbers'],
  'two-sum-ii-input-array-is-sorted': ['An ascending array', 'constant extra memory'],
  '3sum': ['group of three numbers', 'add up to zero'],
  '3sum-closest': ['three numbers', 'as close as possible to a given target'],
  '4sum': ['group of four numbers', 'sum equals a target'],
  'container-with-most-water': ['Choose two lines', 'hold the most water'],
  'sort-colors': ['only 0s, 1s and 2s', 'in a single pass'],
  'trapping-rain-water': ['held between the bars'],

  // Prefix sums & hashing
  'two-sum': ['an unordered array', 'add up to the target'],
  'contains-duplicate': ['appear at least twice'],
  'valid-anagram': ['rearranged to form another string'],
  'range-sum-query-immutable': ['never changes', 'asked many times for the sum between two positions'],
  'find-pivot-index': ['total of everything to its left', 'total of everything to its right'],
  'group-anagrams': ['use exactly the same letters', 'the same group'],
  'longest-consecutive-sequence': ['unordered array', 'in O(n) time'],
  'product-of-array-except-self': ['product of every other element', 'Division is not allowed'],
  'subarray-sum-equals-k': ['add up to exactly k', 'Values can be negative'],
  'continuous-subarray-sum': ['total is a multiple of k'],
  'contiguous-array': ['the same number of 0s and 1s'],

  // Sliding window
  'best-time-to-buy-and-sell-stock': ['Buy on one day and sell on a later day'],
  'maximum-average-subarray-i': ['contiguous stretch of exactly k elements'],
  'longest-substring-without-repeating-characters': ['longest stretch', 'no character repeats'],
  'longest-repeating-character-replacement': ['change up to k characters', 'longest run'],
  'permutation-in-string': ['some rearrangement of the first string', 'contiguous piece'],
  'find-all-anagrams-in-a-string': ['every start index', 'rearrangement of a shorter pattern string'],
  'minimum-size-subarray-sum': ['All numbers are positive', 'shortest contiguous stretch'],
  'max-consecutive-ones-iii': ['flip at most k zeros', 'longest run of ones'],
  'fruit-into-baskets': ['two baskets that each hold one fruit type', 'a contiguous row'],
  'minimum-window-substring': ['shortest piece of string s', 'contains every character of string t'],
  'sliding-window-maximum': ['each run of k consecutive elements'],

  // Binary search
  'binary-search': ['ascending array', 'O(log n)'],
  'search-insert-position': ['ascending array of distinct values', 'O(log n)'],
  'search-a-2d-matrix': ['each row starts above the previous row’s last value', 'Better than O(m·n)'],
  'find-first-and-last-position-of-element-in-sorted-array': ['ascending array with repeats', 'O(log n)'],
  'search-in-rotated-sorted-array': ['rotated at an unknown point', 'O(log n)'],
  'find-minimum-in-rotated-sorted-array': ['rotated at an unknown point', 'O(log n)'],
  'find-peak-element': ['in O(log n)'],
  'koko-eating-bananas': ['the slowest speed that works'],
  'capacity-to-ship-packages-within-d-days': ['the smallest ship capacity that gets them all delivered in time'],
  'time-based-key-value-store': ['increasing timestamps', 'the latest timestamp not after a given time'],
  'split-array-largest-sum': ['the largest part-sum is as small as possible'],
  'median-of-two-sorted-arrays': ['two ascending arrays', 'O(log(m+n))'],

  // Stack
  'valid-parentheses': ['open and close in the right order'],
  'next-greater-element-i': ['the first larger value to its right'],
  'min-stack': ['push, pop, top', 'get the current smallest value'],
  'evaluate-reverse-polish-notation': ['written in postfix order'],
  'daily-temperatures': ['wait until a warmer temperature'],
  'next-greater-element-ii': ['the next larger value going forward'],
  'online-stock-span': ['how many consecutive days, ending today'],
  'asteroid-collision': ['When two meet, the smaller explodes', 'What is left'],
  'remove-k-digits': ['Remove k digits', 'the smallest possible number'],
  'car-fleet': ['can’t pass', 'joins the slower one'],
  'reverse-substrings-between-each-pair-of-parentheses': ['each pair of parentheses, innermost first'],
  'largest-rectangle-in-histogram': ['the largest rectangle that fits inside it'],

  // Graph & grid BFS/DFS
  'flood-fill': ['every connected pixel'],
  'number-of-islands': ['Count the groups of land cells joined'],
  'max-area-of-island': ['the largest group of connected land cells'],
  'number-of-provinces': ['separate groups of connected cities'],
  'keys-and-rooms': ['keys to other rooms', 'get into every room'],
  'clone-graph': ['deep copy', 'given one of its nodes'],
  'rotting-oranges': ['Every minute', 'spoil the fresh oranges next to them'],
  '01-matrix': ['every cell', 'distance to the nearest 0'],
  'shortest-path-in-binary-matrix': ['the shortest route', 'moving in 8 directions'],
  'pacific-atlantic-water-flow': ['flows to equal or lower neighbours', 'drain into both'],
  'surrounded-regions': ['fully enclosed', 'Regions touching the border stay'],
  'word-ladder': ['Change one letter at a time', 'the fewest words'],

  // Heap & top-K
  'last-stone-weight': ['Repeatedly smash the two heaviest stones'],
  'kth-largest-element-in-a-stream': ['Numbers keep arriving', 'the k-th largest value'],
  'kth-largest-element-in-an-array': ['k-th largest', 'without fully sorting it'],
  'top-k-frequent-elements': ['the k values that appear most often'],
  'top-k-frequent-words': ['the k most frequent words'],
  'k-closest-points-to-origin': ['the k nearest'],
  'sort-characters-by-frequency': ['appear most often come first'],
  'task-scheduler': ['needs a gap of n time slots before repeating'],
  'reorganize-string': ['no two neighbouring characters are the same'],
  'merge-k-sorted-lists': ['Merge k linked lists', 'each already in ascending order'],
  'find-median-from-data-stream': ['arrive one by one', 'the median'],

  // 1-D dynamic programming
  'climbing-stairs': ['1 or 2 steps at a time', 'How many different ways'],
  'min-cost-climbing-stairs': ['go up 1 or 2 at a time', 'the cheapest way'],
  'house-robber': ['never from two houses next to each other', 'the most you can take'],
  'house-robber-ii': ['never taking from two neighbouring houses', 'in a circle'],
  'maximum-subarray': ['the largest sum'],
  'maximum-product-subarray': ['largest product', 'Values may be negative or zero'],
  'decode-ways': ['encoded as 1–26', 'How many ways'],
  'coin-change': ['the fewest coins that add up to it exactly'],
  'word-break': ['split into a sequence of words'],
  'longest-increasing-subsequence': ['you can pick', 'keeping the original order'],
  'perfect-squares': ['the fewest perfect squares', 'add up to n'],
  'partition-equal-subset-sum': ['two groups with exactly equal sums'],
};
