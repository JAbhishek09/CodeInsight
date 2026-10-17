/**
 * picker.js — "Which pattern is this?" on LeetCode problem pages.
 *
 * Runs in the extension's isolated world (same as bridge.js) and renders into
 * a shadow root so LeetCode's CSS can't touch it. Flow:
 *   1. Student opens a problem → small "Which pattern?" pill.
 *   2. They pick a pattern (or "Not sure") → background saves the guess.
 *   3. They submit → bridge.js uploads → backend returns feedback → card.
 * The answer is never shown before they submit.
 *
 * Keep PATTERNS in sync with backend/data/patterns.js.
 */
(function () {
  'use strict';

  var PATTERNS = [
    { key: 'two-pointers', name: 'Two pointers', color: '#22d3ee' },
    { key: 'prefix-hashing', name: 'Prefix sums & hashing', color: '#a3e635' },
    { key: 'sliding-window', name: 'Sliding window', color: '#a78bfa' },
    { key: 'binary-search', name: 'Binary search', color: '#fbbf24' },
    { key: 'stack', name: 'Stack & monotonic stack', color: '#fb7185' },
    { key: 'bfs-dfs', name: 'Graph & grid BFS/DFS', color: '#34d399' },
    { key: 'heap-top-k', name: 'Heap & top-K', color: '#fb923c' },
    { key: 'dp-1d', name: '1-D dynamic programming', color: '#e879f9' },
  ];
  var byKey = {};
  PATTERNS.forEach(function (p) { byKey[p.key] = p; });

  var OUTCOME_COLOR = {
    recognised: '#3ecf8e', 'right-pattern-bug': '#f5b544', missed: '#f87171',
    'wrong-approach': '#f87171', unsure: '#7c7ff2', unmapped: '#a1a1aa',
  };

  var CSS = [
    ':host{all:initial}',
    '.wrap{position:fixed;right:20px;bottom:20px;z-index:2147483646;font:13px/1.45 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;color:#fafafa}',
    '.pill{display:flex;align-items:center;gap:8px;background:#111113;border:1px solid #3a3a41;border-radius:999px;padding:8px 14px;cursor:pointer;box-shadow:0 8px 24px rgb(0 0 0/.45);color:#fafafa;font:inherit}',
    '.pill:hover{border-color:#7c7ff2}',
    '.dot{width:8px;height:8px;border-radius:50%;background:#7c7ff2;box-shadow:0 0 10px #7c7ff2}',
    '.card{width:300px;max-height:calc(100vh - 40px);overflow-y:auto;background:#111113;border:1px solid #3a3a41;border-radius:14px;padding:14px;box-shadow:0 12px 32px rgb(0 0 0/.5)}',
    '.head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}',
    '.title{font-weight:600;font-size:14px}',
    '.muted{color:#a1a1aa;font-size:12px}',
    '.x{background:none;border:0;color:#a1a1aa;cursor:pointer;font-size:18px;line-height:1;padding:2px 6px;border-radius:6px}',
    '.x:hover{color:#fafafa;background:#232327}',
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}',
    '.opt{display:flex;align-items:center;gap:7px;text-align:left;background:#18181b;border:1px solid #26262b;border-radius:9px;padding:8px 9px;color:#fafafa;cursor:pointer;font:inherit;font-size:12px}',
    '.opt:hover{border-color:var(--c);background:color-mix(in oklab,var(--c) 12%,#18181b)}',
    '.sw{width:8px;height:8px;border-radius:50%;flex:none;background:var(--c);box-shadow:0 0 8px var(--c)}',
    '.unsure{grid-column:1/-1;justify-content:center;color:#a1a1aa}',
    '.chosen{display:flex;align-items:center;gap:8px;margin-top:8px;padding:9px 10px;border-radius:9px;border:1px solid color-mix(in oklab,var(--c) 55%,transparent);background:color-mix(in oklab,var(--c) 12%,transparent)}',
    '.link{background:none;border:0;color:#a5a7f8;cursor:pointer;font:inherit;font-size:12px;padding:0;margin-top:8px}',
    '.fb{border-left:3px solid var(--c);padding-left:10px;margin-top:4px}',
    '.fb .title{color:var(--c)}',
    '.err{color:#f87171;font-size:12px;margin-top:8px}',
  ].join('');

  var host = null, root = null;
  var state = { slug: null, view: 'pill', predicted: null, feedback: null, error: null, dismissed: false, busy: false };

  function slugFromPath() {
    var m = location.pathname.match(/^\/problems\/([a-z0-9-]+)/);
    return m ? m[1] : null;
  }
  function storeKey(slug) { return 'ci_guess_' + slug; }
  function loadGuess(slug) { try { return sessionStorage.getItem(storeKey(slug)); } catch (e) { return null; } }
  function saveGuess(slug, key) { try { sessionStorage.setItem(storeKey(slug), key); } catch (e) { /* ignore */ } }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (attrs[k] === null || attrs[k] === undefined) return;
      if (k === 'style') n.setAttribute('style', attrs[k]);
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { n.append(c); });
    return n;
  }

  function ensureHost() {
    if (host && document.documentElement.contains(host)) return;
    host = document.createElement('div');
    host.id = 'codeinsight-pattern-picker';
    root = host.attachShadow({ mode: 'closed' });
    (document.body || document.documentElement).appendChild(host);
  }

  function send(msg, cb) {
    try {
      if (!chrome.runtime || !chrome.runtime.id) { cb({ success: false, error: 'Reload the page to reconnect CodeInsight.' }); return; }
      chrome.runtime.sendMessage(msg, function (res) {
        if (chrome.runtime.lastError) { cb({ success: false, error: 'CodeInsight extension isn’t responding.' }); return; }
        cb(res || { success: false, error: 'No response' });
      });
    } catch (e) { cb({ success: false, error: e.message }); }
  }

  function choose(key) {
    if (state.busy) return;
    state.busy = true; state.error = null; render();
    send({ type: 'SUBMIT_PREDICTION', slug: state.slug, predicted: key }, function (res) {
      state.busy = false;
      if (res.success) {
        state.predicted = key; saveGuess(state.slug, key); state.view = 'chosen';
      } else {
        state.error = res.error;
      }
      render();
    });
  }

  function closeBtn(onclick) { return el('button', { class: 'x', 'aria-label': 'Close', onclick: onclick }, ['×']); }

  function render() {
    if (!state.slug || state.dismissed) { if (host) host.remove(); return; }
    ensureHost();
    root.innerHTML = '';
    root.append(el('style', {}, [CSS]));
    var wrap = el('div', { class: 'wrap' });

    if (state.view === 'pill') {
      var label = state.predicted
        ? 'Your guess: ' + (state.predicted === 'unsure' ? 'not sure' : byKey[state.predicted].name)
        : 'Which pattern is this?';
      wrap.append(el('button', { class: 'pill', onclick: function () { state.view = state.predicted ? 'chosen' : 'pick'; render(); } }, [
        el('span', { class: 'dot' }), label,
      ]));
    } else if (state.view === 'pick') {
      var grid = el('div', { class: 'grid' });
      PATTERNS.forEach(function (p) {
        grid.append(el('button', { class: 'opt', style: '--c:' + p.color, onclick: function () { choose(p.key); }, disabled: state.busy ? 'true' : null }, [
          el('span', { class: 'sw' }), p.name,
        ]));
      });
      grid.append(el('button', { class: 'opt unsure', onclick: function () { choose('unsure'); } }, ['Not sure']));
      var card = el('div', { class: 'card' }, [
        el('div', { class: 'head' }, [el('span', { class: 'title' }, ['Which pattern is this?']), closeBtn(function () { state.view = 'pill'; render(); })]),
        el('div', { class: 'muted' }, ['Decide before you code. You’ll see if you were right after you submit.']),
        grid,
      ]);
      if (state.error) card.append(el('div', { class: 'err' }, [state.error]));
      wrap.append(card);
    } else if (state.view === 'chosen') {
      var p = byKey[state.predicted];
      var c = p ? p.color : '#7c7ff2';
      wrap.append(el('div', { class: 'card' }, [
        el('div', { class: 'head' }, [el('span', { class: 'title' }, ['Guess saved']), closeBtn(function () { state.view = 'pill'; render(); })]),
        el('div', { class: 'chosen', style: '--c:' + c }, [el('span', { class: 'sw', style: '--c:' + c }), p ? p.name : 'Not sure']),
        el('div', { class: 'muted', style: 'margin-top:8px' }, ['Now solve it and submit — CodeInsight will tell you if you spotted the right pattern.']),
        el('button', { class: 'link', onclick: function () { state.view = 'pick'; render(); } }, ['Change my guess']),
      ]));
    } else if (state.view === 'feedback' && state.feedback) {
      var fb = state.feedback;
      var color = OUTCOME_COLOR[fb.outcome] || '#7c7ff2';
      var body = [el('div', { class: 'head' }, [el('span', { class: 'muted' }, [fb.verdict ? 'Submitted · ' + fb.verdict : 'Pattern check']), closeBtn(function () { state.view = 'pill'; render(); })])];
      body.push(el('div', { class: 'fb', style: '--c:' + color }, [
        el('div', { class: 'title' }, [fb.title]),
        el('div', { style: 'margin-top:4px' }, [fb.message]),
      ]));
      if (fb.pattern) body.push(el('div', { class: 'muted', style: 'margin-top:8px' }, ['Optimal: ' + fb.pattern.complexity]));
      wrap.append(el('div', { class: 'card' }, body));
    }
    root.append(wrap);
  }

  /** Called by bridge.js once a submission has been uploaded. */
  function showFeedback(feedback, slug) {
    if (!feedback || (slug && slug !== state.slug)) return;
    state.feedback = feedback;
    state.predicted = null;
    try { sessionStorage.removeItem(storeKey(state.slug)); } catch (e) { /* ignore */ }
    state.view = 'feedback';
    state.dismissed = false;
    render();
  }

  /** Fallback when the upload response didn't reach the page (navigation). */
  function fetchFeedback(slug) {
    if (!slug || slug !== state.slug) return;
    send({ type: 'GET_FEEDBACK', slug: slug }, function (res) {
      if (res.success && res.data && res.data.verdict) showFeedback(res.data, slug);
    });
  }

  // LeetCode is a single-page app: follow the URL to know which problem is open.
  function sync() {
    var slug = slugFromPath();
    if (slug === state.slug) return;
    state = { slug: slug, view: 'pill', predicted: slug ? loadGuess(slug) : null, feedback: null, error: null, dismissed: false, busy: false };
    render();
  }

  window.CodeInsightPicker = { showFeedback: showFeedback, fetchFeedback: fetchFeedback };

  function start() { sync(); setInterval(sync, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
