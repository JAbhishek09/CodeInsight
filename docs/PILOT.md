# Pilot runbook — 5–10 students, two weeks

Phase 6 of [PATTERN_MVP_PLAN.md](PATTERN_MVP_PLAN.md). The question the pilot
answers: **does recognising the pattern get better week over week?**

## What we measure

| Measure | Where | Why |
|---|---|---|
| **First-try recognition accuracy per week** (headline) | `scripts/pilotReport.js`, student's Home | First guess a student ever makes on a problem. Repeat drills of a seen problem are excluded, so the number can't climb by memorising cards. "Not sure" counts as wrong. |
| All-guess accuracy per week | report CSV | Includes repeats; shows practice volume. |
| Guesses by source (drill / extension / app) | report CSV | Are they using it on LeetCode, or only drilling? |
| Active days per week | report CSV | Engagement. |

Weeks run Monday–Sunday in the time zone you pass (`--tz`). A week with
fewer than 5 first-try guesses is too noisy to compare and is skipped in the
report's "change" column.

```bash
cd backend
node scripts/pilotReport.js --weeks 3 --tz Asia/Kolkata
node scripts/pilotReport.js --weeks 3 --tz Asia/Kolkata --emails a@x.com,b@y.com --out reports/pilot-week2.csv
```

The console shows names only. The CSV includes emails; `backend/reports/` is
git-ignored — keep it that way. Run the report against production by putting
the production `MONGO_URI` in your local shell, not in a committed file.

## 1. Before deploying

- [ ] **Rotate secrets** that ever sat in a local `.env` or chat: Atlas DB
      user password, `JWT_SECRET`, Gemini key. Production gets fresh ones.
- [ ] `JWT_SECRET`: 32+ random characters
      (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
      Production refuses to start with a shorter one.
- [ ] **AI on the free tier (no billing needed).** The pilot's core loop —
      pattern guesses, feedback, drills, reviews, the daily plan — uses no AI.
      Only the "why did this fail?" tutor and code reviews do, and they run
      only when a student asks. One free Gemini key is shared by everyone:
      - Each free model has its own small daily allowance, so the app walks a
        chain of models (`GEMINI_MODELS`): flash-lite models first, then
        `gemini-2.5-flash`, then Gemma (slower, ~15 s, but its own allowance).
        A model that runs out is skipped for an hour.
      - Automatic reviews of every accepted submission are **off**
        (`AI_AUTO_REVIEW` unset). Turning them on would drain the key in a day.
      - Set `AI_DAILY_LIMIT=3` so one student can't use everyone's share.
      - When every model is out, students see "The free AI allowance is used
        up for today. Everything else works" — nothing else breaks.
- [ ] **Atlas network access** allows the host's outbound IPs (or
      `0.0.0.0/0` for the pilot, with a strong DB password).
- [ ] Pick an invite code for `PILOT_INVITE_CODE`.
- [ ] `npm test` passes in `backend/`; `npm run build` passes in `frontend/`.

## 2. Deploy (one service serves the app and the API)

Any Node host works (Render, Railway, Fly.io, a VM). Settings for a single web
service from the repo root:

| Setting | Value |
|---|---|
| Build command | `cd frontend && npm ci --include=dev && npm run build && cd ../backend && npm ci --omit=dev` |
| Start command | `cd backend && npm start` |
| Health check | `GET /api/health` |
| Node | 18+ (tested on 24) |

Environment variables (see `backend/.env.example`):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SERVE_CLIENT` | `true` — serves `dist/` (the built app) from the API server |
| `CLIENT_URL` | the public URL, e.g. `https://codeinsight.example.com` |
| `MONGO_URI` | production Atlas URI |
| `JWT_SECRET` | 32+ random characters |
| `JWT_EXPIRES_IN` | `30d` (students stay signed in through the pilot) |
| `GEMINI_API_KEY` | a free key from aistudio.google.com |
| `AI_DAILY_LIMIT` | `3` (see the AI note above); leave `GEMINI_MODELS` and `AI_AUTO_REVIEW` unset |
| `TRUST_PROXY` | `1` on Render/Railway/Fly (behind one proxy) |
| `PILOT_INVITE_CODE` | your code |
| `DNS_SERVERS` | `system` if the host's DNS resolves Atlas SRV records (most do) |
| `EXTENSION_ID` | leave empty — see "Known limits" |

What production mode changes: missing secrets stop the server at startup,
`/api/diagnose` is not mounted, and localhost origins are not allowed.

## 3. Package the extension

```bash
node extension/scripts/package.mjs --api https://codeinsight.example.com
```

This writes `extension-dist/` pointing at the production server (host
permission, default server address, popup link). Zip the folder and share it.

## 4. Smoke test (15 minutes, on the deployed URL)

- [ ] `/api/health` responds.
- [ ] Sign up without the invite code → refused; with it → lands on Home with
      the **Get started** checklist.
- [ ] Profile → Connections: add a LeetCode username; Import: import history.
- [ ] Home shows a focus pattern and today's plan.
- [ ] Drill: finish a deck; Home shows **Recognition by week**.
- [ ] Install the packaged extension in a clean Chrome profile, paste the
      token and server address from Profile → Connections → Browser
      extension. On a LeetCode problem the **Which pattern?** card appears;
      after submitting, the feedback card shows; Connections shows
      "Connected".
- [ ] `node scripts/pilotReport.js --weeks 1` lists the test account. Delete
      the test account's data before inviting students.

## 5. Inviting students

Send each student:

1. The link and the invite code.
2. The zipped extension and the three steps from Profile → Connections →
   Browser extension (Chrome → `chrome://extensions` → Developer mode →
   Load unpacked).
3. The ask: *"For two weeks, before you start any LeetCode problem, pick the
   pattern in the CodeInsight card first. Do a 2-minute drill on days you
   don't code. Home shows what to practise each day."*

## 6. During the pilot

- **Day 2:** check every student finished Get started (report shows guesses
  from the extension, not only drills). Nudge the ones who didn't.
- **End of week 1 and 2:** run the report with `--out`. Look at first-try
  accuracy per week per student and for the group, and at the group's most
  common mix-ups (printed under the table). A student's own mix-ups are on
  their Patterns page.
- **After week 2:** interview 3 students (one improving, one flat, one who
  dropped off). Ask: when did the clue click? when did the card get in the
  way? what did you do after a miss?

## Known limits

- **Extension ID lock.** Students load the extension unpacked, so each install
  gets a different ID; `EXTENSION_ID` can't pin one. Leave it empty for the
  pilot. Requests still need the student's own sign-in token. Publishing to
  the Chrome Web Store (or adding a manifest `key`) gives a fixed ID later.
- **LeetCode import from a server.** LeetCode throttles some datacenter IPs
  (HTTP 403). The import backs off and continues, but a big history can take
  longer than it did locally.
- **Free hosting tiers sleep.** The first request after idle can take ~30 s.
  The extension queues submissions and retries, so nothing is lost.
- **AI allowance** is one free key shared by everyone; when it runs out the AI tutor and reviews pause until the next day (see above).
