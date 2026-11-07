import assert from "node:assert/strict";
import test from "node:test";
import {
  parseDeliverableForm,
  parsePaymentForm,
  parseServiceForm,
  todayIsoDate,
} from "../src/lib/crmRecords.mjs";

const CLIENT_ID = "3bab4e2d-2a91-4b46-b3f6-3d30bbc29b93";

function form(fields) {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.set(key, value));
  return data;
}

test("parses a valid service and leaves an empty renewal date null", () => {
  const { values, error } = parseServiceForm(form({
    client_id: CLIENT_ID,
    service_type: "Social Media",
    monthly_retainer: "25000",
    start_date: "2026-11-01",
    renewal_date: "",
  }));

  assert.equal(error, undefined);
  assert.deepEqual(values, {
    client_id: CLIENT_ID,
    service_type: "Social Media",
    monthly_retainer: 25000,
    start_date: "2026-11-01",
    renewal_date: null,
    status: "Active",
  });
});

test("rejects a service renewing before it starts", () => {
  const { error } = parseServiceForm(form({
    client_id: CLIENT_ID,
    service_type: "Website Management",
    monthly_retainer: "1000",
    start_date: "2026-11-10",
    renewal_date: "2026-11-01",
  }));

  assert.match(error, /Renewal date/);
});

test("defaults a new deliverable to Drafting and rejects unknown categories", () => {
  const valid = parseDeliverableForm(form({
    service_id: CLIENT_ID,
    title: "  Diwali reel  ",
    category: "Reel",
  }));
  assert.equal(valid.values.title, "Diwali reel");
  assert.equal(valid.values.pipeline_status, "Drafting");
  assert.equal(valid.values.due_date, null);

  const invalid = parseDeliverableForm(form({ service_id: CLIENT_ID, title: "X", category: "Story" }));
  assert.match(invalid.error, /category/);
});

test("only sets a paid date on paid payments, defaulting to today", () => {
  const now = new Date(2026, 10, 7);
  const pending = parsePaymentForm(form({
    client_id: CLIENT_ID,
    amount: "5000",
    payment_status: "Pending",
    due_date: "2026-11-30",
    paid_date: "2026-11-05",
  }), now);
  assert.equal(pending.values.paid_date, null);

  const paid = parsePaymentForm(form({
    client_id: CLIENT_ID,
    amount: "5000",
    payment_status: "Paid",
    due_date: "2026-11-30",
  }), now);
  assert.equal(paid.values.paid_date, "2026-11-07");
  assert.equal(todayIsoDate(now), "2026-11-07");

  const zero = parsePaymentForm(form({ client_id: CLIENT_ID, amount: "0", due_date: "2026-11-30" }), now);
  assert.match(zero.error, /greater than zero/);
});
