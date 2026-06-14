/**
 * background.js — CodeInsight Service Worker
 *
 * Responsibilities:
 *  1. Receive UPLOAD_SUBMISSION messages from content scripts.
 *  2. Retrieve the stored JWT from chrome.storage.local.
 *  3. POST the payload to the CodeInsight backend with:
 *       - JWT Authorization header
 *       - A one-time nonce + timestamp to prevent replay attacks
 *  4. Retry failed requests with exponential back-off (up to 3 attempts).
 *  5. Rate-limit outgoing requests (max 10 per minute per extension instance).
 *  6. Persist a failed-upload queue across service worker restarts via alarms.
 *
 * Security model:
 *  - JWT is stored in chrome.storage.local (not cookies, not sessionStorage).
 *  - We never touch LeetCode's session cookies.
 *  - Nonce prevents replay: backend validates nonce has not been seen before.
 *  - Origin header is checked server-side.
 *
 * Fixes applied:
 *  BUG-BG-001 — Moved RETRY_QUEUE_KEY and MAX_QUEUE_SIZE to file top so they
 *               are initialised before the onMessage listener that references them,
 *               eliminating the temporal dead zone (TDZ) risk.
 *  BUG-BG-002 — Added SW keep-alive heartbeat inside handleUpload() using
 *               chrome.runtime.getPlatformInfo() every 25 s so Chrome does not
 *               terminate the worker mid-retry-sleep.
 *  BUG-BG-003 — Replaced in-memory rate limiter (reset on every SW restart) with
 *               chrome.storage.session-backed state that survives restarts within
 *               the same browser session.
 *  BUG-EXT-001 — enqueueForRetry() now checks if the submissionId is already in
 *               the queue before pushing, preventing a race between the live-send
 *               path and the retry queue after a SW restart.
 */

// ─── Constants (MUST be at top — referenced by the message listener below) ────
// BUG-BG-001: These were previously declared after the onMessage listener,
// placing them in the TDZ for any message that arrived during SW init.
const RETRY_QUEUE_KEY = 'ci_retry_queue';
const MAX_QUEUE_SIZE = 50;

// ─── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  /** CodeInsight backend base URL. Loaded from storage so users can self-host. */
  DEFAULT_API_BASE: 'http://localhost:5000',
  SUBMISSION_ENDPOINT: '/api/extensions/leetcode/submission',

  MAX_RETRIES: 3,
  RETRY_BASE_MS: 1000,

  /** Rate limit: max uploads per minute per extension instance. */
  RATE_LIMIT_MAX: 10,
  RATE_LIMIT_WINDOW_MS: 60_000,

  /** Alarm name for retry queue processing. */
  RETRY_ALARM: 'codeinsight-retry-queue',
  RETRY_ALARM_PERIOD_MINUTES: 1,

  /** Heartbeat interval to keep the SW alive during network operations (ms). */
  SW_KEEPALIVE_MS: 25_000,
};

// ─── Rate limiter (chrome.storage.session-backed) ─────────────────────────────
// BUG-BG-003: The original in-memory rate limiter (count + windowStart as plain
// object properties) was reset to zero on every SW restart. Chrome terminates
// idle service workers after ~30 s, so the limiter effectively never triggered
// for users solving problems more than 30 s apart.
//
// chrome.storage.session persists for the lifetime of the browser session
// (cleared when the browser closes or the extension is unloaded) — the right
// scope for a rate-limiting window.
const rateLimiter = {
  async check() {
    const now = Date.now();
    let { rl_count: count = 0, rl_window_start: windowStart = now } =
      await chrome.storage.session.get(['rl_count', 'rl_window_start']);

    if (now - windowStart > CONFIG.RATE_LIMIT_WINDOW_MS) {
      count = 0;
      windowStart = now;
    }

    if (count >= CONFIG.RATE_LIMIT_MAX) return false;

    count++;
    await chrome.storage.session.set({ rl_count: count, rl_window_start: windowStart });
    return true;
  },
};

// ─── Single unified Message Handler ──────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ── Popup messages (popup is a trusted extension page) ─────────────────────
  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({
      ci_jwt: message.jwt,
      ci_api_base: message.apiBase || CONFIG.DEFAULT_API_BASE,
    }).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === 'GET_STATUS') {
    // RETRY_QUEUE_KEY is now guaranteed to be initialised here (BUG-BG-001 fix)
    chrome.storage.local.get(['ci_jwt', 'ci_api_base', RETRY_QUEUE_KEY]).then(data => {
      sendResponse({
        authenticated: !!data.ci_jwt,
        apiBase: data.ci_api_base || CONFIG.DEFAULT_API_BASE,
        retryQueueLength: (data[RETRY_QUEUE_KEY] || []).length,
      });
    });
    return true;
  }

  if (message.type === 'CLEAR_AUTH') {
    chrome.storage.local.remove(['ci_jwt']).then(() => sendResponse({ success: true }));
    return true;
  }

  // ── Content script messages ──────────────────────────────────────────────────
  if (message.type === 'UPLOAD_SUBMISSION') {
    // Validate sender is a LeetCode tab (defence-in-depth)
    if (!sender.url?.startsWith('https://leetcode.com/')) {
      console.warn('[CodeInsight BG] Message from unexpected origin:', sender.url);
      sendResponse({ success: false, error: 'Invalid sender origin' });
      return false;
    }

    // Rate limiter is now async (storage-backed) — must await inside the handler
    rateLimiter.check().then(allowed => {
      if (!allowed) {
        console.warn('[CodeInsight BG] Rate limit exceeded, queuing for retry.');
        enqueueForRetry(message.payload);
        sendResponse({ success: false, error: 'Rate limited — queued for retry' });
        return;
      }

      handleUpload(message.payload)
        .then(result => sendResponse(result))
        .catch(err => sendResponse({ success: false, error: err.message }));
    });

    return true; // Keep message channel open for async response
  }

  // Unknown message type — return false (do not keep channel open)
  return false;
});

// ─── Upload Handler ───────────────────────────────────────────────────────────

async function handleUpload(payload) {
  const { jwt, apiBase } = await loadSettings();

  if (!jwt) {
    console.warn('[CodeInsight BG] No JWT found. User must authenticate via popup.');
    return {
      success: false,
      error: 'Not authenticated. Open the CodeInsight extension popup to log in.',
    };
  }

  const nonce = generateNonce();
  const body = { ...payload, _nonce: nonce, _ts: Date.now() };
  const endpoint = `${apiBase}${CONFIG.SUBMISSION_ENDPOINT}`;

  // BUG-BG-002: Keep the service worker alive during the entire upload attempt
  // (including retry sleeps) by pinging a no-op Chrome API every 25 s.
  // Without this Chrome may terminate an idle SW mid-sleep between retries,
  // silently abandoning the in-progress upload.
  const keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      // No-op — the call itself resets Chrome's idle timer for this SW.
    });
  }, CONFIG.SW_KEEPALIVE_MS);

  try {
    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
            'X-CodeInsight-Version': chrome.runtime.getManifest().version,
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`[CodeInsight BG] Upload success (attempt ${attempt}):`, data.message);
          return { success: true, data };
        }

        if (response.status === 401) {
          console.error('[CodeInsight BG] 401 Unauthorized. JWT may be expired.');
          return {
            success: false,
            error: 'Authentication failed. Please re-login via the extension popup.',
          };
        }

        if (response.status === 409) {
          console.log('[CodeInsight BG] Duplicate submission, server already has it.');
          return { success: true, data: { message: 'Duplicate — already recorded' } };
        }

        const errorBody = await response.json().catch(() => ({}));
        console.warn(
          `[CodeInsight BG] Attempt ${attempt} failed: HTTP ${response.status}`,
          errorBody.message
        );

      } catch (networkErr) {
        console.warn(`[CodeInsight BG] Network error on attempt ${attempt}:`, networkErr.message);
      }

      if (attempt < CONFIG.MAX_RETRIES) {
        const delay = CONFIG.RETRY_BASE_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }

    console.error('[CodeInsight BG] All retries failed. Persisting to retry queue.');
    await enqueueForRetry(payload);
    return { success: false, error: 'Upload failed after retries. Will retry automatically.' };

  } finally {
    // Always clear the keep-alive heartbeat once the upload attempt concludes
    clearInterval(keepAliveInterval);
  }
}

// ─── Persistent Retry Queue ───────────────────────────────────────────────────

/**
 * BUG-EXT-001 fix: Added submissionId dedup check before pushing to the queue.
 *
 * Without this, a race between the live-send path and the retry queue was possible:
 *  1. content.js sends UPLOAD_SUBMISSION
 *  2. SW is terminated mid-retry by Chrome's idle policy
 *  3. On next wake, SW processes the retry queue (which may already have this item
 *     from a previous failed attempt)
 *  4. content.js also deletes the submissionId from uploadedSubmissionIds on
 *     message error and may retry the live send path
 *  5. Both paths call handleUpload with different nonces → both succeed against
 *     the backend (the backend's submissionId dedup catches the second one as a
 *     200 duplicate, but two DB round-trips occurred)
 *
 * The fix: skip enqueue if the submissionId is already in the queue.
 */
async function enqueueForRetry(payload) {
  const { [RETRY_QUEUE_KEY]: queue = [] } = await chrome.storage.local.get(RETRY_QUEUE_KEY);

  // BUG-EXT-001: Skip if this submission is already queued
  if (queue.some(item => item.payload.submissionId === payload.submissionId)) {
    console.debug('[CodeInsight BG] Already in retry queue, skipping:', payload.submissionId);
    return;
  }

  if (queue.length >= MAX_QUEUE_SIZE) {
    console.warn('[CodeInsight BG] Retry queue full, dropping oldest item.');
    queue.shift();
  }
  queue.push({ payload, enqueuedAt: Date.now(), attempts: 0 });
  await chrome.storage.local.set({ [RETRY_QUEUE_KEY]: queue });
  ensureRetryAlarm();
}

async function processRetryQueue() {
  const { [RETRY_QUEUE_KEY]: queue = [] } = await chrome.storage.local.get(RETRY_QUEUE_KEY);
  if (queue.length === 0) return;

  console.log(`[CodeInsight BG] Processing retry queue: ${queue.length} items`);
  const remaining = [];

  for (const item of queue) {
    // Drop items older than 24 hours — they're unlikely to succeed and take up space
    if (Date.now() - item.enqueuedAt > 86_400_000) {
      console.warn('[CodeInsight BG] Dropping stale retry item:', item.payload.submissionId);
      continue;
    }

    const result = await handleUpload(item.payload);
    if (!result.success && result.error !== 'Authentication failed. Please re-login via the extension popup.') {
      item.attempts = (item.attempts || 0) + 1;
      if (item.attempts < 10) remaining.push(item);
    }
  }

  await chrome.storage.local.set({ [RETRY_QUEUE_KEY]: remaining });
}

function ensureRetryAlarm() {
  chrome.alarms.get(CONFIG.RETRY_ALARM, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(CONFIG.RETRY_ALARM, {
        periodInMinutes: CONFIG.RETRY_ALARM_PERIOD_MINUTES,
      });
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === CONFIG.RETRY_ALARM) {
    processRetryQueue();
  }
});

chrome.runtime.onStartup.addListener(ensureRetryAlarm);
chrome.runtime.onInstalled.addListener(ensureRetryAlarm);

// ─── Settings Storage ─────────────────────────────────────────────────────────

async function loadSettings() {
  const data = await chrome.storage.local.get(['ci_jwt', 'ci_api_base']);
  return {
    jwt: data.ci_jwt || null,
    apiBase: data.ci_api_base || CONFIG.DEFAULT_API_BASE,
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function generateNonce() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
