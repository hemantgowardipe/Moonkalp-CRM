import assert from "node:assert/strict";
import test from "node:test";
import { getAgencyDashboardMetrics, formatAgencyDashboardCurrency } from "../src/lib/agencyDashboard.mjs";
import { getClientInviteRedirectUrl } from "../src/lib/clientInvite.mjs";
import { formatCurrency } from "../src/lib/formatCurrency.mjs";

test("formats rupee amounts with Indian grouping and no decimal places", () => {
  assert.equal(formatCurrency(125000), "₹1,25,000");
});

test("formats zero and numeric string amounts", () => {
  assert.equal(formatCurrency(0), "₹0");
  assert.equal(formatCurrency("1250"), "₹1,250");
});

test("builds dashboard revenue, dues, client, and deliverable metrics", () => {
  const metrics = getAgencyDashboardMetrics([
    {
      company_name: "Acme Studio",
      status: "Active",
      client_services: [
        {
          service_type: "Social Media",
          status: "Active",
          monthly_retainer: "25000",
          deliverables: [
            { id: "later", title: "Later post", due_date: "2026-12-01" },
            { id: "sooner", title: "Sooner reel", due_date: "2026-11-15" },
          ],
        },
        {
          service_type: "Website Management",
          status: "Paused",
          monthly_retainer: "10000",
          deliverables: [],
        },
      ],
      payments: [
        { amount: "5000", payment_status: "Pending" },
        { amount: "2500", payment_status: "Overdue" },
        { amount: "9000", payment_status: "Paid" },
      ],
    },
    { company_name: "Dormant Co", status: "Paused", client_services: [], payments: [] },
  ]);

  assert.equal(metrics.mrr, 25000);
  assert.equal(metrics.pendingDues, 7500);
  assert.equal(metrics.pendingInvoiceCount, 2);
  assert.equal(metrics.activeServices.length, 1);
  assert.equal(metrics.activeClientCount, 1);
  assert.equal(metrics.clientCount, 2);
  assert.deepEqual(metrics.deliverables.map((item) => item.id), ["sooner", "later"]);
  assert.equal(metrics.deliverables[0].clientName, "Acme Studio");
  assert.equal(formatAgencyDashboardCurrency(metrics.mrr), "₹25,000");
  assert.equal(formatAgencyDashboardCurrency(metrics.pendingDues), "₹7,500");
});

test("builds zero dashboard metrics when there are no clients", () => {
  const metrics = getAgencyDashboardMetrics([]);

  assert.equal(metrics.clientCount, 0);
  assert.equal(metrics.activeClientCount, 0);
  assert.equal(metrics.mrr, 0);
  assert.equal(metrics.pendingDues, 0);
  assert.equal(metrics.pendingInvoiceCount, 0);
  assert.deepEqual(metrics.deliverables, []);
});

test("builds safe client invitation redirect URLs", () => {
  assert.equal(
    getClientInviteRedirectUrl("http://localhost:3000").redirectTo,
    "http://localhost:3000/auth/callback",
  );
  assert.equal(
    getClientInviteRedirectUrl("https://crm.example.com/").redirectTo,
    "https://crm.example.com/auth/callback",
  );
  assert.match(getClientInviteRedirectUrl("http://crm.example.com").error, /HTTPS/);
  assert.match(getClientInviteRedirectUrl("javascript:alert(1)").error, /HTTPS/);
  assert.match(getClientInviteRedirectUrl("").error, /NEXT_PUBLIC_SITE_URL/);
});
