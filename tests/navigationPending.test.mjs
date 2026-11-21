import assert from "node:assert/strict";
import test from "node:test";
import { createNavigationPendingStore, isSamePageHashLink } from "../src/lib/navigationPending.mjs";

test("a pending navigation is visible to its scope until it is released", () => {
  const store = createNavigationPendingStore();
  assert.equal(store.isPending(), false);
  assert.equal(store.getTarget("workspace"), null);

  const release = store.begin("workspace", "settings");
  assert.equal(store.isPending(), true);
  assert.equal(store.getTarget("workspace"), "settings");
  assert.equal(store.getTarget("settings"), null, "other scopes are unaffected");

  release();
  assert.equal(store.isPending(), false);
  assert.equal(store.getTarget("workspace"), null);
});

test("the newest click wins and releasing an older one keeps it", () => {
  const store = createNavigationPendingStore();
  const releaseTeam = store.begin("settings", "team");
  const releaseAudit = store.begin("settings", "audit");
  assert.equal(store.getTarget("settings"), "audit");

  releaseTeam();
  assert.equal(store.getTarget("settings"), "audit");
  assert.equal(store.isPending(), true);

  releaseAudit();
  assert.equal(store.isPending(), false);
});

test("release is idempotent and only notifies on real changes", () => {
  const store = createNavigationPendingStore();
  let notifications = 0;
  const unsubscribe = store.subscribe(() => {
    notifications += 1;
  });

  const release = store.begin("workspace", "overview");
  release();
  release();
  assert.equal(notifications, 2, "one begin and one release");

  unsubscribe();
  store.begin("workspace", "settings");
  assert.equal(notifications, 2, "unsubscribed listeners are not called");
});

test("a hand-off between two links in one tick never reads as idle", () => {
  const store = createNavigationPendingStore();
  const snapshots = [];
  store.subscribe(() => snapshots.push(store.isPending()));

  const releaseFirst = store.begin("workspace", "settings");
  // React runs the old link's cleanup and the new link's setup together.
  const releaseSecond = store.begin("workspace", "overview");
  releaseFirst();
  assert.equal(store.isPending(), true);
  assert.equal(store.getTarget("workspace"), "overview");

  releaseSecond();
  assert.deepEqual(snapshots, [true, true, true, false]);
});

test("hash links on the current page are detected like the Next.js router does", () => {
  assert.equal(isSamePageHashLink("/admin/dashboard#clients", "/admin/dashboard"), true);
  assert.equal(isSamePageHashLink("#deliverables", "/client/portal"), true);
  assert.equal(isSamePageHashLink("/client/portal#billing", "/client/portal"), true);
});

test("anything that changes the path or query is a real navigation", () => {
  assert.equal(isSamePageHashLink("/admin/dashboard#clients", "/settings"), false);
  assert.equal(isSamePageHashLink("/admin/dashboard#clients", "/admin/dashboard?tab=1"), false);
  assert.equal(isSamePageHashLink("/settings?section=team", "/settings?section=profile"), false);
  assert.equal(isSamePageHashLink("/settings", "/settings"), false, "no hash means no anchor jump");
  assert.equal(isSamePageHashLink("https://example.com/admin/dashboard#x", "/admin/dashboard"), false);
  assert.equal(isSamePageHashLink(undefined, "/settings"), false);
});
