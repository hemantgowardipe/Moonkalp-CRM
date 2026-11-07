import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultDueDate,
  normalizeDensity,
  normalizeTheme,
  parseAppearanceForm,
  parseOrganizationForm,
  parseProfileForm,
  summarizeAuditChanges,
} from "../src/lib/settingsRules.mjs";

function form(fields) {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.set(key, value));
  return data;
}

const ORGANIZATION = {
  agency_name: "Moonkalp Studio",
  support_email: "Help@Moonkalp.in",
  support_phone: "+91 98765 43210",
  website_url: "https://moonkalp.in",
  payment_terms_days: "15",
  revision_turnaround_days: "2",
};

test("unknown appearance values fall back to safe defaults", () => {
  assert.equal(normalizeTheme("dark"), "dark");
  assert.equal(normalizeTheme("purple"), "system");
  assert.equal(normalizeTheme(undefined), "system");
  assert.equal(normalizeDensity("compact"), "compact");
  assert.equal(normalizeDensity("<script>"), "comfortable");
  assert.deepEqual(parseAppearanceForm(form({ theme: "light", density: "compact" })).values, { theme: "light", density: "compact" });
  assert.match(parseAppearanceForm(form({ theme: "neon", density: "compact" })).error, /theme/);
});

test("profile names are trimmed, collapsed, and length-limited", () => {
  assert.equal(parseProfileForm(form({ full_name: "  Asha   Rao " })).values.full_name, "Asha Rao");
  assert.match(parseProfileForm(form({ full_name: "   " })).error, /Enter your name/);
  assert.match(parseProfileForm(form({ full_name: "a".repeat(81) })).error, /80/);
});

test("organization settings validate contact details and service levels", () => {
  const { values } = parseOrganizationForm(form(ORGANIZATION));
  assert.equal(values.support_email, "help@moonkalp.in");
  assert.equal(values.payment_terms_days, 15);
  assert.equal(values.revision_turnaround_days, 2);

  const blanks = parseOrganizationForm(form({ ...ORGANIZATION, support_email: "", support_phone: "", website_url: "" })).values;
  assert.equal(blanks.support_email, null);
  assert.equal(blanks.website_url, null);

  assert.match(parseOrganizationForm(form({ ...ORGANIZATION, agency_name: "" })).error, /agency name/);
  assert.match(parseOrganizationForm(form({ ...ORGANIZATION, support_email: "nope" })).error, /support email/);
  assert.match(parseOrganizationForm(form({ ...ORGANIZATION, website_url: "javascript:alert(1)" })).error, /http/);
  assert.match(parseOrganizationForm(form({ ...ORGANIZATION, payment_terms_days: "1.5" })).error, /Payment terms/);
  assert.match(parseOrganizationForm(form({ ...ORGANIZATION, payment_terms_days: "121" })).error, /Payment terms/);
  assert.match(parseOrganizationForm(form({ ...ORGANIZATION, revision_turnaround_days: "0" })).error, /turnaround/);
});

test("default invoice due date adds the payment terms across month ends", () => {
  assert.equal(defaultDueDate(15, new Date(2026, 10, 7)), "2026-11-22");
  assert.equal(defaultDueDate(30, new Date(2026, 11, 15)), "2027-01-14");
  assert.equal(defaultDueDate(0, new Date(2026, 1, 28)), "2026-02-28");
});

test("audit summaries describe updates field by field", () => {
  const update = summarizeAuditChanges({
    action: "update",
    changes: { status: { from: "Active", to: "Churned" }, phone: { from: null, to: "123" } },
  });
  assert.deepEqual(update, ["status: Active → Churned", "phone: empty → 123"]);

  const names = new Map([["4b1527c8-0000-4000-8000-000000000000", "Hemant"]]);
  assert.deepEqual(
    summarizeAuditChanges({ action: "update", changes: { updated_by: { from: null, to: "4b1527c8-0000-4000-8000-000000000000" } } }, { names }),
    ["updated by: empty → Hemant"],
  );

  const many = summarizeAuditChanges({
    action: "update",
    changes: Object.fromEntries(["a", "b", "c", "d", "e", "f"].map((key) => [key, { from: 1, to: 2 }])),
  });
  assert.equal(many.length, 5);
  assert.equal(many.at(-1), "+2 more");

  assert.deepEqual(summarizeAuditChanges({ action: "insert", changes: { company_name: "Acme" } }), ["Acme"]);
  assert.deepEqual(summarizeAuditChanges({ action: "delete", changes: { amount: 5000 } }), ["₹5000"]);
});
