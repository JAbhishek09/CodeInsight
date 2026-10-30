/**
 * staleBuild.ts — recover a tab that outlived a deploy.
 *
 * Pages are lazy-loaded chunks with hashed names. After a deploy the old
 * names are gone (the server answers 404), so an open tab fails the first
 * time it opens a page it hadn't loaded yet. Vite reports that as
 * "vite:preloadError"; we reload once to pick up the new build. If we already
 * reloaded moments ago, the problem isn't a stale build (e.g. the network is
 * down), so we let the error reach the page's error screen instead of looping.
 */

const KEY = 'ci_stale_build_reload_at';
/** Within this window after a reload, don't reload again. */
export const RELOAD_GUARD_MS = 30_000;

/** Pure decision, for tests: reload unless we just did. */
export function shouldReload(now: number, lastReloadAt: number | null): boolean {
  return lastReloadAt === null || now - lastReloadAt > RELOAD_GUARD_MS;
}

/** True while the page is reloading into a new build (error screens can say so). */
export let reloadingForNewBuild = false;

export function installStaleBuildReload(win: Window = window) {
  win.addEventListener('vite:preloadError', (event) => {
    let last: number | null;
    try {
      const v = win.sessionStorage.getItem(KEY);
      last = v ? Number(v) : null;
    } catch {
      return; // no storage: we couldn't stop a reload loop, so don't start one
    }
    if (!shouldReload(Date.now(), last)) return;
    try { win.sessionStorage.setItem(KEY, String(Date.now())); } catch { return; }
    reloadingForNewBuild = true;
    event.preventDefault();
    win.location.reload();
  });
}
