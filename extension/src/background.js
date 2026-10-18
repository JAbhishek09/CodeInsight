/**
 * background.js — CodeInsight Service Worker
 * v1.4.0
 *
 * bridge.js is a STATIC content script (declared in manifest.json, same as
 * content.js), not dynamically injected via chrome.scripting. Dynamic
 * injection added complexity (multiple injections per page load due to
 * LeetCode's SPA firing tabs.onUpdated 'complete' more than once) without
 * fixing delivery. Static declaration is Chrome's standard pattern for
 * content scripts that need to coexist across worlds.
 *
 * COMMUNICATION: content.js (world: MAIN) sends
 * window.postMessage({ __ci: true, payload }), which bridge.js (default
 * ISOLATED world, same tab) receives via window.addEventListener('message')
 * and forwards here via chrome.runtime.sendMessage.
 *
 * BUG FIXED IN v1.4.0 — "message channel closed before a response was
 * received":
 * ─────────────────────────────────────────────────────────────────────────
 * Observed live: this fires right after "[CodeInsight] submit response
 * captured" is immediately followed by "[CodeInsight] URL nav detected" —
 * i.e. LeetCode's SPA navigates from /problems/<slug>/ to
 * /problems/<slug>/submissions/<id>/ WHILE our UPLOAD_SUBMISSION message is
 * still in flight to the service worker.
 *
 * Root cause: our onMessage listener returns `true` (promising an async
 * sendResponse call via the rateLimiter.check().then(...) chain), but
 * handleUpload() can take several seconds (up to 3 retries with exponential
 * back-off, each attempt with its own network round-trip). Chrome's
 * extension messaging has NO built-in timeout, but the SENDING side's
 * message port closes if the originating execution context (the content
 * script's world in that specific frame) is torn down before the response
 * arrives. SPA navigations that change the URL via the History API do not
 * destroy the tab, but they CAN tear down and recreate the MAIN-world
 * script context in some Chrome versions when combined with significant
 * DOM replacement — which is exactly what LeetCode's result-page transition
 * does. When that happens, the port behind bridge.js's sendMessage call is
 * gone, and our (still-running) sendResponse call has nothing listening on
 * the other end. Chrome's runtime surfaces this as the warning shown.
 *
 * This is **not** a silent-failure bug for OUR retry logic — handleUpload's
 * fetch() to our own backend already completed by the time sendResponse
 * would have run (the work itself isn't lost), but two real problems exist:
 *   1. The unhandled-promise-style console error is alarming and obscures
 *      real failures in logs.
 *   2. Without a guard, a slow handleUpload() racing a navigation could in
 *      principle still drop the QUEUEING fallback if an exception path
 *      were ever added that depended on sendResponse's return value (it
 *      currently doesn't, but this is fragile to maintain).
 *
 * FIX:
 *   a) Wrap sendResponse in a guarded helper that no-ops if called after
 *      the message port might already be closed, swallowing Chrome's
 *      benign "Receiving end does not exist" / port-closed errors instead
 *      of letting them surface as uncaught warnings.
 *   b) Decouple the actual upload work from the response callback: the
 *      fetch + retry logic in handleUpload() always completes and persists
 *      its own result (success, or enqueueForRetry on failure) regardless
 *      of whether sendResponse ever successfully reaches the tab. The
 *      message response becomes a best-effort UI nicety, not a
 *      correctness dependency.
 *   c) bridge.js's sendMessage callback already treats chrome.runtime.lastError
 *      as a soft warning (not thrown) — confirmed correct, no change needed
 *      there beyond a clarifying comment.
 */

// ─── Constants ────────────────────────────────────────────────────────────────
const RETRY_QUEUE_KEY = 'ci_retry_queue';
const MAX_QUEUE_SIZE  = 50;

const CONFIG = {
  DEFAULT_API_BASE:           'http://localhost:5000',
  SUBMISSION_ENDPOINT:        '/api/extensions/leetcode/submission',
  MAX_RETRIES:                3,
  RETRY_BASE_MS:              1000,
  RATE_LIMIT_MAX:             10,
  RATE_LIMIT_WINDOW_MS:       60_000,
  RETRY_ALARM:                'codeinsight-retry-queue',
  RETRY_ALARM_PERIOD_MINUTES: 1,
  SW_KEEPALIVE_MS:            25_000,
  REQUEST_TIMEOUT_MS:         15_000,
};

// ─── Rate Limiter (chrome.storage.session-backed) ─────────────────────────────
const rateLimiter = {
  async check() {
    const now = Date.now();
    let { rl_count: count = 0, rl_window_start: windowStart = now } =
      await chrome.storage.session.get(['rl_count', 'rl_window_start']);

    if (now - windowStart > CONFIG.RATE_LIMIT_WINDOW_MS) {
      count = 0; windowStart = now;
    }
    if (count >= CONFIG.RATE_LIMIT_MAX) return false;
    count++;
    await chrome.storage.session.set({ rl_count: count, rl_window_start: windowStart });
    return true;
  },
};

/**
 * Wraps a sendResponse call so that calling it after the message port has
 * already closed (because the sending tab navigated, reloaded, or closed)
 * never throws or surfaces an uncaught error. This is the (b) fix above:
 * the response is now purely best-effort feedback to the tab's console/UI,
 * never a correctness dependency for the upload pipeline itself.
 */
function safeSendResponse(sendResponse, value) {
  try {
    sendResponse(value);
  } catch (err) {
    // "Attempting to use a disconnected port object" or similar — the tab's
    // message port closed (e.g. SPA navigation tore down the MAIN-world
    // context) before we could respond. The upload itself already
    // completed or was queued by this point; this is purely cosmetic.
    console.debug('[CodeInsight BG] sendResponse skipped (port closed):', err.message);
  }
}

// ─── Message Handler ──────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // Settings may only be changed from extension pages (the popup), never from
  // a content script running inside a web page.
  const fromExtensionPage = !sender.tab && sender.id === chrome.runtime.id;
  if ((message.type === 'SAVE_SETTINGS' || message.type === 'CLEAR_AUTH') && !fromExtensionPage) {
    safeSendResponse(sendResponse, { success: false, error: 'Not allowed from this context' });
    return false;
  }

  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({
      ci_jwt:     message.jwt,
      ci_api_base: message.apiBase || CONFIG.DEFAULT_API_BASE,
    }).then(() => {
      safeSendResponse(sendResponse, { success: true });
      processRetryQueue(); // retry anything queued while logged out
    });
    return true;
  }

  if (message.type === 'GET_STATUS') {
    chrome.storage.local.get(['ci_jwt', 'ci_api_base', RETRY_QUEUE_KEY]).then(data => {
      safeSendResponse(sendResponse, {
        authenticated:    !!data.ci_jwt,
        apiBase:          data.ci_api_base || CONFIG.DEFAULT_API_BASE,
        retryQueueLength: (data[RETRY_QUEUE_KEY] || []).length,
      });
    });
    return true;
  }

  if (message.type === 'CLEAR_AUTH') {
    chrome.storage.local.remove(['ci_jwt']).then(() => safeSendResponse(sendResponse, { success: true }));
    return true;
  }

  if (message.type === 'UPLOAD_SUBMISSION') {
    if (!sender.url?.startsWith('https://leetcode.com/')) {
      console.warn('[CodeInsight BG] Rejected message from:', sender.url);
      safeSendResponse(sendResponse, { success: false, error: 'Invalid sender origin' });
      return false;
    }

    console.log('[CodeInsight BG] Received UPLOAD_SUBMISSION for subId:', message.payload?.submissionId);

    // FIX (b): handleUpload's own work (fetch + retries + enqueueForRetry on
    // failure) is fully self-contained and persists its outcome regardless
    // of whether sendResponse below ever reaches a live message port. If the
    // sending tab has already navigated away by the time this resolves,
    // safeSendResponse simply no-ops instead of throwing/warning.
    rateLimiter.check().then(allowed => {
      if (!allowed) {
        console.warn('[CodeInsight BG] Rate limited — queuing.');
        enqueueForRetry(message.payload);
        safeSendResponse(sendResponse, { success: false, error: 'Rate limited — queued for retry' });
        return;
      }
      handleUpload(message.payload)
        .then(result => safeSendResponse(sendResponse, result))
        .catch(err  => safeSendResponse(sendResponse, { success: false, error: err.message }));
    });
    return true;
  }

  // Pattern guesses and feedback (picker.js on LeetCode problem pages)
  if (message.type === 'SUBMIT_PREDICTION' || message.type === 'GET_FEEDBACK') {
    if (!sender.url?.startsWith('https://leetcode.com/')) {
      safeSendResponse(sendResponse, { success: false, error: 'Invalid sender origin' });
      return false;
    }
    const slug = String(message.slug || '');
    const req = message.type === 'SUBMIT_PREDICTION'
      ? apiRequest('POST', '/api/predictions', { slug, predicted: message.predicted, source: 'extension' })
      : apiRequest('GET', `/api/predictions/latest?slug=${encodeURIComponent(slug)}`);
    req.then((r) => safeSendResponse(sendResponse, r));
    return true;
  }

  return false;
});

/** Authenticated JSON request to the CodeInsight API. Never throws. */
async function apiRequest(method, path, body) {
  const { jwt, apiBase } = await loadSettings();
  if (!jwt) return { success: false, error: 'Sign in to the CodeInsight extension first.' };
  try {
    const res = await fetch(`${apiBase}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT_MS),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, error: json.message || `HTTP ${res.status}` };
    return { success: true, data: json.data };
  } catch (err) {
    return { success: false, error: err.name === 'TimeoutError' ? 'CodeInsight didn’t respond.' : err.message };
  }
}

// ─── Upload Handler ───────────────────────────────────────────────────────────
/**
 * Uploads one submission. The payload is persisted to the retry queue BEFORE
 * any network work, and removed only once the backend has accepted it (or
 * rejected it permanently). So if the service worker is killed mid-upload,
 * the alarm-driven retry queue still picks it up.
 */
async function handleUpload(payload) {
  await enqueueForRetry(payload);
  const result = await attemptUpload(payload);
  if (result.success || result.permanent) await removeFromQueue(payload.submissionId);
  return result;
}

/**
 * Tries to POST a submission up to MAX_RETRIES times. Never touches the queue.
 * Returns { success, data } | { success:false, error, permanent? }.
 */
async function attemptUpload(payload) {
  const { jwt, apiBase } = await loadSettings();
  if (!jwt) {
    console.error('[CodeInsight BG] No JWT in storage — open popup and log in.');
    return { success: false, error: 'Not authenticated. Open popup to log in.' };
  }

  const endpoint = `${apiBase}${CONFIG.SUBMISSION_ENDPOINT}`;
  console.log('[CodeInsight BG] POSTing to', endpoint, 'subId:', payload.submissionId);

  const keepAlive = setInterval(
    () => chrome.runtime.getPlatformInfo(() => {}),
    CONFIG.SW_KEEPALIVE_MS
  );

  try {
    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      try {
        // Fresh nonce per attempt: the backend consumes a nonce before writing,
        // so re-sending the same one after a failed write would get a 409.
        const body = { ...payload, _nonce: generateNonce(), _ts: Date.now() };
        const res = await fetch(endpoint, {
          method:  'POST',
          headers: {
            'Content-Type':           'application/json',
            'Authorization':          `Bearer ${jwt}`,
            'X-CodeInsight-Version':  chrome.runtime.getManifest().version,
          },
          body:   JSON.stringify(body),
          signal: AbortSignal.timeout(CONFIG.REQUEST_TIMEOUT_MS),
        });

        if (res.ok) {
          const data = await res.json();
          console.log(`[CodeInsight BG] Upload OK (attempt ${attempt}):`, data.message);
          return { success: true, data };
        }
        if (res.status === 401) {
          console.error('[CodeInsight BG] 401 — JWT rejected by backend.');
          return { success: false, error: 'Auth failed. Re-login in extension popup.' };
        }
        const errBody = await res.json().catch(() => ({}));
        console.warn(`[CodeInsight BG] Attempt ${attempt} HTTP ${res.status}:`, errBody.message || errBody);

        // Other 4xx (validation etc.) will never succeed on retry — except 409
        // (nonce clash, retry with a new nonce) and 429 (rate limited).
        if (res.status >= 400 && res.status < 500 && res.status !== 409 && res.status !== 429) {
          return { success: false, permanent: true, error: errBody.message || `HTTP ${res.status}` };
        }

      } catch (netErr) {
        console.warn(`[CodeInsight BG] Network error attempt ${attempt}:`, netErr.message);
      }

      if (attempt < CONFIG.MAX_RETRIES) {
        await sleep(CONFIG.RETRY_BASE_MS * Math.pow(2, attempt - 1));
      }
    }

    return { success: false, error: 'Upload failed after retries. Will retry automatically.' };

  } finally {
    clearInterval(keepAlive);
  }
}

// ─── Retry Queue ──────────────────────────────────────────────────────────────
// All queue read-modify-writes go through this mutex so concurrent uploads and
// the alarm-driven flush can't overwrite each other's changes.
let queueLock = Promise.resolve();
function withQueue(fn) {
  const run = queueLock.then(async () => {
    const { [RETRY_QUEUE_KEY]: queue = [] } = await chrome.storage.local.get(RETRY_QUEUE_KEY);
    const next = await fn(queue);
    if (next) await chrome.storage.local.set({ [RETRY_QUEUE_KEY]: next });
  });
  queueLock = run.catch(() => {});
  return run;
}

async function enqueueForRetry(payload) {
  await withQueue(queue => {
    if (queue.some(i => i.payload.submissionId === payload.submissionId)) return null;
    if (queue.length >= MAX_QUEUE_SIZE) queue.shift();
    queue.push({ payload, enqueuedAt: Date.now(), attempts: 0 });
    return queue;
  });
  ensureRetryAlarm();
}

function removeFromQueue(submissionId) {
  return withQueue(queue => queue.filter(i => i.payload.submissionId !== submissionId));
}

let flushing = false;
async function processRetryQueue() {
  if (flushing) return;
  flushing = true;
  try {
    const { [RETRY_QUEUE_KEY]: snapshot = [] } =
      await chrome.storage.local.get(RETRY_QUEUE_KEY);
    if (!snapshot.length) return;

    console.log(`[CodeInsight BG] Retry queue: ${snapshot.length} items`);

    for (const item of snapshot) {
      const id = item.payload.submissionId;
      if (Date.now() - item.enqueuedAt > 86_400_000) { // drop after 24h
        await removeFromQueue(id);
        continue;
      }
      const result = await attemptUpload(item.payload);
      if (result.success || result.permanent) {
        await removeFromQueue(id);
        continue;
      }
      // Not logged in / token rejected: keep the item (without burning an
      // attempt) and stop — every other item would fail the same way.
      if (result.error?.includes('Auth') || result.error?.includes('Not authenticated')) break;

      await withQueue(queue => {
        const entry = queue.find(i => i.payload.submissionId === id);
        if (!entry) return null;
        entry.attempts = (entry.attempts || 0) + 1;
        return entry.attempts < 10 ? queue : queue.filter(i => i !== entry);
      });
    }
  } finally {
    flushing = false;
  }
}

function ensureRetryAlarm() {
  chrome.alarms.get(CONFIG.RETRY_ALARM, alarm => {
    if (!alarm) chrome.alarms.create(CONFIG.RETRY_ALARM,
      { periodInMinutes: CONFIG.RETRY_ALARM_PERIOD_MINUTES });
  });
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === CONFIG.RETRY_ALARM) processRetryQueue();
});

chrome.runtime.onStartup.addListener(ensureRetryAlarm);
chrome.runtime.onInstalled.addListener(ensureRetryAlarm);

// ─── Settings & Utilities ─────────────────────────────────────────────────────
async function loadSettings() {
  const d = await chrome.storage.local.get(['ci_jwt', 'ci_api_base']);
  return { jwt: d.ci_jwt || null, apiBase: d.ci_api_base || CONFIG.DEFAULT_API_BASE };
}

function generateNonce() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
