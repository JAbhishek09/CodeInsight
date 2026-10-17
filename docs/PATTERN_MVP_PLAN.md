# CodeInsight — Pattern Recognition MVP

## Goal

Help students learn **pattern recognition**: look at a problem and know which
approach it needs, and when they get it wrong, understand *why* so they fix how
they think, not just the code.

**Success metric:** a student's *recognition accuracy* (picking the right
pattern before coding) goes up over a few weeks. Everything else is secondary.

## Principles

1. **Knowledge is fixed and shared.** A problem's pattern is the same for every
   student. It lives in a curated knowledge base, written once (AI-assisted,
   human-checked) — not guessed by AI per student.
2. **Learning happens before coding.** The student predicts the pattern first;
   feedback compares the prediction with the truth. Post-submit review is
   support, not the core.
3. **AI is a tutor, called when needed.** It explains a failure *given* the
   correct pattern as context — more accurate and far cheaper than asking it to
   classify.
4. **Start small, test with real students** before building more.

## The core loop

```
Open a problem on LeetCode
  → extension asks: "Which pattern is this?"  (one tap, optional "not sure")
  → student solves and submits
  → CodeInsight compares prediction vs known pattern, plus the verdict
  → instant feedback card:
       ✓ "Right — sliding window. You spotted it."
       ✗ "This is sliding window, not two pointers.
          The clue: 'longest substring … without repeating'."
  → on failure, offer "Why did this fail?" (AI tutor, pattern-aware)
  → result updates the student's pattern profile and next recommendations
```

## Pattern taxonomy (v1)

15 patterns; the MVP ships the first 8.

| # | Pattern | Recognition cues (examples) |
|---|---------|------------------------------|
| 1 | Two pointers | sorted array, pair/triplet with target, in-place compaction |
| 2 | Sliding window | contiguous subarray/substring, longest/shortest with a condition |
| 3 | Prefix sum / hashing | subarray sum equals k, counts of ranges, "seen before" |
| 4 | Binary search (incl. on answer) | sorted, "minimum maximum", monotonic feasibility |
| 5 | Stack / monotonic stack | next greater/smaller, matching brackets, spans |
| 6 | BFS / DFS on graphs & grids | islands, shortest steps, connected components |
| 7 | Heap / top-K | k-th largest, merge k sorted, running median |
| 8 | 1-D dynamic programming | ways to reach, max/min over choices, overlapping subproblems |
| 9 | Intervals | merge/insert/overlap, meeting rooms |
| 10 | Backtracking | all combinations/permutations/subsets |
| 11 | Trees (DFS/BFS) | depth, paths, level order, LCA |
| 12 | Topological sort | prerequisites, ordering with dependencies |
| 13 | Union-find | dynamic connectivity, redundant edge |
| 14 | Greedy | local choice proven optimal, scheduling |
| 15 | 2-D / interval / knapsack DP | grid paths, edit distance, partition |

Each pattern entry holds: a one-paragraph explanation, 3–5 recognition cues,
common wrong turns ("looks like two pointers but the array isn't sorted"),
a minimal code template, and 6–12 practice problems ordered easy → hard.

## MVP scope

**In**
- Knowledge base: 8 patterns, ~100 LeetCode problems mapped (slug → primary
  pattern, optional secondary, the key cue, expected complexity).
- Extension: "Which pattern?" picker on LeetCode problem pages; stores the
  prediction with the submission.
- Feedback card after submit (extension popup and the app's Problem page).
- Mistake detection by rules (below), AI tutor on demand.
- Pattern profile page (new home screen).
- "Guess the pattern" practice mode in the app (statement → pick → feedback).
- Recommendations: next problems from the weakest patterns + spaced review.

**Out (later)**
- Patterns 9–15, Codeforces, teacher/cohort views, leaderboards, mobile app.

## Mistake detection (rules first)

| Signal | Classification | Feedback |
|--------|----------------|----------|
| Prediction ≠ known pattern | Recognition miss | Show the cue they missed |
| TLE/MLE on a problem whose expected complexity is better than theirs | Wrong approach | "Brute force where *pattern* fits" |
| ≥2 WA with correct prediction | Implementation / edge case | Offer edge-case checklist for the pattern |
| Accepted after ≥4 attempts | Shaky understanding | Schedule a review in 7 days |
| Correct prediction, accepted first try | Mastered instance | Push next review further out |

The AI tutor is called only when the student asks "why did this fail?". Its
prompt includes the problem, the known pattern and cue, the verdict, and the
student's code, and asks for the smallest nudge — not a full solution.

## Data model changes

- `Pattern` (static, seeded): `key`, `name`, `explanation`, `cues[]`,
  `wrongTurns[]`, `template`, `order`.
- `ProblemPattern` (static, seeded): `slug`, `primary`, `secondary?`, `cue`,
  `expectedComplexity`, `difficulty`.
- `Attempt` (per student, per problem session): `problem`, `predictedPattern`,
  `predictedAt`, `submissionIds[]`, `verdicts[]`, `outcome`
  (`recognised` | `missed` | `wrong-approach` | `bug` | `unsure`).
- `PatternMastery` (derived per student): per pattern — predictions, correct,
  accuracy over last N, solved without hints, next review date.

## Phases

1. **Knowledge base** — seed 8 patterns + ~100 problem mappings; API to read
   them; pattern page in the app.
   *Done when:* every mapped problem shows its pattern, cue and template.
2. **Predict → feedback loop** — extension picker, stored predictions,
   feedback card in extension and app.
   *Done when:* a real submission produces the right feedback card.
3. **Mistake rules + AI tutor** — rule engine, pattern-aware "why did this
   fail?", per-student daily AI limit.
   *Done when:* TLE on a known O(n) problem is labelled "wrong approach".
4. **Pattern profile + recommendations** — new home screen, weakest patterns,
   spaced review queue.
   *Done when:* the home screen answers "what should I practise today?".
5. **Guess-the-pattern mode** — quick recognition drills from the knowledge
   base.
6. **Pilot** — 5–10 students for two weeks; measure recognition accuracy
   week over week; interview 3 of them.

## What changes in the current app

- Kept: LeetCode import, extension sync, Problem page, AI review (becomes the
  pattern-aware tutor), design system and components.
- Home: dashboard leads with the pattern profile; activity charts move to a
  secondary "Activity" view.
- Analytics "AI insights" becomes pattern-based (mistakes by pattern).

## Visual direction

**Skill-tree layout with neon colours.** Patterns appear as a map of nodes the
student unlocks (mastered / in progress / not started / current focus). Every
pattern has its own vivid colour, used on every screen where that pattern
appears, on a deep dark canvas, with a matching light theme. The layout gives
"what to learn next" at a glance; the colours give it energy and help
students remember each pattern.

## Risks

- **Mapping quality** — a wrong label teaches the wrong thing. Mitigation:
  human review of every mapping; "report wrong pattern" button.
- **Prediction friction** — students may skip the picker. Mitigation: one tap,
  skippable, shown before the editor gets focus; measure skip rate.
- **AI cost** — tutor is on demand with a daily cap per student.
- **Problems outside the map** — show "pattern not mapped yet" and log demand
  to prioritise the next mappings.
