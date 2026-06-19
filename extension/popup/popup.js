/**
 * popup.js — CodeInsight Extension Popup
 */

const $ = id => document.getElementById(id);

async function getStatus() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      // chrome.runtime.lastError is set (not thrown) when there's no
      // receiving end — e.g. the service worker is dead/asleep and hasn't
      // been (re)started yet. Reading it here prevents an "Unchecked
      // runtime.lastError" warning in the console and lets callers treat
      // a dead background script the same as "undefined response".
      if (chrome.runtime.lastError) {
        console.warn('[CodeInsight Popup] GET_STATUS error:', chrome.runtime.lastError.message);
        resolve(undefined);
        return;
      }
      resolve(response);
    });
  });
}

async function init() {
  const status = await getStatus();

  // Defensive handling: chrome.runtime.sendMessage's resolve callback fires
  // with `undefined` (not a rejection) when there is no receiving end —
  // e.g. the background service worker crashed, hasn't woken up yet, or
  // chrome.runtime.lastError was set. Treat that the same as "not
  // connected" instead of letting `status.authenticated` throw and break
  // the entire popup.
  if (!status) {
    console.warn('[CodeInsight Popup] GET_STATUS returned no response — background service worker may be unavailable.');
    const badge = $('auth-badge');
    badge.textContent = 'Unavailable';
    badge.className = 'badge badge-red';
    $('sync-status').textContent = 'Disabled';
    showMsg('Extension background script is unavailable. Try reloading the extension.', 'err');
    return;
  }

  const badge = $('auth-badge');
  if (status.authenticated) {
    badge.textContent = 'Connected';
    badge.className = 'badge badge-green';
    $('auth-section').style.display = 'none';
    $('connected-section').style.display = 'block';
    $('sync-status').textContent = 'Active';
  } else {
    badge.textContent = 'Not connected';
    badge.className = 'badge badge-red';
    $('sync-status').textContent = 'Disabled';
  }

  if (status.apiBase) {
    $('api-base-input').value = status.apiBase;
  }

  if (status.retryQueueLength > 0) {
    $('queue-notice').style.display = 'block';
    $('queue-count').textContent = status.retryQueueLength;
  }
}

// Toggle JWT visibility
$('toggle-jwt').addEventListener('click', () => {
  const input = $('jwt-input');
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  $('toggle-jwt').textContent = isHidden ? 'Hide' : 'Show';
});

// Save settings
$('save-btn').addEventListener('click', async () => {
  const jwt = $('jwt-input').value.trim();
  const apiBase = $('api-base-input').value.trim();

  if (!jwt) {
    showMsg('Please paste your JWT token.', 'err');
    return;
  }

  $('save-btn').disabled = true;
  $('save-btn').textContent = 'Saving…';

  chrome.runtime.sendMessage({ type: 'SAVE_SETTINGS', jwt, apiBase }, (res) => {
    $('save-btn').disabled = false;
    $('save-btn').textContent = 'Save & Connect';

    if (res?.success) {
      showMsg('Connected! Submissions will sync automatically.', 'ok');
      setTimeout(init, 800);
    } else {
      showMsg('Failed to save. Please try again.', 'err');
    }
  });
});

// Logout
$('logout-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'CLEAR_AUTH' }, () => {
    showMsg('Disconnected.', 'ok');
    setTimeout(init, 600);
  });
});

function showMsg(text, type) {
  const el = $('msg');
  el.textContent = text;
  el.className = `msg msg-${type}`;
  setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 4000);
}

init();
