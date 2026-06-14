/**
 * content.js — CodeInsight LeetCode Content Script
 *
 * ROOT CAUSE FIX (June 2026):
 * Modern LeetCode NO LONGER navigates to /problems/<slug>/submissions/<id>/
 * after a submission. The result is shown inline on the same page via a React
 * state update — the URL stays at /problems/<slug>/description/.
 * The previous URL-change detection (pushState patch + SUBMISSION_URL_RE) never
 * fired because there was no URL change to detect.
 *
 * NEW STRATEGY — three complementary triggers:
 *  1. XHR/Fetch intercept: intercept LeetCode's own submission API call
 *     POST /problems/<slug>/submit/  which returns { submission_id: N }.
 *     This is the most reliable signal — fires before the DOM updates.
 *
 *  2. MutationObserver on result panel: watch for
 *     [data-e2e-locator="submission-result"] to appear in the DOM.
 *     Fallback for cases where the fetch intercept misses (e.g. cached results).
 *
 *  3. URL-change detection (KEPT): still catches /submissions/<id>/ navigation
 *     on older LeetCode layouts and direct URL visits.
 *
 * The submission_id from the XHR response is used as the authoritative ID.
 * For MutationObserver trigger, the submission ID is extracted from the URL
 * or from the result panel DOM.
 */

// ─── Constants ─────────────────────────────────────────────────────────────────────────────

const SUBMISSION_URL_RE = /\/problems\/([^/]+)\/submissions\/(\d+)\/?/;
const SUBMIT_API_RE     = /\/problems\/([^/]+)\/submit\//;
const MAX_EXTRACTION_RETRIES = 6;
const RETRY_BASE_MS          = 800;
const OBSERVER_TIMEOUT_MS    = 20_000;
const QUICK_CHECK_MS         = 600;

// ─── Session deduplication ────────────────────────────────────────────────────────────────────────
const uploadedSubmissionIds = new Set();

// ─── STRATEGY 1: XHR + Fetch intercept ──────────────────────────────────────────────────────
//
// Intercept LeetCode's POST /problems/<slug>/submit/ API call.
// The response JSON contains { submission_id: <number> } which we use
// as the authoritative submission ID, then wait for the result DOM to render.
//
// WHY: Modern LeetCode shows results inline (no URL change). The XHR intercept
// fires BEFORE the DOM updates, giving us the submission ID immediately so
// we can deduplicate and then watch for the result to appear.

(function interceptFetch() {
  const _fetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await _fetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      const match = SUBMIT_API_RE.exec(url);

      if (match && (args[1]?.method || '').toUpperCase() === 'POST') {
        const slug = match[1];
        // Clone so we don't consume the body — the page still needs to read it
        const cloned = response.clone();
        cloned.json().then(data => {
          const submissionId = String(data?.submission_id || data?.id || '');
          if (!submissionId || uploadedSubmissionIds.has(submissionId)) return;
          console.log('[CodeInsight] Fetch intercept: submission', submissionId, 'for', slug);
          onSubmissionDetected(slug, submissionId);
        }).catch(() => {});
      }
    } catch (_) {}

    return response;
  };
})();

(function interceptXHR() {
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._ciMethod = method;
    this._ciUrl    = url;
    return _open.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      try {
        const match = SUBMIT_API_RE.exec(this._ciUrl || '');
        if (match && (this._ciMethod || '').toUpperCase() === 'POST') {
          const slug = match[1];
          const data = JSON.parse(this.responseText);
          const submissionId = String(data?.submission_id || data?.id || '');
          if (!submissionId || uploadedSubmissionIds.has(submissionId)) return;
          console.log('[CodeInsight] XHR intercept: submission', submissionId, 'for', slug);
          onSubmissionDetected(slug, submissionId);
        }
      } catch (_) {}
    });
    return _send.apply(this, args);
  };
})();

// ─── Core: called when a new submission is detected by any strategy ──────────────────

function onSubmissionDetected(problemSlug, submissionId) {
  if (uploadedSubmissionIds.has(submissionId)) {
    console.debug('[CodeInsight] Already uploaded submissionId:', submissionId);
    return;
  }

  console.log('[CodeInsight] Submission detected. slug:', problemSlug, 'id:', submissionId);
  resetNextDataCache();

  let resolved = false;

  // MutationObserver: wait for the result panel to appear in the DOM
  const observer = new MutationObserver(() => {
    if (resolved) return;
    const data = extractSubmissionData(problemSlug, submissionId);
    if (data) {
      resolved = true;
      observer.disconnect();
      dispatchUpload(data, submissionId);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Quick-check: result may already be in DOM if intercept fired late
  setTimeout(() => {
    if (resolved) return;
    const data = extractSubmissionData(problemSlug, submissionId);
    if (data) {
      resolved = true;
      observer.disconnect();
      dispatchUpload(data, submissionId);
    }
  }, QUICK_CHECK_MS);

  // Hard timeout: fall back to retry loop
  setTimeout(() => {
    if (resolved) return;
    observer.disconnect();
    if (!uploadedSubmissionIds.has(submissionId)) {
      console.debug('[CodeInsight] Observer timed out, falling back to retry loop.');
      extractAndUpload(problemSlug, submissionId, 0);
    }
  }, OBSERVER_TIMEOUT_MS);
}

// ─── STRATEGY 2: Global MutationObserver for result panel ───────────────────────────
//
// Watches for [data-e2e-locator="submission-result"] to appear anywhere in
// the DOM. When it does, extract the slug from the current URL and the
// submission ID from the result panel or URL.
// This is a fallback in case the fetch/XHR intercept misses.

let _globalObserver = null;

function startGlobalResultObserver() {
  if (_globalObserver) return;

  _globalObserver = new MutationObserver(() => {
    const resultEl = document.querySelector('[data-e2e-locator="submission-result"]');
    if (!resultEl) return;

    // Extract slug from current URL
    const urlMatch = /\/problems\/([^/]+)/.exec(location.pathname);
    if (!urlMatch) return;
    const slug = urlMatch[1];

    // Try to extract submission ID from URL first
    const subUrlMatch = SUBMISSION_URL_RE.exec(location.href);
    // If URL has the ID use it; otherwise generate a synthetic one from content
    const submissionId = subUrlMatch?.[2] ||
      // Fallback: use a hash of slug+verdict+time as a dedup key
      `synthetic_${slug}_${Date.now()}`;

    if (uploadedSubmissionIds.has(submissionId)) return;

    console.log('[CodeInsight] Result panel appeared. slug:', slug, 'id:', submissionId);
    // Don’t call onSubmissionDetected (would set up another observer);
    // extract immediately since the result is already in the DOM
    const data = extractSubmissionData(slug, submissionId);
    if (data) {
      dispatchUpload(data, submissionId);
    } else {
      // Data not fully rendered yet — retry loop
      extractAndUpload(slug, submissionId, 0);
    }
  });

  _globalObserver.observe(document.body, { childList: true, subtree: true });
  console.debug('[CodeInsight] Global result observer started.');
}

startGlobalResultObserver();

// ─── STRATEGY 3: URL-change detection (kept for backward compat) ───────────────────

let currentUrl = location.href;

function onUrlChange(newUrl) {
  const match = SUBMISSION_URL_RE.exec(newUrl);
  if (!match) return;
  const problemSlug = match[1];
  const submissionId = match[2];
  onSubmissionDetected(problemSlug, submissionId);
}

(function patchHistory() {
  const _push    = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);

  history.pushState = function(...args) {
    _push(...args);
    const newUrl = location.href;
    if (newUrl !== currentUrl) { currentUrl = newUrl; onUrlChange(newUrl); }
  };

  history.replaceState = function(...args) {
    _replace(...args);
    const newUrl = location.href;
    if (newUrl !== currentUrl) { currentUrl = newUrl; onUrlChange(newUrl); }
  };
})();

window.addEventListener('popstate', () => {
  const newUrl = location.href;
  if (newUrl !== currentUrl) { currentUrl = newUrl; onUrlChange(newUrl); }
});

onUrlChange(location.href);

// ─── Upload dispatcher ─────────────────────────────────────────────────────────────────────────────

function dispatchUpload(data, submissionId) {
  uploadedSubmissionIds.add(submissionId);
  console.log('[CodeInsight] Dispatching upload:', data.verdict, data.language, `${data.code.length} chars`);

  chrome.runtime.sendMessage({ type: 'UPLOAD_SUBMISSION', payload: data }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[CodeInsight] Message error:', chrome.runtime.lastError.message);
      uploadedSubmissionIds.delete(submissionId);
      return;
    }
    if (response?.success) {
      console.log('[CodeInsight] Upload confirmed.');
    } else {
      console.warn('[CodeInsight] Upload failed:', response?.error);
      uploadedSubmissionIds.delete(submissionId);
    }
  });
}

// ─── Retry loop ─────────────────────────────────────────────────────────────────────────────

async function extractAndUpload(problemSlug, submissionId, attempt) {
  try {
    const data = extractSubmissionData(problemSlug, submissionId);
    if (!data) {
      if (attempt < MAX_EXTRACTION_RETRIES) {
        const delay = RETRY_BASE_MS * Math.pow(1.6, attempt);
        console.debug(`[CodeInsight] DOM not ready, retry ${attempt + 1} in ${Math.round(delay)}ms`);
        setTimeout(() => extractAndUpload(problemSlug, submissionId, attempt + 1), delay);
      } else {
        console.warn('[CodeInsight] Extraction failed after max retries.');
      }
      return;
    }
    dispatchUpload(data, submissionId);
  } catch (err) {
    console.error('[CodeInsight] Unexpected extraction error:', err);
  }
}

// ─── Extraction ─────────────────────────────────────────────────────────────────────────────

function extractSubmissionData(problemSlug, submissionId) {
  const title   = extractTitle(problemSlug);
  if (!title) return null;
  const verdict = extractVerdict();
  if (!verdict) return null;
  const language = extractLanguage();
  if (!language) return null;
  const code = extractCode();
  if (!code || code.trim().length < 5) return null;

  return {
    problemSlug,
    submissionId,
    title,
    verdict:     normaliseVerdict(verdict),
    language:    normaliseLanguage(language),
    code,
    submittedAt: new Date().toISOString(),
  };
}

function extractTitle(slug) {
  const titleEl = document.querySelector('title');
  if (titleEl?.textContent) {
    const raw      = titleEl.textContent.trim();
    const stripped = raw.replace(/\s*-\s*LeetCode.*$/i, '').trim();
    if (stripped.length > 0 && stripped !== 'LeetCode') return stripped;
  }
  const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
  if (ogTitle) return ogTitle.replace(/\s*-\s*LeetCode.*$/i, '').trim();
  return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}

function extractVerdict() {
  // Primary: data-e2e-locator (present in both old and new LC layouts)
  const el = document.querySelector('[data-e2e-locator="submission-result"]');
  if (el?.textContent?.trim()) return el.textContent.trim();

  // Secondary: colour-coded result text elements
  for (const sel of ['.text-green-s', '.text-red-s', '[class*="result-state"]', '[class*="status-"]']) {
    const found = document.querySelector(sel);
    if (found?.textContent?.trim()) return found.textContent.trim();
  }

  // Tertiary: body text scan
  const KNOWN = ['Accepted','Wrong Answer','Time Limit Exceeded','Memory Limit Exceeded','Runtime Error','Compile Error','Output Limit Exceeded'];
  const body = document.body.innerText;
  for (const v of KNOWN) { if (body.includes(v)) return v; }

  return null;
}

function extractLanguage() {
  for (const sel of ['[data-e2e-locator="submission-lang"]','button[id*="lang"]','[class*="lang-select"]']) {
    const el = document.querySelector(sel);
    if (el?.textContent?.trim()) return el.textContent.trim();
  }

  // New LC: language shown in the result panel header
  const resultHeader = document.querySelector('[class*="ResultHeader"]');
  if (resultHeader?.textContent) {
    const langs = ['Python3','Python','C++','Java','JavaScript','TypeScript','Go','Rust','C#','C','Swift','Kotlin','Scala','Ruby','PHP'];
    for (const l of langs) { if (resultHeader.textContent.includes(l)) return l; }
  }

  const nextData = getNextData();
  if (nextData) {
    const lang = nextData?.props?.pageProps?.submissionData?.lang ||
                 nextData?.props?.pageProps?.lang ||
                 nextData?.query?.lang;
    if (lang) return lang;
  }

  return null;
}

function extractCode() {
  // A: __NEXT_DATA__
  const nextData = getNextData();
  if (nextData) {
    const code = nextData?.props?.pageProps?.submissionData?.code ||
                 nextData?.props?.pageProps?.code ||
                 nextData?.query?.submissionData?.code;
    if (code && code.trim().length > 5) return code;
  }

  // B: React fiber walk
  const reactCode = extractFromReactFiber();
  if (reactCode) return reactCode;

  // C: CodeMirror / Monaco DOM
  const cmCode = extractFromCodeMirror();
  if (cmCode) return cmCode;

  const monacoCode = extractFromMonaco();
  if (monacoCode) return monacoCode;

  return null;
}

let _nextDataCache = undefined;
function resetNextDataCache() { _nextDataCache = undefined; }
function getNextData() {
  if (_nextDataCache !== undefined) return _nextDataCache;
  try {
    const el = document.getElementById('__NEXT_DATA__');
    _nextDataCache = el ? JSON.parse(el.textContent) : null;
  } catch { _nextDataCache = null; }
  return _nextDataCache;
}

function extractFromReactFiber() {
  try {
    const root = document.getElementById('__next') || document.getElementById('app');
    if (!root) return null;
    const fiberKey = Object.keys(root).find(k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'));
    if (!fiberKey) return null;
    const stack = [root[fiberKey]];
    let visited = 0;
    while (stack.length > 0 && visited < 2000) {
      const fiber = stack.pop(); visited++;
      if (!fiber) continue;
      const props = fiber.memoizedProps || fiber.pendingProps;
      if (props?.submissionData?.code) return props.submissionData.code;
      if (props?.code && typeof props.code === 'string' && props.code.length > 20) {
        if (props.code.includes('\n') || props.code.includes(';') || props.code.includes('{')) return props.code;
      }
      if (fiber.sibling) stack.push(fiber.sibling);
      if (fiber.child)   stack.push(fiber.child);
    }
  } catch {}
  return null;
}

function extractFromCodeMirror() {
  try {
    const lines = document.querySelectorAll('.CodeMirror-line, .cm-line');
    if (lines.length === 0) return null;
    return Array.from(lines).map(l => l.textContent).join('\n');
  } catch { return null; }
}

function extractFromMonaco() {
  try {
    const lines = document.querySelectorAll('.view-line');
    if (lines.length === 0) return null;
    console.warn('[CodeInsight] Monaco DOM fallback — code may differ from actual submission.');
    return Array.from(lines).map(l => l.textContent).join('\n');
  } catch { return null; }
}

// ─── Normalisation ─────────────────────────────────────────────────────────────────────────────

function normaliseVerdict(raw) {
  const s = raw.toLowerCase();
  if (s.includes('accepted')) return 'Accepted';
  if (s.includes('wrong'))    return 'Wrong Answer';
  if (s.includes('time limit'))   return 'TLE';
  if (s.includes('memory limit')) return 'MLE';
  if (s.includes('output limit')) return 'MLE';
  if (s.includes('runtime'))  return 'RE';
  if (s.includes('compile'))  return 'CE';
  console.warn('[CodeInsight] Unrecognised verdict:', raw);
  return 'Pending';
}

function normaliseLanguage(raw) {
  const s = raw.toLowerCase().trim();
  const MAP = {
    'c++':'cpp','cpp':'cpp','java':'java',
    'python':'python3','python3':'python3',
    'c#':'csharp','csharp':'csharp',
    'javascript':'javascript','js':'javascript',
    'typescript':'typescript','ts':'typescript',
    'go':'golang','golang':'golang',
    'rust':'rust','kotlin':'kotlin','swift':'swift',
    'scala':'scala','ruby':'ruby','php':'php','c':'c',
  };
  for (const [key, val] of Object.entries(MAP)) { if (s.includes(key)) return val; }
  return s;
}


// // ─── Constants ────────────────────────────────────────────────────────────────

// /** Submission result URL pattern: /problems/<slug>/submissions/<id>/ */
// const SUBMISSION_URL_RE = /\/problems\/([^/]+)\/submissions\/(\d+)\/?/;

// /** Maximum retries when the DOM hasn't fully rendered yet (fallback path). */
// const MAX_EXTRACTION_RETRIES = 6;

// /** Delay between retries (exponential back-off base). */
// const RETRY_BASE_MS = 800;

// /**
//  * How long the MutationObserver waits before giving up and handing off to
//  * the timed retry loop. 15 s covers even very slow connections.
//  */
// const OBSERVER_TIMEOUT_MS = 15_000;

// /**
//  * Quick-check delay after URL change: attempt extraction immediately on a
//  * cached/fast page before the observer fires.
//  */
// const QUICK_CHECK_MS = 500;

// // ─── Session-level deduplication ─────────────────────────────────────────────
// // Persists for the lifetime of the tab. Prevents double-sends when the user
// // refreshes or the MutationObserver fires multiple times for the same URL.
// const uploadedSubmissionIds = new Set();

// // ─── SPA Navigation Detection ─────────────────────────────────────────────────
// // LeetCode is a React SPA: full page reloads are rare. We intercept history API
// // calls and also watch for popstate to cover back/forward navigation.

// let currentUrl = location.href;

// /**
//  * FIX BUG-EXT-003: Replace flat setTimeout with MutationObserver fast-path.
//  *
//  * Three-tier strategy:
//  *  Tier 1 — 500 ms quick-check: works on cached/instant renders.
//  *  Tier 2 — MutationObserver: fires as soon as the verdict element appears in
//  *            the DOM, regardless of how long that takes.
//  *  Tier 3 — 15 s hard timeout: disconnects the observer and falls back to the
//  *            exponential-backoff retry loop (extractAndUpload) as before.
//  */
// function onUrlChange(newUrl) {
//   const match = SUBMISSION_URL_RE.exec(newUrl);
//   if (!match) return;

//   const problemSlug = match[1];
//   const submissionId = match[2];

//   if (uploadedSubmissionIds.has(submissionId)) {
//     console.debug('[CodeInsight] Already uploaded submissionId:', submissionId);
//     return;
//   }

//   console.log('[CodeInsight] Submission page detected. slug:', problemSlug, 'id:', submissionId);

//   // Reset __NEXT_DATA__ cache so stale data from a prior page is never reused.
//   resetNextDataCache();

//   let resolved = false;

//   // ── Tier 2: MutationObserver ───────────────────────────────────────────────
//   const observer = new MutationObserver(() => {
//     if (resolved) return;
//     const data = extractSubmissionData(problemSlug, submissionId);
//     if (data) {
//       resolved = true;
//       observer.disconnect();
//       dispatchUpload(data, submissionId);
//     }
//   });
//   observer.observe(document.body, { childList: true, subtree: true });

//   // ── Tier 1: Quick-check after 500 ms (handles fast/cached renders) ─────────
//   setTimeout(() => {
//     if (resolved) return;
//     const data = extractSubmissionData(problemSlug, submissionId);
//     if (data) {
//       resolved = true;
//       observer.disconnect();
//       dispatchUpload(data, submissionId);
//     }
//   }, QUICK_CHECK_MS);

//   // ── Tier 3: Hard timeout — hand off to retry loop ──────────────────────────
//   setTimeout(() => {
//     if (resolved) return;
//     observer.disconnect();
//     // Only proceed if still not uploaded (guard against racing quick-check)
//     if (!uploadedSubmissionIds.has(submissionId)) {
//       console.debug('[CodeInsight] Observer timed out, falling back to retry loop.');
//       extractAndUpload(problemSlug, submissionId, 0);
//     }
//   }, OBSERVER_TIMEOUT_MS);
// }

// /**
//  * Send a successfully extracted payload to the background worker.
//  * Marks the submissionId as seen first so that concurrent observer fires
//  * (possible if MutationObserver fires multiple times) do not double-send.
//  */
// function dispatchUpload(data, submissionId) {
//   uploadedSubmissionIds.add(submissionId);
//   console.log('[CodeInsight] Dispatching upload:', data.verdict, data.language, `${data.code.length} chars`);

//   chrome.runtime.sendMessage({ type: 'UPLOAD_SUBMISSION', payload: data }, (response) => {
//     if (chrome.runtime.lastError) {
//       console.error('[CodeInsight] Message error:', chrome.runtime.lastError.message);
//       uploadedSubmissionIds.delete(submissionId);
//       return;
//     }
//     if (response?.success) {
//       console.log('[CodeInsight] Upload confirmed by background worker.');
//     } else {
//       console.warn('[CodeInsight] Background worker reported failure:', response?.error);
//       uploadedSubmissionIds.delete(submissionId);
//     }
//   });
// }

// // Monkey-patch history.pushState and replaceState
// (function patchHistory() {
//   const _push = history.pushState.bind(history);
//   const _replace = history.replaceState.bind(history);

//   history.pushState = function (...args) {
//     _push(...args);
//     const newUrl = location.href;
//     if (newUrl !== currentUrl) {
//       currentUrl = newUrl;
//       onUrlChange(newUrl);
//     }
//   };

//   history.replaceState = function (...args) {
//     _replace(...args);
//     const newUrl = location.href;
//     if (newUrl !== currentUrl) {
//       currentUrl = newUrl;
//       onUrlChange(newUrl);
//     }
//   };
// })();

// window.addEventListener('popstate', () => {
//   const newUrl = location.href;
//   if (newUrl !== currentUrl) {
//     currentUrl = newUrl;
//     onUrlChange(newUrl);
//   }
// });

// // Handle the initial page load (user navigated directly to a result URL)
// onUrlChange(location.href);

// // ─── Extraction Orchestrator (fallback retry loop) ────────────────────────────

// /**
//  * Fallback when the MutationObserver times out. Retries with exponential
//  * back-off until the DOM is ready or MAX_EXTRACTION_RETRIES is reached.
//  *
//  * @param {string} problemSlug
//  * @param {string} submissionId
//  * @param {number} attempt - current retry count (0-indexed)
//  */
// async function extractAndUpload(problemSlug, submissionId, attempt) {
//   try {
//     const data = extractSubmissionData(problemSlug, submissionId);

//     if (!data) {
//       if (attempt < MAX_EXTRACTION_RETRIES) {
//         const delay = RETRY_BASE_MS * Math.pow(1.6, attempt);
//         console.debug(`[CodeInsight] DOM not ready, retry ${attempt + 1} in ${Math.round(delay)}ms`);
//         setTimeout(() => extractAndUpload(problemSlug, submissionId, attempt + 1), delay);
//       } else {
//         console.warn('[CodeInsight] Extraction failed after max retries. Giving up.');
//       }
//       return;
//     }

//     dispatchUpload(data, submissionId);
//   } catch (err) {
//     console.error('[CodeInsight] Unexpected extraction error:', err);
//   }
// }

// // ─── DOM Extraction ───────────────────────────────────────────────────────────

// /**
//  * Primary extraction function. Returns a structured payload or null if the
//  * page hasn't rendered yet.
//  *
//  * @param {string} problemSlug  - from URL
//  * @param {string} submissionId - from URL
//  * @returns {object|null}
//  */
// function extractSubmissionData(problemSlug, submissionId) {
//   // ── 1. Problem title ───────────────────────────────────────────────────────
//   const title = extractTitle(problemSlug);
//   if (!title) return null;

//   // ── 2. Verdict ─────────────────────────────────────────────────────────────
//   const verdict = extractVerdict();
//   if (!verdict) return null;

//   // ── 3. Language ────────────────────────────────────────────────────────────
//   const language = extractLanguage();
//   if (!language) return null;

//   // ── 4. Source code ─────────────────────────────────────────────────────────
//   const code = extractCode();
//   if (!code || code.trim().length < 5) return null;

//   return {
//     problemSlug,
//     submissionId,
//     title,
//     verdict: normaliseVerdict(verdict),
//     language: normaliseLanguage(language),
//     code,
//     submittedAt: new Date().toISOString(),
//   };
// }

// // ── Title ─────────────────────────────────────────────────────────────────────
// function extractTitle(slug) {
//   const titleEl = document.querySelector('title');
//   if (titleEl?.textContent) {
//     const raw = titleEl.textContent.trim();
//     const stripped = raw.replace(/\s*-\s*LeetCode.*$/i, '').trim();
//     if (stripped.length > 0 && stripped !== 'LeetCode') return stripped;
//   }
//   const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
//   if (ogTitle) return ogTitle.replace(/\s*-\s*LeetCode.*$/i, '').trim();
//   return slug.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
// }

// // ── Verdict ───────────────────────────────────────────────────────────────────
// function extractVerdict() {
//   const VERDICT_SELECTORS = [
//     '[data-e2e-locator="submission-result"]',
//     '.text-green-s',
//     '.text-red-s',
//     '[class*="result-state"]',
//     '[class*="status-accepted"]',
//     '[class*="status-wrong"]',
//   ];

//   for (const sel of VERDICT_SELECTORS) {
//     const el = document.querySelector(sel);
//     if (el?.textContent?.trim()) {
//       return el.textContent.trim();
//     }
//   }

//   const KNOWN_VERDICTS = [
//     'Accepted', 'Wrong Answer', 'Time Limit Exceeded',
//     'Memory Limit Exceeded', 'Runtime Error', 'Compile Error',
//     'Output Limit Exceeded',
//   ];
//   const bodyText = document.body.innerText;
//   for (const v of KNOWN_VERDICTS) {
//     if (bodyText.includes(v)) return v;
//   }

//   return null;
// }

// // ── Language ──────────────────────────────────────────────────────────────────
// function extractLanguage() {
//   const LANG_SELECTORS = [
//     '[data-e2e-locator="submission-lang"]',
//     'button[id*="lang"]',
//     '[class*="lang-select"]',
//   ];

//   for (const sel of LANG_SELECTORS) {
//     const el = document.querySelector(sel);
//     if (el?.textContent?.trim()) return el.textContent.trim();
//   }

//   const nextData = getNextData();
//   if (nextData) {
//     const lang =
//       nextData?.props?.pageProps?.submissionData?.lang ||
//       nextData?.props?.pageProps?.lang ||
//       nextData?.query?.lang;
//     if (lang) return lang;
//   }

//   return null;
// }

// // ── Code Extraction ───────────────────────────────────────────────────────────
// function extractCode() {
//   // Strategy A: __NEXT_DATA__ (most reliable — server-rendered JSON)
//   const nextData = getNextData();
//   if (nextData) {
//     const code =
//       nextData?.props?.pageProps?.submissionData?.code ||
//       nextData?.props?.pageProps?.code ||
//       nextData?.query?.submissionData?.code;
//     if (code && code.trim().length > 5) return code;
//   }

//   // Strategy B: React fiber (walks component tree for submissionData.code prop)
//   const reactCode = extractFromReactFiber();
//   if (reactCode) return reactCode;

//   // Strategy C: CodeMirror DOM (reads rendered editor lines)
//   const cmCode = extractFromCodeMirror();
//   if (cmCode) return cmCode;

//   // Strategy D: Monaco editor (last resort — may capture post-submit editor edits)
//   const monacoCode = extractFromMonaco();
//   if (monacoCode) return monacoCode;

//   return null;
// }

// /**
//  * Cache with a per-navigation sentinel.
//  * Reset by calling resetNextDataCache() on each new URL.
//  */
// let _nextDataCache = undefined;

// function resetNextDataCache() {
//   _nextDataCache = undefined;
// }

// function getNextData() {
//   if (_nextDataCache !== undefined) return _nextDataCache;
//   try {
//     const el = document.getElementById('__NEXT_DATA__');
//     _nextDataCache = el ? JSON.parse(el.textContent) : null;
//   } catch {
//     _nextDataCache = null;
//   }
//   return _nextDataCache;
// }

// /**
//  * FIX BUG-EXT-002: Replaced broken while-loop traversal that used
//  * `fiber.child || fiber.sibling || fiber?.return?.sibling`.
//  * That pattern skipped entire subtrees because return.sibling jumps UP then
//  * sideways without exhausting the current node's subtree first.
//  *
//  * Replacement: standard iterative pre-order DFS with an explicit LIFO stack.
//  * Sibling is pushed before child so child is processed first (stack is LIFO).
//  * Hard cap of 2000 nodes prevents infinite loops on malformed fiber trees.
//  */
// function extractFromReactFiber() {
//   try {
//     const root = document.getElementById('__next') || document.getElementById('app');
//     if (!root) return null;

//     const fiberKey = Object.keys(root).find(k =>
//       k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
//     );
//     if (!fiberKey) return null;

//     const stack = [root[fiberKey]];
//     let visited = 0;
//     const MAX_NODES = 2000;

//     while (stack.length > 0 && visited < MAX_NODES) {
//       const fiber = stack.pop();
//       visited++;
//       if (!fiber) continue;

//       const props = fiber.memoizedProps || fiber.pendingProps;
//       if (props?.submissionData?.code) return props.submissionData.code;
//       if (props?.code && typeof props.code === 'string' && props.code.length > 20) {
//         if (props.code.includes('\n') || props.code.includes(';') || props.code.includes('{')) {
//           return props.code;
//         }
//       }

//       // Push sibling first (processed later), child second (processed next — LIFO)
//       if (fiber.sibling) stack.push(fiber.sibling);
//       if (fiber.child)   stack.push(fiber.child);
//     }
//   } catch {
//     // Fiber walk is opportunistic — never throw
//   }
//   return null;
// }

// function extractFromCodeMirror() {
//   try {
//     const lines = document.querySelectorAll('.CodeMirror-line, .cm-line');
//     if (lines.length === 0) return null;
//     return Array.from(lines).map(l => l.textContent).join('\n');
//   } catch {
//     return null;
//   }
// }

// /**
//  * FIX BUG-EXT-004: Added warning that Monaco fallback reads the visible editor
//  * DOM, which reflects whatever is currently in the editor — not necessarily the
//  * code that was submitted if the user edited the editor after submitting.
//  * This is a last-resort fallback; strategies A/B/C should succeed first.
//  */
// function extractFromMonaco() {
//   try {
//     const lines = document.querySelectorAll('.view-line');
//     if (lines.length === 0) return null;
//     console.warn(
//       '[CodeInsight] Using Monaco DOM fallback — code may differ from actual submission ' +
//       'if the editor was modified after submitting. Strategies A/B/C all failed.'
//     );
//     return Array.from(lines).map(l => l.textContent).join('\n');
//   } catch {
//     return null;
//   }
// }

// // ─── Normalisation Helpers ────────────────────────────────────────────────────

// /**
//  * FIX BUG-EXT-005: Unknown verdict strings are now logged as a warning instead
//  * of silently mapping to 'Pending'. 'Output Limit Exceeded' (which was already
//  * in KNOWN_VERDICTS but not in the map) now correctly maps to 'MLE' (closest
//  * semantic match — output size exceeded = effectively a limit exceeded verdict).
//  */
// function normaliseVerdict(raw) {
//   const s = raw.toLowerCase();
//   if (s.includes('accepted')) return 'Accepted';
//   if (s.includes('wrong')) return 'Wrong Answer';
//   if (s.includes('time limit')) return 'TLE';
//   if (s.includes('memory limit')) return 'MLE';
//   if (s.includes('output limit')) return 'MLE';
//   if (s.includes('runtime')) return 'RE';
//   if (s.includes('compile')) return 'CE';
//   // Surface unknown verdicts so they can be added to the map in a future update
//   console.warn('[CodeInsight] Unrecognised verdict string:', raw, '— mapping to Pending');
//   return 'Pending';
// }

// function normaliseLanguage(raw) {
//   const s = raw.toLowerCase().trim();
//   const MAP = {
//     'c++': 'cpp', 'cpp': 'cpp',
//     'java': 'java',
//     'python': 'python3', 'python3': 'python3',
//     'c': 'c',
//     'c#': 'csharp', 'csharp': 'csharp',
//     'javascript': 'javascript', 'js': 'javascript',
//     'typescript': 'typescript', 'ts': 'typescript',
//     'go': 'golang', 'golang': 'golang',
//     'rust': 'rust',
//     'kotlin': 'kotlin',
//     'swift': 'swift',
//     'scala': 'scala',
//     'ruby': 'ruby',
//     'php': 'php',
//   };
//   for (const [key, val] of Object.entries(MAP)) {
//     if (s.includes(key)) return val;
//   }
//   return s;
// }
