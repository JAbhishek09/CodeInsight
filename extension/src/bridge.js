/**
 * bridge.js — CodeInsight Isolated-World Bridge (Static, Self-Healing)
 * v1.4.0
 *
 * Reverted from dynamic chrome.scripting.executeScript injection back to a
 * static content script declared in manifest.json. Dynamic injection added
 * complexity (multiple injections per page load due to LeetCode's SPA firing
 * tabs.onUpdated 'complete' more than once) without fixing delivery —
 * console output from the injected script never appeared even on a
 * confirmed-successful injection, which made it undebuggable.
 *
 * content.js (world: MAIN) and bridge.js (default ISOLATED world) are both
 * declared as static content scripts matching the same URL pattern, so they
 * load together, in the same tab, every time. They communicate via
 * window.postMessage, which works across worlds in the same page.
 *
 * SPA navigation handling: LeetCode never does a full page reload between
 * problems navigated via client-side routing, so this script (like
 * content.js) stays alive across multiple submissions in the same tab.
 * That is actually desirable — no re-injection needed at all.
 *
 * NOTE ON v1.4.0 — "message channel closed before a response was received":
 * ─────────────────────────────────────────────────────────────────────────
 * This Chrome warning can appear when the LeetCode SPA navigates (e.g. from
 * /problems/<slug>/ to /problems/<slug>/submissions/<id>/) WHILE the
 * background service worker is still processing our UPLOAD_SUBMISSION
 * message (handleUpload's fetch + retry logic can take several seconds).
 * The actual fix lives in background.js v1.4.0, which now guards every
 * sendResponse call so it never throws if our tab's message port has
 * already closed by the time the response is ready — the upload itself
 * (and its retry-queue fallback on failure) is fully decoupled from whether
 * that response ever successfully reaches this script.
 *
 * On THIS side, the sendMessage callback below already checks
 * chrome.runtime.lastError defensively rather than relying on the callback
 * firing reliably, and the whole call is wrapped in try/catch — so no
 * change was needed here, this comment just documents why the warning is
 * benign: by the time it appears, our backend POST request (made by
 * background.js) has either already succeeded or already been queued for
 * retry. No submission is lost because of this warning.
 */

(function () {
  'use strict';

  var sentIds = {};

  console.log('[CodeInsight Bridge] v1.4.0 static bridge loaded:', location.href);

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;

    var data = event.data;
    if (!data || data.__ci !== true) return;

    var payload = data.payload;

    if (
      !payload ||
      typeof payload.problemSlug  !== 'string' || !payload.problemSlug ||
      typeof payload.submissionId !== 'string' || !payload.submissionId ||
      typeof payload.code         !== 'string' || payload.code.trim().length < 5 ||
      typeof payload.verdict      !== 'string' || !payload.verdict ||
      typeof payload.language     !== 'string' || !payload.language
    ) {
      console.warn('[CodeInsight Bridge] Invalid payload shape, dropping.', payload);
      return;
    }

    if (sentIds[payload.submissionId]) {
      console.debug('[CodeInsight Bridge] Already sent subId:', payload.submissionId);
      return;
    }

    // Check extension context BEFORE marking as sent — if context is dead,
    // we want content.js's retry/queue logic (if any) to still have a chance,
    // not get permanently marked as "sent" while actually dropped.
    if (!chrome || !chrome.runtime || !chrome.runtime.id) {
      console.error(
        '[CodeInsight Bridge] Extension context invalidated — cannot forward subId',
        payload.submissionId,
        '. This page needs a reload to restore the connection.'
      );
      return;
    }

    sentIds[payload.submissionId] = true;

    console.log('[CodeInsight Bridge] Forwarding →',
      payload.verdict, '|', payload.language,
      '|', payload.code.length, 'chars',
      '| subId:', payload.submissionId);

    try {
      chrome.runtime.sendMessage(
        { type: 'UPLOAD_SUBMISSION', payload: payload },
        function (response) {
          // chrome.runtime.lastError is the documented way to detect that
          // the message port closed before a response arrived (e.g. the
          // background service worker's response raced a navigation in
          // this tab). We only log it — by this point background.js has
          // either already completed the upload or already queued it for
          // retry, so this is informational, not a failure signal.
          if (chrome.runtime.lastError) {
            console.debug('[CodeInsight Bridge] No response (port likely closed by navigation):',
                          chrome.runtime.lastError.message);
            return;
          }
          if (response && response.success) {
            console.log('[CodeInsight Bridge] Upload confirmed.');
          } else {
            console.warn('[CodeInsight Bridge] Upload failed:',
                         response && response.error);
          }
        }
      );
    } catch (err) {
      // sendMessage itself can throw synchronously if the extension context
      // was invalidated between the check above and this call (rare race).
      console.error('[CodeInsight Bridge] Exception calling sendMessage:', err.message);
    }
  });

})();
