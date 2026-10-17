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

  var sentIds  = {};
  var inFlight = {};

  // Mirrors content.js — LeetCode judge status codes → backend verdicts.
  var STATUS_CODE_MAP = {
    10: 'Accepted',  11: 'Wrong Answer', 12: 'MLE', 13: 'MLE',
    14: 'TLE',       15: 'RE',           16: 'RE',  20: 'CE',
    21: 'RE',        30: 'TLE',
  };

  var SUBMISSION_DETAILS_QUERY =
    'query submissionDetails($submissionId: Int!) {' +
    '  submissionDetails(submissionId: $submissionId) {' +
    '    timestamp statusCode code' +
    '    lang { name }' +
    '    question { titleSlug title }' +
    '  }' +
    '  userStatus { isSignedIn username }' +
    '}';

  console.log('[CodeInsight Bridge] v1.5.0 static bridge loaded:', location.href);

  function getCookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  function normaliseLanguage(raw){
    var s=raw.toLowerCase().trim();
    var M=[['c++','cpp'],['cpp','cpp'],['python3','python3'],['python','python3'],['javascript','javascript'],['typescript','typescript'],['java','java'],['c#','csharp'],['csharp','csharp'],['golang','golang'],['go','golang'],['rust','rust'],['kotlin','kotlin'],['swift','swift'],['scala','scala'],['ruby','ruby'],['php','php'],['dart','dart'],['elixir','elixir'],['erlang','erlang'],['racket','racket'],['bash','bash'],['mysql','mysql'],['mssql','mssql'],['postgresql','postgresql'],['c','c']];
    for(var i=0;i<M.length;i++)if(s.indexOf(M[i][0])!==-1)return M[i][1];
    return s;
  }

  /**
   * SECURITY: the page (MAIN world) channel is untrusted — any script on
   * leetcode.com can post { __ci: true, payload }. So we only take the
   * submissionId from it and rebuild the whole payload from LeetCode's own
   * GraphQL API (same-origin, using the user's session). A forged message can
   * therefore at most re-sync one of the user's real submissions.
   */
  function fetchVerifiedPayload(submissionId) {
    return fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-csrftoken': getCookie('csrftoken'),
      },
      body: JSON.stringify({
        operationName: 'submissionDetails',
        query: SUBMISSION_DETAILS_QUERY,
        variables: { submissionId: Number(submissionId) },
      }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('LeetCode GraphQL HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var sd = json && json.data && json.data.submissionDetails;
        if (!sd) throw new Error('submissionDetails unavailable');
        var us = json.data.userStatus;
        if (!us || !us.isSignedIn || !us.username) throw new Error('not signed in to LeetCode');

        var verdict = STATUS_CODE_MAP[sd.statusCode];
        var slug    = sd.question && sd.question.titleSlug;
        var lang    = sd.lang && sd.lang.name;
        if (!verdict) throw new Error('unsettled or unknown statusCode ' + sd.statusCode);
        if (!slug)    throw new Error('missing question.titleSlug');
        if (!lang)    throw new Error('missing lang.name');
        if (typeof sd.code !== 'string' || sd.code.trim().length < 5) throw new Error('missing code');

        return {
          problemSlug:  slug,
          submissionId: String(submissionId),
          // Backend rejects submissions from a LeetCode user other than the
          // one linked to the CodeInsight account.
          leetcodeUsername: us.username,
          title:        (sd.question.title || slug).slice(0, 200),
          verdict:      verdict,
          language:     normaliseLanguage(lang),
          code:         sd.code,
          submittedAt:  sd.timestamp
                          ? new Date(Number(sd.timestamp) * 1000).toISOString()
                          : new Date().toISOString(),
        };
      });
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;

    var data = event.data;
    if (!data || data.__ci !== true) return;

    var submissionId = data.payload && data.payload.submissionId;
    if (typeof submissionId !== 'string' || !/^\d{1,20}$/.test(submissionId)) {
      console.warn('[CodeInsight Bridge] Invalid submissionId, dropping.', submissionId);
      return;
    }

    if (sentIds[submissionId] || inFlight[submissionId]) {
      console.debug('[CodeInsight Bridge] Already sent subId:', submissionId);
      return;
    }

    // Check extension context BEFORE marking as sent — if context is dead,
    // we want content.js's retry/queue logic (if any) to still have a chance,
    // not get permanently marked as "sent" while actually dropped.
    if (!chrome || !chrome.runtime || !chrome.runtime.id) {
      console.error(
        '[CodeInsight Bridge] Extension context invalidated — cannot forward subId',
        submissionId,
        '. This page needs a reload to restore the connection.'
      );
      return;
    }

    inFlight[submissionId] = true;
    fetchVerifiedPayload(submissionId)
      .then(function (payload) {
        sentIds[submissionId] = true;
        forward(payload);
      })
      .catch(function (err) {
        console.warn('[CodeInsight Bridge] Could not verify subId', submissionId, '—', err.message);
      })
      .then(function () { delete inFlight[submissionId]; });
  });

  function forward(payload) {
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
          var picker = window.CodeInsightPicker;
          if (chrome.runtime.lastError) {
            console.debug('[CodeInsight Bridge] No response (port likely closed by navigation):',
                          chrome.runtime.lastError.message);
            // The upload still happened — ask for the pattern feedback directly.
            if (picker) setTimeout(function () { picker.fetchFeedback(payload.problemSlug); }, 1500);
            return;
          }
          if (response && response.success) {
            console.log('[CodeInsight Bridge] Upload confirmed.');
            var fb = response.data && response.data.feedback;
            if (picker && fb) picker.showFeedback(fb, payload.problemSlug);
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
  }

})();
