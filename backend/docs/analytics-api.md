# Analytics & problem list API

All endpoints need `Authorization: Bearer <jwt>` and only ever return the logged-in user's data.
Errors use the usual shape: `{ "success": false, "message": "..." }` with status 400 / 401 / 403 / 404 / 500.

## Shared definitions

These rules hold in every endpoint below. The code is in `utils/problemStatus.js` and `utils/aiMeta.js`.

| Term | Meaning |
|---|---|
| **solved** | Has at least one `Accepted` submission; **or** is a manual problem whose `status` is `Solved`; **or** is a platform problem whose `status` is `Solved` and has no submissions at all (imported from a "solved" list). |
| **attempted** | Not solved, and has at least one submission or a stored `status` of `Attempted`. Solved problems are never counted as attempted. |
| **to do** | Neither of the above. |
| **solve date** (`solvedAt`) | Time of the problem's **first** `Accepted` submission. Manual solved problems use `createdAt`. Imported problems marked solved with no submissions have no solve date ("undated"). |
| **day** | A calendar date `YYYY-MM-DD` in the requested `tz`. |

Why the stored `status` isn't used on its own: sync creates a problem document before it adds the submissions, so new docs get the schema default `status: 'Solved'` even when every submission failed.

Each problem has exactly one difficulty bucket: `Easy`, `Medium`, `Hard` (LeetCode and manual), `Div1`, `Div2`, `Div3` or `unrated` (Codeforces). A missing or unrecognised value is reported as `unknown` and is never assumed to be `Medium`.

---

## GET /api/analytics/summary

### Query params

| Param | Values | Default |
|---|---|---|
| `platform` | `all` \| `leetcode` \| `codeforces` | `all` (includes manual problems) |
| `tz` | IANA time zone name, e.g. `Asia/Kolkata`, `America/Los_Angeles` | `UTC` |

An invalid `platform` or `tz` returns 400.

Send the browser's zone: `Intl.DateTimeFormat().resolvedOptions().timeZone`.

### Response

```jsonc
{
  "success": true,
  "data": {
    "platform": "all",
    "timezone": "Asia/Kolkata",
    "generatedAt": "2026-10-17T17:42:42.149Z",
    "range": { "from": "2025-10-18", "to": "2026-10-17" },   // 365 days; "to" is today in tz

    "totals": {
      "problems": 653,
      "solved": 600,
      "attempted": 53,              // unsolved problems with activity
      "solvedUndated": 0,           // solved, but no solve date (absent from day/month series)
      "submissions": 1543,          // all verdicts
      "acceptedSubmissions": 794,
      "acceptanceRate": 0.5146,     // acceptedSubmissions / submissions, 0–1, 4 dp; null when no submissions
      "aiAnalyzed": 3,              // problems with a stored AI analysis
      "aiStale": 1                  // ...whose analysis no longer matches the current code (see isStale below)
    },

    // Always contains all 8 keys, zero-filled
    "byDifficulty": {
      "Easy":    { "total": 131, "solved": 127 },
      "Medium":  { "total": 450, "solved": 417 },
      "Hard":    { "total": 72,  "solved": 56 },
      "Div1":    { "total": 0,   "solved": 0 },
      "Div2":    { "total": 0,   "solved": 0 },
      "Div3":    { "total": 9,   "solved": 7 },
      "unrated": { "total": 0,   "solved": 0 },
      "unknown": { "total": 0,   "solved": 0 }
    },

    // Always contains all 3 keys. With a platform filter, the other keys are 0.
    "byPlatform": {
      "leetcode":   { "total": 653, "solved": 600 },
      "codeforces": { "total": 0,   "solved": 0 },
      "manual":     { "total": 0,   "solved": 0 }
    },

    // Exactly 365 entries, oldest first, every day present (count may be 0).
    // Each problem is counted ONCE, on its solve day. Use for the heatmap and solved trend.
    "solvedByDay": [ { "date": "2025-10-18", "count": 0 }, /* ... */ { "date": "2026-10-17", "count": 2 } ],

    // Exactly 12 entries, oldest first, ending with the current month. Same rule as solvedByDay.
    // byDifficulty always has all 8 keys.
    "solvedByMonth": [
      { "month": "2025-11", "total": 9,
        "byDifficulty": { "Easy": 2, "Medium": 6, "Hard": 1, "Div1": 0, "Div2": 0, "Div3": 0, "unrated": 0, "unknown": 0 } }
      /* ... */
    ],

    // Exactly 365 entries, aligned with solvedByDay. Every submission of every verdict
    // (re-submissions included). Use for the activity view.
    "submissionsByDay": [ { "date": "2025-10-18", "count": 3, "accepted": 1 }, /* ... */ ],

    "streak": {
      "current": 3,          // consecutive active days ending today, or ending yesterday if today has no activity yet
      "longest": 41,         // all time
      "activeToday": true,
      "lastActiveDay": "2026-10-17"   // null when the user has never been active
    },

    // The daily goal: problems FIRST solved today (re-solves don't count)
    "today": {
      "date": "2026-10-17",
      "solved": 2,
      "target": 3,           // user.targetDailySolved (1 if unset or invalid)
      "remaining": 1,        // max(0, target - solved)
      "goalMet": false
    },

    // One row per tag, sorted by total (desc) then tag name. Duplicate tags on a problem count once.
    "topics": [ { "tag": "Array", "total": 370, "solved": 337, "attempted": 33 } /* ... */ ],

    // Problems grouped by the language of their LATEST Accepted submission, sorted by count desc.
    // Problems with no Accepted submission are left out.
    "languages": [ { "language": "cpp", "count": 593 }, { "language": "mysql", "count": 7 } ],

    // Submission counts per verdict. Always contains all 7 enum keys.
    // An "other" key appears only if the database has a verdict outside the enum.
    "verdicts": { "Accepted": 794, "Wrong Answer": 498, "TLE": 98, "MLE": 13, "RE": 106, "CE": 34, "Pending": 0 }
  }
}
```

### Streak rule

A day is **active** if it has at least one `Accepted` submission, **or** a manual problem was solved on it. Re-solving an old problem counts as activity. Wrong answers and other non-accepted verdicts don't count.

`current` doesn't reset to 0 until a whole day passes with no activity. If yesterday was active and today isn't yet, `current` still counts the run up to yesterday and `activeToday` is `false`.

Because re-solves count, a user can have `streak.activeToday: true` while `today.solved` is `0`. These measure different things: `today` is the daily goal (new problems only).

---

## GET /api/problems

### Default mode (unchanged)

With no `view` param, the response is the same as before: `{ success, count, data: Problem[] }`. It returns every matching problem with full submissions (including `code`) and `aiAnalysis`. The current frontend relies on this. New UI should use `view=list`.

### List mode: `?view=list`

Lightweight, paginated, with no submission code and no analysis bodies.

| Param | Values | Default |
|---|---|---|
| `page` | integer ≥ 1 | `1` |
| `limit` | integer 1–200 (larger values are clamped to 200) | `50` |
| `sort` | `updatedAt`, `createdAt`, `title`, `difficulty`, `lastSubmittedAt`, `firstSolvedAt`, `submissionCount`; prefix with `-` for descending | `-updatedAt` |
| `search` | substring of the title, case-insensitive, taken literally (regex characters are escaped) | — |
| `difficulty` | one value or a comma list, e.g. `Easy,Div2` | — |
| `status` | `Solved`, `Attempted`, `To Do`, or a comma list. Filters on the **derived** status | — |
| `platform` | `leetcode`, `codeforces`, `manual`, a comma list, or `all` | — |
| `tag` | one tag or a comma list. Whole-tag match, case-insensitive. Several tags match **any** of them | — |

An unknown `sort` returns 400. Ties are broken by `_id`, so pages are stable. The `difficulty` sort order is Easy < Medium < Hard < Div3 < Div2 < Div1 < unrated < anything else.

```jsonc
{
  "success": true,
  "page": 1,
  "limit": 50,
  "total": 653,                      // number of matches before pagination
  "data": [
    {
      "_id": "6ad3ac50e7f558b3857eac97",
      "title": "Minimum Rotations to Dial a Number II",
      "url": "https://leetcode.com/problems/minimum-rotations-to-dial-a-number-ii/",
      "platform": "leetcode",
      "platformProblemId": "minimum-rotations-to-dial-a-number-ii",
      "difficulty": "Medium",
      "tags": [],
      "category": "General",
      "createdAt": "2026-10-17T17:11:44.003Z",
      "updatedAt": "2026-10-17T17:17:41.654Z",
      "status": "Solved",            // derived: "Solved" | "Attempted" | "To Do"
      "storedStatus": "Solved",      // the raw DB field, for reference only
      "submissionCount": 7,
      "acceptedCount": 1,
      "hasCode": true,               // any submission has non-blank code
      "latestVerdict": "Accepted",   // null when there are no submissions
      "latestLanguage": "cpp",       // null when there are no submissions
      "lastSubmittedAt": "2026-10-04T09:14:40.000Z",   // null when there are no submissions
      "firstSolvedAt": "2026-10-04T09:14:40.000Z",     // first Accepted submission, else null
      "hasAiAnalysis": false,
      "aiStatus": "idle",            // "idle" | "pending" | "ready" | "error"
      "aiGeneratedAt": null,
      "aiIsStale": false             // same rule as aiAnalysisMeta.isStale
    }
  ]
}
```

Manual problems have no `firstSolvedAt` in list mode, because they have no submissions. Their derived `status` is still correct.

---

## GET /api/problems/:id

The response is the same as before: the full problem document with submissions, code and `aiAnalysis`. It also includes a new `data.aiAnalysisMeta` field:

```jsonc
"aiAnalysisMeta": {
  "status": "ready",                 // aiAnalysisStatus: "idle" | "pending" | "ready" | "error"
  "error": null,                     // aiAnalysisError, shown when status is "error"
  "generatedAt": "2026-10-01T01:00:00.000Z",   // null when there is no analysis
  "analyzedHash": "0cc175b9…",       // aiAnalysis.codeSnapshotHash, the code that was analysed
  "latestAcceptedHash": "92eb5ffe…", // md5 of the latest Accepted submission that has code; null if none
  "latestCodeHash": "92eb5ffe…",     // md5 of the latest submission with code, any verdict; null if none
  "isStale": true,
  "pendingSince": null               // aiAnalysisPendingSince while a job is running
}
```

**isStale** is `true` when an analysis exists and `analyzedHash` differs from the current code hash. The current code hash is `latestAcceptedHash`, or `latestCodeHash` if no Accepted submission has code. It is `false` when there is no analysis or no code to compare against. An analysis with no stored hash counts as stale.

UI guidance:
- Label an analysis "from cache" only when `isStale` is `false`.
- When `status === 'error'`, show `error`.
- When `status === 'pending'`, show progress. The analyzer treats a `pendingSince` older than 3 minutes as a dead job, so the UI may offer a retry.

Note: `POST /api/analyze/:id` currently analyses the latest submission **with code of any verdict**. If that is a newer failed attempt, the result's hash matches `latestCodeHash` but not `latestAcceptedHash`, so `isStale` is `true` straight after a re-run.
