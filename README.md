# CodeInsight

An AI-powered competitive programming analytics platform that automatically captures your LeetCode submissions, syncs them in real time, and delivers time/space complexity analysis and interview optimizations via the Gemini API.

---

## What It Does

- **Chrome Extension** intercepts 100% of your LeetCode submissions the moment you submit — no manual input
- **Secure sync pipeline** sends submissions to the backend with JWT auth, nonce-based replay protection, and exponential backoff retry
- **AI analysis engine** generates complexity diagnostics and optimization feedback in under 2 seconds per submission
- **Dashboard** tracks your code coverage, language distribution, submission history, and import progress across 7 diagnostic dimensions

---

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React.js, Vite, Tailwind CSS |
| Backend | Node.js, Express.js, MongoDB Atlas, Mongoose |
| Extension | Manifest V3 Chrome Extension, GraphQL interception |
| AI | Google Gemini API |
| Auth | JWT, bcrypt, nonce-based replay protection |

---

## Prerequisites

- Node.js v18+
- npm v9+
- MongoDB Atlas account (free tier works)
- Google Gemini API key — free at [aistudio.google.com](https://aistudio.google.com)
- Google Chrome browser

---

## Quick Start (Windows)

The fastest way to run the full project locally:

```
Double-click START_HERE.bat
```

This launches both the backend (port 5000) and frontend (port 5173) in separate terminal windows. Wait ~10 seconds, then open [http://localhost:5173](http://localhost:5173).

> If `START_HERE.bat` doesn't work, use the manual setup below.

---

## Manual Setup

### 1. Clone the repository

```bash
git clone https://github.com/JAbhishek09/CodeInsight.git
cd CodeInsight
```

### 2. Configure the backend environment

```bash
cd backend
cp .env.example .env
```

Open `backend/.env` and fill in the required values:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/codeinsight
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_EXPIRES_IN=7d
GEMINI_API_KEY=<your-gemini-api-key>
```

> `LEETCODE_SESSION` and `EXTENSION_ID` are optional for local development.

### 3. Start the backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on [http://localhost:5000](http://localhost:5000). You should see:

```
🚀 Server running on port 5000
```

### 4. Start the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on [http://localhost:5173](http://localhost:5173).

### 5. Load the Chrome Extension

1. Open `chrome://extensions` in Chrome
2. Enable **Developer Mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select the `extension/` folder from this project
5. The CodeInsight icon will appear in your Chrome toolbar

### 6. Connect the extension

1. Click the CodeInsight extension icon
2. Log in or register at [http://localhost:5173](http://localhost:5173)
3. Copy your JWT token from the dashboard settings
4. Paste it into the extension popup and click **Save & Connect**

### 7. Test it

Navigate to any LeetCode problem, submit a solution, and watch it appear in your CodeInsight dashboard within ~3 seconds.

---

## Project Structure

```
CodeInsight/
├── START_HERE.bat          # One-click launcher (Windows)
├── start_all.bat           # Alternative launcher
├── backend/
│   ├── server.js           # Express app, CORS, rate limiting
│   ├── routes/             # Auth, problems, sync, analysis, analytics, import
│   ├── controllers/        # Route handlers
│   ├── models/             # Mongoose schemas
│   ├── middleware/         # JWT auth, error handling
│   ├── services/           # Gemini AI integration
│   ├── utils/              # Helpers
│   └── .env.example        # Environment variable template
├── frontend/               # React + Vite dashboard
└── extension/
    ├── manifest.json       # MV3 manifest
    ├── src/
    │   ├── content.js      # LeetCode page injection — submission detection
    │   ├── bridge.js       # Isolated world bridge
    │   └── background.js   # Service worker — JWT, fetch, retry queue
    └── popup/              # Extension popup UI
```

---

## How Submission Capture Works

LeetCode is a Next.js SPA. The extension uses a **4-strategy waterfall** to extract submitted source code reliably:

| Priority | Strategy | When it applies |
|---|---|---|
| 1 | `__NEXT_DATA__` JSON blob | Most reliable — Next.js SSR injects full submission data |
| 2 | React Fiber tree walk | When SSR data is absent |
| 3 | CodeMirror DOM lines | Older LeetCode editor |
| 4 | Monaco `view-line` DOM | Newer Monaco-based editor |

---

## Security

- JWT stored in `chrome.storage.local` — encrypted by the browser, isolated per extension
- Every backend request includes a one-time 32-char hex nonce + timestamp; the backend rejects replayed nonces within a 10-minute window
- CORS locked to a specific Extension ID in production via `EXTENSION_ID` env variable
- Rate limiting: 500 requests / 15 min globally; 30 requests / 15 min per user

---

## Environment Variables Reference

See [`backend/.env.example`](backend/.env.example) for full documentation of every variable.

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB Atlas connection string |
| `JWT_SECRET` | Yes | 64-byte random hex string |
| `GEMINI_API_KEY` | Yes | Google AI Studio API key |
| `PORT` | No | Defaults to 5000 |
| `CLIENT_URL` | No | Defaults to http://localhost:5173 |
| `LEETCODE_SESSION` | No | Required for historical import only |
| `EXTENSION_ID` | No | Recommended in production to lock CORS |

---

## License

MIT
