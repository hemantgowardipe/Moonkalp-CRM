/**
 * Bookkeeping for instant navigation feedback.
 *
 * Workspace pages are rendered on the server, so after a click the router has
 * to wait for the next page before it can show it. While that request is in
 * flight a <Link> reports "navigation to <target> is pending" for a UI scope
 * (the workspace main area, the settings content, ...). Regions in that scope
 * swap their stale content for a skeleton of the destination, and the global
 * progress bar runs while anything at all is pending.
 *
 * Framework-free so it can be unit tested with node:test.
 */
export function createNavigationPendingStore() {
  // Insertion-ordered, so the last entry for a scope is the newest click.
  const pending = new Map();
  const listeners = new Set();
  let lastToken = 0;

  function notify() {
    listeners.forEach((listener) => listener());
  }

  return {
    /** Records a pending navigation and returns an idempotent release function. */
    begin(scope, target = null) {
      lastToken += 1;
      const token = lastToken;
      pending.set(token, { scope, target });
      notify();
      return () => {
        if (pending.delete(token)) notify();
      };
    },

    /** The newest pending target for `scope`, or null when nothing is pending there. */
    getTarget(scope) {
      let target = null;
      for (const entry of pending.values()) {
        if (entry.scope === scope) target = entry.target;
      }
      return target;
    },

    isPending() {
      return pending.size > 0;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * True when following `href` from `currentUrl` (pathname plus search) only
 * changes the hash. Next.js scrolls to the anchor without a server round
 * trip, so loading feedback would just flash. Mirrors the router's own
 * `onlyHashChange` test: same pathname, same search, a hash present.
 */
export function isSamePageHashLink(href, currentUrl) {
  if (typeof href !== "string" || typeof currentUrl !== "string") return false;
  if (!href.includes("#")) return false;
  if (href.startsWith("#")) return true;

  const base = "http://same-page.local";
  let target;
  let current;
  try {
    target = new URL(href, `${base}${currentUrl}`);
    current = new URL(currentUrl, base);
  } catch {
    return false;
  }

  return target.origin === base && target.pathname === current.pathname && target.search === current.search;
}
