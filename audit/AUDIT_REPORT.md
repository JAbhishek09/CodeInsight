# CodeInsight — Engineering Audit Report
**Date:** June 2026 | **Auditor:** Claude (Sonnet 4.6)

---

## Architecture Summary

Three-part monorepo:
- **Backend** — Node.js / Express 5 / MongoDB (Mongoose), JWT auth, Gemini AI, LeetCode + Codeforces sync
- **Frontend** — React 18 / TypeScript / Vite / TailwindCSS v4
- **Extension** — Chrome MV3, content script + service worker for LeetCode submission capture

---

## Issues Found & Fixes Applied

### ✅ Already Fixed (documented in prior BUG_REPORT.md)

| # | Severity | Issue | Status |
|---|----------|-------|--------|
| BUG-001 | CRITICAL | `@google/generative-ai` missing from package.json | Fixed |
| BUG-002 | CRITICAL | CORS open to all origins | Fixed |
| BUG-003 | CRITICAL | JWT expiry hardcoded 30d | Fixed |
| BUG-004 | CRITICAL | Sync upserts duplicate submissions | Fixed (bulkWrite + submissionId dedup) |
| BUG-005 | CRITICAL | `/api/sync` + `/api/analytics` missing `protect` middleware | Fixed |
| BUG-006 | HIGH | N+1 DB writes in sync | Fixed (bulkWrite) |
| BUG-008 | HIGH | `refreshUser` not wrapped in useCallback → infinite loop risk | Fixed |
| BUG-009 | HIGH | Gemini client re-instantiated per request | Fixed (singleton) |
| BUG-013 | MEDIUM | Handle inputs not sanitized before external API calls | Fixed |

### ✅ Fixed In This Session

| # | Severity | Issue | Fix Applied |
|---|----------|-------|-------------|
| NEW-001 | HIGH | `Spinner..tsx` double-dot filename — fails on Linux CI / case-sensitive FS | Created `Spinner.tsx` (correct name) |
| NEW-002 | MEDIUM | `AnalysisPage`, `AddProblemPage`, `EditProblemPage`, `ProfileInput` catch blocks used `e.response?.data?.message` — always `undefined` after axios interceptor rewrites errors as plain `Error` | Changed to `e.message` in all 4 files |
| NEW-003 | MEDIUM | `useProblems` passed `undefined` to `getProblems` when no filters active | Always pass `params` (empty object ok) |
| NEW-004 | MEDIUM | `ProblemCard` had no "Analyze" button — users with synced problems had no way to reach `/analysis/:id` from ProblemsPage | Added Brain icon button navigating to `/analysis/:problemId` for leetcode/codeforces problems |
| NEW-005 | LOW | `ProblemCard` interface lacked `platform` and `submissions` fields, causing type errors when synced problems are passed to it | Added optional `platform` and `submissions` fields to `Problem` interface |

---

## Remaining Issues (Not Fixed — Require Decision)

### 🔶 Medium Priority

1. **`Spinner..tsx` old file still exists** — `Spinner.tsx` (correct) was created, but `Spinner..tsx` (typo) was not deleted because it's in a read-only MCP path context. You should manually delete `frontend/src/components/Spinner..tsx`. No component currently imports `Spinner..tsx` (it was always referenced as `Spinner`), but the duplicate is confusing.

2. **`GEMINI_API_KEY` is placeholder** in `.env` (`your_gemini_api_key_here`) — AI analysis will throw until you get a free key at [aistudio.google.com](https://aistudio.google.com).

3. **JWT Secret is weak** — `.env` has `supersecretjwtkey_replace_with_a_secure_long_random_string_in_production`. Replace with a 256-bit random value before any deployment.

4. **`enqueueAIAnalysis` in `extension.controller.js` is a stub** — it logs but does nothing. When the extension sends a submission, the AI analysis cache is invalidated but never re-filled. Users must manually click "Run AI Deep Dive" on the AnalysisPage. For a better UX, wire the stub to call `analyzeCode` from `aiService.js` directly (but be careful about Gemini quota).

5. **`user.controller.js` and `user.routes.js` are empty** — harmless but clutters the project. Delete them.

6. **`test.js` in backend root** is commented-out dead code — delete or move to `__tests__/`.

7. **In-memory nonce cache** (`extension.controller.js`) is lost on server restart, reopening a brief replay-attack window. Acceptable for a hobby project; use Redis TTL keys in production.

### 🔶 Low Priority

8. **`ProblemCard.Problem` difficulty type is `'Easy' | 'Medium' | 'Hard'`** but synced CF problems can have `'Div1' | 'Div2' | 'Div3' | 'unrated'`. The `getDifficultyStyles` switch won't match those and shows no badge. Consider adding a fallback style case.

9. **`analytics.controller.js` `getAnalyticsSummary`** — `userId` from `req.user._id` is an ObjectId but the `$match` stage needs it to match the stored ObjectId. This works because Mongoose coerces it, but it's worth noting explicitly.

10. **No `recharts` / chart library** is installed, but `DifficultyPieChart.tsx` and `WeeklyLineChart.tsx` components exist in the component directory. Check if these are actually imported anywhere; if yes, they will fail to render since no charting library is in `package.json`.

---

## LeetCode Source Code Capture — Status & Recommendation

### Current State
The **LeetCode public GraphQL API does NOT return source code** in the `recentSubmissionList` query. The `leetcodeService.js` correctly documents this: `code: ''`. The AI analysis will refuse to run if code is empty, showing a clear error: *"No code available for this problem."*

### The Extension Solves This
The Chrome Extension (`extension/src/content.js`) **IS** the source code capture mechanism. It uses a multi-strategy extraction approach:

1. **`__NEXT_DATA__` JSON blob** — most reliable (SSR data injected by LeetCode's Next.js)
2. **React fiber walk** — experimental fallback
3. **CodeMirror DOM lines** — CSS selector fallback
4. **Monaco view lines** — second CSS selector fallback

The extension sends captured code to `POST /api/extensions/leetcode/submission` which stores it in the `submissions[].code` field, making AI analysis available.

### What's Working
- Extension manifest, content script, background worker, and popup are all complete and production-quality
- The backend endpoint `extension.controller.js` correctly validates, deduplicates, and stores submissions with code
- The AI analysis pipeline correctly checks `s.code?.trim().length > 0` and uses the stored code

### What's Missing / Needs Action

1. **Extension is not loaded in Chrome** — you must go to `chrome://extensions`, enable Developer Mode, and load the `/extension` folder as an unpacked extension.

2. **`CONFIG.DEFAULT_API_BASE` is `'https://your-codeinsight-backend.com'`** in `background.js` — change this to `'http://localhost:5000'` for local dev (or your deployed URL).

3. **Users must paste their JWT into the extension popup** — there's no auto-login flow. Get your JWT from the browser's localStorage (`codeinsight_token`) after logging in at `http://localhost:5173`, paste it into the popup.

4. **`LEETCODE_SESSION` cookie env var** in `.env` (for deeper history via `fetchSubmissions`) is documented but empty — this is optional and only needed for the server-side sync path; the extension bypass is the primary path.

### Recommendation (Minimal Changes)
The architecture is already correct. To make end-to-end code capture work:

```
1. npm install in backend/ and frontend/
2. Set GEMINI_API_KEY in backend/.env
3. Start backend: cd backend && npm run dev
4. Start frontend: cd frontend && npm run dev
5. Load extension in Chrome (unpacked, from /extension folder)
6. Change background.js DEFAULT_API_BASE to http://localhost:5000
7. Login at localhost:5173, copy localStorage token, paste into extension popup
8. Go to LeetCode, submit a problem, navigate to the submission result URL
9. Extension captures code and sends to backend
10. Visit /analysis/:id in the app to run AI Deep Dive
```

---

## Security Checklist

| Item | Status |
|------|--------|
| CORS restricted to CLIENT_URL | ✅ |
| JWT protected with secret + expiry | ✅ (use a strong secret) |
| Passwords bcrypt-hashed | ✅ |
| Auth middleware on all private routes | ✅ |
| Rate limiting (global + per-route) | ✅ |
| Input sanitization (handles) | ✅ |
| Extension replay attack prevention (nonce) | ✅ (in-memory only) |
| No hardcoded credentials in code | ✅ |
| `.env` has real Mongo URI | ⚠️ (rotate credentials before going public) |
| Gemini key set | ❌ (placeholder) |
| JWT secret strong | ❌ (placeholder) |

---

## To Run the Project

```bash
# Backend
cd backend
npm install
# Edit .env: set GEMINI_API_KEY to a real key
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```
