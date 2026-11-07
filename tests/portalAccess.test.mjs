import assert from "node:assert/strict";
import test from "node:test";
import { validateNewPassword } from "../src/lib/passwordPolicy.mjs";
import {
  describeAuthError,
  getAuthLinkDestination,
  getPortalStatus,
  isAuthLinkType,
  isRecentEmailLinkSession,
} from "../src/lib/portalAccess.mjs";

test("derives portal status from the access row", () => {
  assert.equal(getPortalStatus(null), "not_invited");
  assert.equal(getPortalStatus({ password_set: false, disabled_at: null }), "invited");
  assert.equal(getPortalStatus({ password_set: true, disabled_at: null }), "active");
  // Disabled wins regardless of password state.
  assert.equal(getPortalStatus({ password_set: true, disabled_at: "2026-11-07T10:00:00Z" }), "disabled");
  assert.equal(getPortalStatus({ password_set: false, disabled_at: "2026-11-07T10:00:00Z" }), "disabled");
});

test("only allow-listed auth link types choose the post-link destination", () => {
  assert.equal(getAuthLinkDestination("recovery"), "/reset-password");
  assert.equal(getAuthLinkDestination("invite"), "/client/setup-password");
  assert.equal(getAuthLinkDestination(null), "/client/setup-password");
  // Inherited object keys must not be treated as destinations.
  assert.equal(isAuthLinkType("constructor"), false);
  assert.equal(getAuthLinkDestination("constructor"), "/client/setup-password");
  assert.equal(getAuthLinkDestination("__proto__"), "/client/setup-password");
  assert.equal(isAuthLinkType("signup"), false);
});

test("recognises Supabase email rate-limit errors", () => {
  assert.match(describeAuthError({ status: 429 }), /Too many emails/);
  assert.match(describeAuthError({ code: "over_email_send_rate_limit" }), /Too many emails/);
  assert.equal(describeAuthError({ status: 400, message: "bad" }), null);
});

test("enforces the new-password policy", () => {
  assert.match(validateNewPassword("short", "short"), /at least 8/);
  assert.match(validateNewPassword("a".repeat(73), "a".repeat(73)), /too long/);
  // 24 three-byte characters = 72 bytes is allowed; 25 is not.
  assert.equal(validateNewPassword("€".repeat(24), "€".repeat(24)), null);
  assert.match(validateNewPassword("€".repeat(25), "€".repeat(25)), /too long/);
  assert.match(validateNewPassword(" padded-pass ", " padded-pass "), /space/);
  assert.match(validateNewPassword("correct-horse", "correct-house"), /do not match/);
  assert.equal(validateNewPassword("correct-horse", "correct-horse"), null);
});

test("password screens only accept recent emailed-link sessions", () => {
  const now = 1_800_000_000;
  assert.equal(isRecentEmailLinkSession({ amr: [{ method: "recovery", timestamp: now - 60 }] }, now), true);
  assert.equal(isRecentEmailLinkSession({ amr: [{ method: "invite", timestamp: now - 3600 }] }, now), true);
  assert.equal(isRecentEmailLinkSession({ amr: [{ method: "invite", timestamp: now - 3601 }] }, now), false);
  // A normal password sign-in cannot reach the password screens.
  assert.equal(isRecentEmailLinkSession({ amr: [{ method: "password", timestamp: now }] }, now), false);
  assert.equal(isRecentEmailLinkSession({ amr: ["recovery"] }, now), false);
  assert.equal(isRecentEmailLinkSession({}, now), false);
  assert.equal(isRecentEmailLinkSession(null, now), false);
});
