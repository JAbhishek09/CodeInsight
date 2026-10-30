// Run with: npm test
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { RELOAD_GUARD_MS, installStaleBuildReload, shouldReload } from './staleBuild.ts';

/** A tiny stand-in for window: events, sessionStorage and location.reload. */
function fakeWindow({ storage = true } = {}) {
  const listeners = new Map<string, ((e: Event) => void)[]>();
  const store = new Map<string, string>();
  let reloads = 0;
  const win = {
    addEventListener: (type: string, fn: (e: Event) => void) => listeners.set(type, [...(listeners.get(type) ?? []), fn]),
    sessionStorage: storage
      ? { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } }
      : { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } },
    location: { reload: () => { reloads += 1; } },
  };
  const fire = () => {
    const e = new Event('vite:preloadError', { cancelable: true });
    for (const fn of listeners.get('vite:preloadError') ?? []) fn(e);
    return e.defaultPrevented;
  };
  return { win: win as unknown as Window, fire, reloads: () => reloads };
}

describe('reloading into a new build', () => {
  test('reload unless we just did', () => {
    const now = 1_000_000;
    assert.equal(shouldReload(now, null), true);
    assert.equal(shouldReload(now, now - 5_000), false);
    assert.equal(shouldReload(now, now - RELOAD_GUARD_MS - 1), true);
  });

  test('the first missing chunk reloads the page; a second one right after does not loop', () => {
    const w = fakeWindow();
    installStaleBuildReload(w.win);
    assert.equal(w.fire(), true, 'handled: the error is not thrown at the page');
    assert.equal(w.reloads(), 1);
    // Still failing straight after the reload: not a stale build, let the page show the error
    assert.equal(w.fire(), false);
    assert.equal(w.reloads(), 1);
  });

  test('without storage it never reloads (it could not stop a loop)', () => {
    const w = fakeWindow({ storage: false });
    installStaleBuildReload(w.win);
    assert.equal(w.fire(), false);
    assert.equal(w.reloads(), 0);
  });
});
