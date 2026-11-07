import assert from "node:assert/strict";
import test from "node:test";
import { resolveSiteUrl } from "../src/lib/clientInvite.mjs";

const VERCEL_PROD = { VERCEL: "1", VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "moonkalp-crm.vercel.app", VERCEL_URL: "moonkalp-crm-abc123.vercel.app" };

test("local development keeps the configured site URL", () => {
  assert.equal(resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }), "http://localhost:3000");
  assert.equal(resolveSiteUrl({}), undefined);
});

test("a deployed app never links auth emails to localhost", () => {
  assert.equal(resolveSiteUrl({ ...VERCEL_PROD, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" }), "https://moonkalp-crm.vercel.app");
  assert.equal(resolveSiteUrl({ ...VERCEL_PROD, NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000" }), "https://moonkalp-crm.vercel.app");
  assert.equal(resolveSiteUrl(VERCEL_PROD), "https://moonkalp-crm.vercel.app");
  assert.equal(resolveSiteUrl({ ...VERCEL_PROD, VERCEL_ENV: "preview" }), "https://moonkalp-crm-abc123.vercel.app");
});

test("an explicit public site URL (for example a custom domain) still wins", () => {
  assert.equal(resolveSiteUrl({ ...VERCEL_PROD, NEXT_PUBLIC_SITE_URL: "https://crm.moonkalp.in" }), "https://crm.moonkalp.in");
});
