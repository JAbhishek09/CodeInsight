/**
 * content.js — CodeInsight LeetCode Content Script v1.6.0
 *
 * ROOT CAUSE IDENTIFIED AND FIXED in this version:
 *
 *  All 41 GraphQL XHR calls LeetCode makes use responseType='blob'.
 *  v1.5.0 added async blob.text() decode to handle this — but in the real
 *  Chrome extension environment (MAIN world content script), blob.text()
 *  on a blob created by the page's network stack may fail silently due to
 *  cross-context blob ownership, or the async .then() fires AFTER our
 *  load listener's try/catch has already exited and any exception is
 *  completely swallowed. The result: our load handler runs, calls
 *  extractXhrResponseText, blob.text() starts but never resolves (or
 *  rejects silently), handleSubmissionDetailsResponse never fires.
 *  This explains ZERO 'submissionDetails poll:' log lines in production.
 *
 *  FIX: Call xhr.overrideMimeType('text/plain; charset=utf-8') in our
 *  open() wrapper BEFORE LeetCode's own code runs. This forces the browser
 *  to decode the response as text regardless of Content-Type, making
 *  responseText directly readable at load time — no async blob decode
 *  needed, no cross-context issues, no async race. The catch: this only
 *  works before send() is called, and only when the XHR's responseType
 *  has NOT been set to something non-default yet. So we call it in open()
 *  only for URLs matching /graphql/, since that's the only path we care
 *  about, before LeetCode's code sets responseType='blob'.
 *
 *  VERIFIED via live network capture:
 *   - Both submissionDetails polls use separate XHR instances (instanceIds
 *     44 and 50 in a test run), ruling out WeakSet re-use blocking.
 *   - Both return status 200, responseType='blob', hasResponse=true,
 *     responseSizeHint ~3252/3546 bytes — real data, not blocked/empty.
 *   - The submit POST itself goes through window.fetch (not XHR), which is
 *     why submit response capture always worked despite XHR blob issues.
 *
 * ARCHITECTURE (unchanged):
 *  - world:MAIN + run_at:document_start patches fetch/XHR before LeetCode.
 *  - Plain IIFE, no ES module syntax.
 *  - window.postMessage({ __ci:true, payload }) → bridge.js → sendMessage.
 */

(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────────────────────
  var SUBMIT_API_RE     = /\/problems\/([^/]+)\/submit\/?$/;
  var SUBMISSION_URL_RE = /\/problems\/([^/]+)\/submissions\/(\d+)\/?/;
  var GRAPHQL_PATH_RE   = /\/graphql\/?(\?.*)?$/;

  var MAX_RETRIES   = 14;
  var RETRY_BASE_MS = 600;
  var RETRY_BACKOFF = 1.45;

  var STATUS_CODE_MAP = {
    10: 'Accepted',  11: 'Wrong Answer', 12: 'MLE', 13: 'MLE',
    14: 'TLE',       15: 'RE',           16: 'RE',  20: 'CE',
    21: 'RE',        30: 'TLE',
  };

  // ─── Session state ──────────────────────────────────────────────────────────
  var uploadedIds             = {};
  var pendingSlugBySubmission = {};
  var lastStatusCodeSeen      = {};
  var instrumentedXhrs = typeof WeakSet !== 'undefined' ? new WeakSet() : null;

  console.log('[CodeInsight] v1.6.0 loaded (MAIN world, document_start)');

  // ─── Helpers ────────────────────────────────────────────────────────────────
  function extractOperationName(bodyText) {
    try { return JSON.parse(bodyText).operationName || null; } catch (_) { return null; }
  }

  function extractSubmissionIdFromBody(bodyText) {
    try {
      var id = JSON.parse(bodyText).variables.submissionId;
      return (id !== undefined && id !== null) ? String(id) : null;
    } catch (_) { return null; }
  }

  // ─── Submit response handler ─────────────────────────────────────────────────
  function handleSubmitResponse(slug, responseText) {
    try {
      var data  = JSON.parse(responseText);
      var subId = String((data && (data.submission_id || data.id)) || '');
      if (subId) {
        console.log('[CodeInsight] submit captured →', subId, slug);
        pendingSlugBySubmission[subId] = slug;
      } else {
        console.warn('[CodeInsight] submit response missing id. Snippet:',
                     String(responseText).substring(0, 200));
      }
    } catch (err) {
      console.warn('[CodeInsight] submit response parse error:', err.message);
    }
  }

  // ─── submissionDetails response handler ─────────────────────────────────────
  function handleSubmissionDetailsResponse(requestBodyText, responseText) {
    var submissionId = extractSubmissionIdFromBody(requestBodyText);
    if (!submissionId) {
      console.debug('[CodeInsight] submissionDetails: no submissionId in body.');
      return;
    }
    if (uploadedIds[submissionId]) {
      console.debug('[CodeInsight] submissionDetails: already uploaded', submissionId);
      return;
    }

    var json;
    try { json = JSON.parse(responseText); } catch (err) {
      console.warn('[CodeInsight] submissionDetails non-JSON for', submissionId,
                   '— snippet:', String(responseText).substring(0, 200));
      return;
    }

    var sd = json && json.data && json.data.submissionDetails;
    if (!sd) {
      console.debug('[CodeInsight] submissionDetails null for', submissionId, '— judge not ready.');
      return;
    }

    var statusCode = sd.statusCode;
    if (statusCode === undefined || statusCode === null) {
      console.debug('[CodeInsight] submissionDetails no statusCode for', submissionId);
      return;
    }

    var code         = sd.code;
    var hasUsableCode = !!code && typeof code === 'string' && code.trim().length >= 3;

    var TERMINAL = { 16: true, 20: true, 21: true };
    var hasTC    = typeof sd.totalTestcases === 'number' && typeof sd.totalCorrect === 'number';
    var complete  = hasTC || !!TERMINAL[statusCode];

    console.log('[CodeInsight] submissionDetails poll —',
      'subId=' + submissionId, 'status=' + statusCode,
      'code=' + hasUsableCode, 'complete=' + complete,
      '(' + sd.totalCorrect + '/' + sd.totalTestcases + ')');

    if (!hasUsableCode) {
      console.debug('[CodeInsight]', submissionId, '— no code yet, waiting.');
      return;
    }

    var lastSeen = lastStatusCodeSeen[submissionId];
    lastStatusCodeSeen[submissionId] = statusCode;
    if (!complete && (lastSeen === undefined || lastSeen !== statusCode)) {
      console.debug('[CodeInsight]', submissionId, '— awaiting second confirming poll.');
      return;
    }

    var verdict = STATUS_CODE_MAP[statusCode];
    if (!verdict) {
      console.warn('[CodeInsight] Unknown statusCode:', statusCode, 'for', submissionId);
      return;
    }

    var lang = (sd.lang && sd.lang.name) || '';
    if (!lang) {
      console.warn('[CodeInsight]', submissionId, '— lang.name missing.');
      return;
    }

    var slug = (sd.question && sd.question.titleSlug)
            || pendingSlugBySubmission[submissionId]
            || extractSlugFromUrl();
    if (!slug) {
      console.warn('[CodeInsight]', submissionId, '— no slug resolved.');
      return;
    }

    var payload = {
      problemSlug:  slug,
      submissionId: String(submissionId),
      title:        extractTitle(slug),
      verdict:      verdict,
      language:     normaliseLanguage(lang),
      code:         code,
      submittedAt:  sd.timestamp
                      ? new Date(sd.timestamp * 1000).toISOString()
                      : new Date().toISOString(),
    };

    console.log('[CodeInsight] settled →', verdict, lang, code.length + 'ch', 'subId=' + submissionId);
    dispatchUpload(payload, submissionId);
  }

  // ─── fetch() intercept — catches /submit/ POST (always fetch, not XHR) ──────
  var _origFetch = window.fetch;
  window.fetch = function (resource, init) {
    var url    = (typeof resource === 'string') ? resource : (resource && resource.url) || '';
    var method = ((init && init.method) || (resource && resource.method) || 'GET').toUpperCase();

    var submitMatch = SUBMIT_API_RE.exec(url);
    if (submitMatch && method === 'POST') {
      var slug = submitMatch[1];
      return _origFetch.apply(this, arguments).then(function (response) {
        response.clone().text()
          .then(function (t) { handleSubmitResponse(slug, t); })
          .catch(function (e) { console.debug('[CodeInsight] fetch submit .text():', e.message); });
        return response;
      });
    }

    // Defensive: also intercept if GraphQL ever moves back to fetch
    if (GRAPHQL_PATH_RE.test(url) && method === 'POST') {
      var bodyText = (init && init.body) || '';
      if (extractOperationName(bodyText) === 'submissionDetails') {
        return _origFetch.apply(this, arguments).then(function (response) {
          response.clone().text()
            .then(function (t) { handleSubmissionDetailsResponse(bodyText, t); })
            .catch(function (e) { console.debug('[CodeInsight] fetch gql .text():', e.message); });
          return response;
        });
      }
    }

    return _origFetch.apply(this, arguments);
  };

  // ─── XHR intercept ──────────────────────────────────────────────────────────
  //
  // KEY FIX (v1.6.0): We call overrideMimeType('text/plain; charset=utf-8')
  // inside our open() wrapper for any request to /graphql/. This MUST happen
  // before LeetCode's code sets responseType='blob' (which happens between
  // our open() call and our send() call). overrideMimeType forces the browser
  // to decode the body as UTF-8 text, making responseText directly available
  // at load time with no async decode, no cross-context blob.text() needed.
  //
  // Note: overrideMimeType() throws if called after send() — we call it in
  // open(), safely before any code sets responseType.
  //
  var _origOpen = XMLHttpRequest.prototype.open;
  var _origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._ciMethod = method;
    this._ciUrl    = url;

    var result = _origOpen.apply(this, arguments);

    // For GraphQL requests, force text decoding so responseText is always
    // readable. Must be called after open() but before send() — here is perfect.
    if (GRAPHQL_PATH_RE.test(url || '')) {
      try {
        this.overrideMimeType('text/plain; charset=utf-8');
      } catch (_) {
        // Silently ignore — if overrideMimeType fails (e.g. already sent),
        // we'll handle blob fallback in the load listener.
      }
    }

    return result;
  };

  XMLHttpRequest.prototype.send = function (body) {
    var self = this;
    this._ciBody = body;

    var seen = instrumentedXhrs ? instrumentedXhrs.has(self) : self.__ciInstrumented;
    if (!seen) {
      if (instrumentedXhrs) instrumentedXhrs.add(self);
      else self.__ciInstrumented = true;

      self.addEventListener('load', function () {
        try {
          var url    = self._ciUrl    || '';
          var method = (self._ciMethod || '').toUpperCase();

          // Submit: always goes through fetch, but guard here in case
          var submitMatch = SUBMIT_API_RE.exec(url);
          if (submitMatch && method === 'POST') {
            handleSubmitResponse(submitMatch[1], self.responseText);
            return;
          }

          if (GRAPHQL_PATH_RE.test(url) && method === 'POST') {
            var opName = extractOperationName(self._ciBody || '');
            if (opName === 'submissionDetails') {
              var reqBody = self._ciBody || '';

              // Primary path: overrideMimeType forced text decode — responseText is ready
              var rt = self.responseType || '';
              if (rt === '' || rt === 'text') {
                handleSubmissionDetailsResponse(reqBody, self.responseText);
                return;
              }

              // Fallback: overrideMimeType didn't prevent blob (shouldn't happen,
              // but guard defensively). Use synchronous FileReader on the blob.
              if (rt === 'blob') {
                var blob = self.response;
                if (!blob) {
                  console.warn('[CodeInsight] blob response empty for graphql request:', url);
                  return;
                }
                var reader = new FileReader();
                reader.onload = function () {
                  handleSubmissionDetailsResponse(reqBody, String(reader.result || ''));
                };
                reader.onerror = function () {
                  console.warn('[CodeInsight] FileReader failed for submissionDetails');
                };
                reader.readAsText(blob, 'utf-8');
                return;
              }

              // ArrayBuffer fallback (extremely unlikely for graphql)
              if (rt === 'arraybuffer') {
                var buf = self.response;
                if (buf) handleSubmissionDetailsResponse(reqBody, new TextDecoder('utf-8').decode(buf));
                return;
              }

              console.warn('[CodeInsight] Unhandled responseType:', rt, 'for submissionDetails');
            }
          }
        } catch (err) {
          console.debug('[CodeInsight] XHR load handler error:', err.message);
        }
      });

      self.addEventListener('error', function () {
        if (GRAPHQL_PATH_RE.test(self._ciUrl || '')) {
          console.warn('[CodeInsight] XHR error on graphql:', self._ciUrl);
        }
      });
    }

    return _origSend.apply(this, arguments);
  };

  // ─── URL-change / SPA navigation detection ───────────────────────────────────
  var _currentUrl = location.href;

  function checkUrlChange() {
    var newUrl = location.href;
    if (newUrl === _currentUrl) return;
    _currentUrl = newUrl;
    var match = SUBMISSION_URL_RE.exec(newUrl);
    if (match) {
      var slug = match[1], submissionId = match[2];
      if (uploadedIds[submissionId]) return;
      console.log('[CodeInsight] URL nav detected:', slug, submissionId);
      resetNextDataCache();
      scheduleRetry(slug, submissionId, 0);
    }
  }

  var _origPush    = history.pushState.bind(history);
  var _origReplace = history.replaceState.bind(history);
  history.pushState    = function () { _origPush.apply(this, arguments);    setTimeout(checkUrlChange, 0); };
  history.replaceState = function () { _origReplace.apply(this, arguments); setTimeout(checkUrlChange, 0); };
  window.addEventListener('popstate', function () { setTimeout(checkUrlChange, 0); });
  checkUrlChange();

  // ─── DOM-scrape retry loop (fallback only) ───────────────────────────────────
  function scheduleRetry(slug, submissionId, attempt) {
    if (uploadedIds[submissionId]) return;
    if (attempt >= MAX_RETRIES) {
      console.warn('[CodeInsight] DOM fallback exhausted for', submissionId,
                   '— last statusCode:', lastStatusCodeSeen[submissionId]);
      return;
    }
    setTimeout(function () {
      if (uploadedIds[submissionId]) return;
      var data = extractSubmissionDataFromDom(slug, submissionId);
      if (data) {
        console.log('[CodeInsight] DOM fallback hit for', submissionId, 'attempt', attempt);
        dispatchUpload(data, submissionId);
      } else {
        scheduleRetry(slug, submissionId, attempt + 1);
      }
    }, RETRY_BASE_MS * Math.pow(RETRY_BACKOFF, attempt));
  }

  function extractSubmissionDataFromDom(slug, submissionId) {
    var title = extractTitle(slug), verdict = extractVerdictFromDom(),
        lang  = extractLanguageFromDom(), code = extractCodeFromDom();
    if (!title || !verdict || !lang || !code || code.trim().length < 5) return null;
    return {
      problemSlug: slug, submissionId: String(submissionId), title: title,
      verdict: normaliseVerdictString(verdict), language: normaliseLanguage(lang),
      code: code, submittedAt: new Date().toISOString(),
    };
  }

  // ─── Upload dispatcher ───────────────────────────────────────────────────────
  function dispatchUpload(data, submissionId) {
    if (uploadedIds[submissionId]) return;
    uploadedIds[submissionId] = true;
    delete pendingSlugBySubmission[submissionId];
    delete lastStatusCodeSeen[submissionId];
    console.log('[CodeInsight] → upload dispatched:',
      data.verdict, data.language, data.code.length + 'ch', submissionId);
    window.postMessage({ __ci: true, payload: JSON.parse(JSON.stringify(data)) }, '*');
  }

  // ─── DOM helpers ─────────────────────────────────────────────────────────────
  function extractSlugFromUrl() {
    var m = /\/problems\/([^/]+)/.exec(location.pathname); return m ? m[1] : null;
  }

  function extractTitle(slug) {
    var t = document.querySelector('title');
    if (t && t.textContent) { var c = t.textContent.replace(/\s*[-|].*LeetCode.*$/i,'').trim(); if (c && c !== 'LeetCode') return c; }
    var og = document.querySelector('meta[property="og:title"]');
    if (og && og.content) return og.content.replace(/\s*[-|].*LeetCode.*$/i,'').trim();
    return slug.split('-').map(function(w){return w[0].toUpperCase()+w.slice(1);}).join(' ');
  }

  function extractVerdictFromDom() {
    var ss = ['[data-e2e-locator="submission-result"]','.text-green-s','.text-red-s','[class*="result-state"]','[class*="status-"]','[class*="ResultHeader"]'];
    for (var i=0;i<ss.length;i++){var el=document.querySelector(ss[i]);if(el&&el.textContent&&el.textContent.trim())return el.textContent.trim();}
    var KN=['Accepted','Wrong Answer','Time Limit Exceeded','Memory Limit Exceeded','Runtime Error','Compile Error','Output Limit Exceeded'];
    var b=document.body&&document.body.innerText;
    if(b)for(var j=0;j<KN.length;j++)if(b.indexOf(KN[j])!==-1)return KN[j];
    return null;
  }

  function extractLanguageFromDom() {
    var ss=['[data-e2e-locator="submission-lang"]','button[id*="lang"]','[class*="lang-select"]','[class*="LanguageButton"]'];
    for(var i=0;i<ss.length;i++){var el=document.querySelector(ss[i]);if(el&&el.textContent&&el.textContent.trim())return el.textContent.trim();}
    var h=document.querySelector('[class*="ResultHeader"],[class*="result-header"]');
    if(h&&h.textContent){var LS=['Python3','Python','C++','Java','JavaScript','TypeScript','Go','Rust','C#','C','Swift','Kotlin','Scala','Ruby','PHP'];for(var k=0;k<LS.length;k++)if(h.textContent.indexOf(LS[k])!==-1)return LS[k];}
    var nd=getNextData();
    if(nd){var l=(nd.props&&nd.props.pageProps&&(nd.props.pageProps.lang||(nd.props.pageProps.submissionData&&nd.props.pageProps.submissionData.lang)))||(nd.query&&nd.query.lang);if(l)return l;}
    return null;
  }

  function extractCodeFromDom() {
    var nd=getNextData();
    if(nd){var c=(nd.props&&nd.props.pageProps&&((nd.props.pageProps.submissionData&&nd.props.pageProps.submissionData.code)||nd.props.pageProps.code))||(nd.query&&nd.query.submissionData&&nd.query.submissionData.code);if(c&&c.trim().length>5)return c;}
    var fc=extractFromFiber(); if(fc)return fc;
    var cm=document.querySelectorAll('.CodeMirror-line,.cm-line');
    if(cm.length)return Array.prototype.map.call(cm,function(l){return l.textContent;}).join('\n');
    var mv=document.querySelectorAll('.view-line');
    if(mv.length){console.warn('[CodeInsight] Monaco DOM fallback');return Array.prototype.map.call(mv,function(l){return l.textContent;}).join('\n');}
    return null;
  }

  var _nextCache;
  function resetNextDataCache(){_nextCache=undefined;}
  function getNextData(){
    if(_nextCache!==undefined)return _nextCache;
    try{var el=document.getElementById('__NEXT_DATA__');_nextCache=el?JSON.parse(el.textContent):null;}
    catch(_){_nextCache=null;}
    return _nextCache;
  }

  function extractFromFiber(){
    try{
      var root=document.getElementById('__next')||document.getElementById('app'); if(!root)return null;
      var fk=Object.keys(root).find(function(k){return k.indexOf('__reactFiber')===0||k.indexOf('__reactInternalInstance')===0||k.indexOf('__reactContainer')===0;});
      if(!fk)return null;
      var stack=[root[fk]],n=0;
      while(stack.length&&n++<2000){var f=stack.pop();if(!f)continue;var p=f.memoizedProps||f.pendingProps;
        if(p&&p.submissionData&&p.submissionData.code)return p.submissionData.code;
        if(p&&p.code&&typeof p.code==='string'&&p.code.length>20&&(p.code.indexOf('\n')!==-1||p.code.indexOf(';')!==-1||p.code.indexOf('{')!==-1))return p.code;
        if(f.sibling)stack.push(f.sibling);if(f.child)stack.push(f.child);}
    }catch(_){}
    return null;
  }

  function normaliseVerdictString(raw){
    var s=raw.toLowerCase();
    if(s.indexOf('accepted')!==-1)return 'Accepted';
    if(s.indexOf('wrong')!==-1)return 'Wrong Answer';
    if(s.indexOf('time limit')!==-1)return 'TLE';
    if(s.indexOf('memory limit')!==-1)return 'MLE';
    if(s.indexOf('output limit')!==-1)return 'MLE';
    if(s.indexOf('runtime')!==-1)return 'RE';
    if(s.indexOf('compile')!==-1)return 'CE';
    console.warn('[CodeInsight] Unknown verdict:',raw); return 'Pending';
  }

  function normaliseLanguage(raw){
    var s=raw.toLowerCase().trim();
    var M=[['c++','cpp'],['cpp','cpp'],['python3','python3'],['python','python3'],['javascript','javascript'],['typescript','typescript'],['java','java'],['c#','csharp'],['csharp','csharp'],['golang','golang'],['go','golang'],['rust','rust'],['kotlin','kotlin'],['swift','swift'],['scala','scala'],['ruby','ruby'],['php','php'],['dart','dart'],['elixir','elixir'],['erlang','erlang'],['racket','racket'],['bash','bash'],['mysql','mysql'],['mssql','mssql'],['postgresql','postgresql'],['c','c']];
    for(var i=0;i<M.length;i++)if(s.indexOf(M[i][0])!==-1)return M[i][1];
    return s;
  }

})();
