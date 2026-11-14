import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_INVOICE_ITEMS,
  displayInvoiceStatus,
  invoiceActionError,
  invoiceTotal,
  outstandingInvoiceTotal,
  parseInvoiceForm,
} from "../src/lib/invoiceRules.mjs";
import { getAgencyDashboardMetrics } from "../src/lib/agencyDashboard.mjs";

const CLIENT_ID = "4b1527c8-0000-4000-8000-000000000000";

function form(fields, items = []) {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.set(key, value));
  items.forEach((item) => {
    data.append("item_description", item.description ?? "");
    data.append("item_quantity", item.quantity ?? "");
    data.append("item_unit_price", item.unit_price ?? "");
  });
  return data;
}

const BASE = { client_id: CLIENT_ID, issue_date: "2026-11-14", due_date: "2026-11-29", notes: "" };
const LINE = { description: "Social media retainer", quantity: "1", unit_price: "25000" };

test("parses a valid invoice and keeps item order", () => {
  const { values, items, error } = parseInvoiceForm(
    form({ ...BASE, notes: "  UPI accepted  " }, [LINE, { description: "Extra reel", quantity: "2", unit_price: "1500.505" }]),
  );
  assert.equal(error, undefined);
  assert.deepEqual(values, { client_id: CLIENT_ID, issue_date: "2026-11-14", due_date: "2026-11-29", notes: "UPI accepted" });
  assert.deepEqual(items, [
    { position: 0, description: "Social media retainer", quantity: 1, unit_price: 25000 },
    { position: 1, description: "Extra reel", quantity: 2, unit_price: 1500.51 },
  ]);
});

test("blank rows are skipped but a partial row is an error", () => {
  const { items } = parseInvoiceForm(form(BASE, [LINE, { description: "", quantity: "", unit_price: "" }]));
  assert.equal(items.length, 1);

  assert.match(parseInvoiceForm(form(BASE, [{ description: "", quantity: "3", unit_price: "100" }])).error, /Line 1/);
  assert.match(parseInvoiceForm(form(BASE, [])).error, /at least one line item/);
});

test("rejects invalid dates, quantities, and prices", () => {
  assert.match(parseInvoiceForm(form({ ...BASE, client_id: "nope" }, [LINE])).error, /client/);
  assert.match(parseInvoiceForm(form({ ...BASE, due_date: "2026-11-01" }, [LINE])).error, /due date/i);
  assert.match(parseInvoiceForm(form({ ...BASE, issue_date: "2026-13-40" }, [LINE])).error, /issue date/);
  assert.match(parseInvoiceForm(form(BASE, [{ ...LINE, quantity: "0" }])).error, /quantity/);
  assert.match(parseInvoiceForm(form(BASE, [{ ...LINE, unit_price: "-5" }])).error, /unit price/);
  assert.match(parseInvoiceForm(form({ ...BASE, notes: "x".repeat(2001) }, [LINE])).error, /Notes/);
  const tooMany = Array.from({ length: MAX_INVOICE_ITEMS + 1 }, () => ({ ...LINE }));
  assert.match(parseInvoiceForm(form(BASE, tooMany)).error, /at most/);
});

test("totals multiply quantity by unit price without float drift", () => {
  assert.equal(invoiceTotal([{ quantity: 3, unit_price: 0.1 }]), 0.3);
  assert.equal(invoiceTotal([{ quantity: 1, unit_price: 25000 }, { quantity: 2, unit_price: 1500.51 }]), 28001.02);
  assert.equal(invoiceTotal([]), 0);
  assert.equal(invoiceTotal(undefined), 0);
});

test("a sent invoice past its due date displays as Overdue", () => {
  const invoice = { status: "Sent", due_date: "2026-11-10" };
  assert.equal(displayInvoiceStatus(invoice, "2026-11-14"), "Overdue");
  assert.equal(displayInvoiceStatus(invoice, "2026-11-10"), "Sent");
  assert.equal(displayInvoiceStatus({ status: "Paid", due_date: "2026-11-01" }, "2026-11-14"), "Paid");
  assert.equal(displayInvoiceStatus({ status: "Draft", due_date: "2026-11-01" }, "2026-11-14"), "Draft");
});

test("workflow actions are only allowed from the right status", () => {
  assert.equal(invoiceActionError({ status: "Draft" }, "send"), null);
  assert.match(invoiceActionError({ status: "Sent" }, "send"), /already been sent/);
  assert.equal(invoiceActionError({ status: "Sent" }, "mark_paid"), null);
  assert.match(invoiceActionError({ status: "Paid" }, "mark_paid"), /cannot be marked/);
  assert.equal(invoiceActionError({ status: "Sent" }, "void"), null);
  assert.match(invoiceActionError({ status: "Draft" }, "void"), /sent, unpaid/);
  assert.match(invoiceActionError({ status: "Sent" }, "delete"), /Void a sent invoice/);
  assert.match(invoiceActionError({ status: "Sent" }, "edit"), /draft/);
  assert.match(invoiceActionError({ status: "Draft" }, "unknown"), /Unknown/);
});

test("outstanding total only counts sent invoices", () => {
  const invoices = [
    { status: "Sent", invoice_items: [{ quantity: 1, unit_price: 5000 }] },
    { status: "Paid", invoice_items: [{ quantity: 1, unit_price: 99999 }] },
    { status: "Draft", invoice_items: [{ quantity: 1, unit_price: 100 }] },
    { status: "Void", invoice_items: [{ quantity: 1, unit_price: 100 }] },
    { status: "Sent", invoice_items: [{ quantity: 2, unit_price: 750.25 }] },
  ];
  assert.equal(outstandingInvoiceTotal(invoices), 6500.5);
  assert.equal(outstandingInvoiceTotal([]), 0);
});

test("dashboard pending dues include unpaid payments and sent invoices", () => {
  const clients = [
    {
      status: "Active",
      client_services: [],
      payments: [
        { amount: "1000", payment_status: "Pending" },
        { amount: "500", payment_status: "Paid" },
      ],
      invoices: [
        { status: "Sent", invoice_items: [{ quantity: 1, unit_price: 2500 }] },
        { status: "Draft", invoice_items: [{ quantity: 1, unit_price: 9999 }] },
      ],
    },
  ];
  const metrics = getAgencyDashboardMetrics(clients);
  assert.equal(metrics.pendingDues, 3500);
  assert.equal(metrics.pendingInvoiceCount, 2);
});
