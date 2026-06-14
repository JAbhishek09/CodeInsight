# CodeInsight Chrome Extension

Automatically captures your LeetCode submissions and syncs them to your CodeInsight backend for AI-powered analysis.

---

## Setup

### 1. Install the backend dependency

```bash
cd backend
npm install express-rate-limit
```

### 2. Load the extension in Chrome

1. Open `chrome://extensions`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder in this project

### 3. Authenticate

1. Click the CodeInsight extension icon in your toolbar
2. Paste your **JWT token** from the CodeInsight dashboard (`/settings` or profile page)
3. If self-hosting, also enter your backend URL (e.g. `http://localhost:5000`)
4. Click **Save & Connect**

### 4. Submit a problem on LeetCode

Navigate to any LeetCode problem, submit your solution, and wait for the result page. The extension will automatically detect and upload the submission within ~3 seconds.

---

## File Structure

```
extension/
├── manifest.json           # MV3 manifest (permissions, content scripts)
├── src/
│   ├── content.js          # Injected into LeetCode pages — detects & extracts
│   └── background.js       # Service worker — JWT, fetch, retry queue
└── popup/
    ├── popup.html          # Extension popup UI
    └── popup.js            # Popup logic (auth, status display)
```

---

## How Code Extraction Works

LeetCode is a Next.js SPA. The extension uses a **4-strategy waterfall** to extract submitted source code:

| Priority | Strategy | When it works |
|----------|----------|---------------|
| 1 | `__NEXT_DATA__` JSON blob | Most reliable — Next.js SSR injects full submission data |
| 2 | React Fiber tree walk | When SSR data absent; reads component props directly |
| 3 | CodeMirror DOM lines | Older LeetCode editor |
| 4 | Monaco `view-line` DOM | Newer Monaco-based editor |

---

## Security Model

- **JWT** stored in `chrome.storage.local` (encrypted by the browser, isolated per extension)
- **No LeetCode cookies** are ever read or stored
- **Minimal permissions**: only `storage`, `alarms`, and `host_permissions` for `leetcode.com`
- **Replay attack prevention**: every request includes a one-time 32-char hex nonce + timestamp; the backend rejects seen nonces within a 10-minute window
- **Rate limiting**: 30 requests / 15 min per user on the backend, 10 requests / min in the extension service worker

---

## Backend API

### `POST /api/extensions/leetcode/submission`

**Headers:**
```
Authorization: Bearer <jwt>
Content-Type: application/json
```

**Body:**
```json
{
  "problemSlug":  "two-sum",
  "submissionId": "1234567890",
  "title":        "Two Sum",
  "verdict":      "Accepted",
  "language":     "cpp",
  "code":         "class Solution { ... }",
  "submittedAt":  "2025-06-10T14:32:00.000Z",
  "_nonce":       "a3f8bc...",
  "_ts":          1749558720000
}
```

**Responses:**

| Status | Meaning |
|--------|---------|
| 201    | Submission recorded, AI pipeline triggered if code changed |
| 200    | Duplicate — already recorded |
| 400    | Validation error (see `errors` array) |
| 401    | JWT missing or expired |
| 409    | Replay attack — duplicate nonce |
| 429    | Rate limit exceeded |

---

## AI Pipeline Integration

After a successful `Accepted` submission:

1. Backend computes `md5(code)`
2. Compares with `problem.aiAnalysis.codeSnapshotHash`
3. If **different** (or null): clears `aiAnalysis`, calls `enqueueAIAnalysis()`
4. If **same**: reuses cached analysis

Wire `enqueueAIAnalysis()` in `extension.controller.js` to your existing AI service or job queue.
