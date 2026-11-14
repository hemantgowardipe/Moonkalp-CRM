import { isUuid } from "./crmRecords.mjs";

export const INVOICE_STATUSES = ["Draft", "Sent", "Paid", "Void"];
export const MAX_INVOICE_ITEMS = 20;

// What each workflow action is allowed to start from. Draft invoices are
// editable and deletable; once sent they can only be paid or voided, so the
// numbered history stays intact (void instead of delete).
const ACTION_RULES = {
  edit: { from: ["Draft"], error: "Only draft invoices can be edited." },
  delete: { from: ["Draft"], error: "Only draft invoices can be deleted. Void a sent invoice instead." },
  send: { from: ["Draft"], error: "This invoice has already been sent." },
  mark_paid: { from: ["Draft", "Sent"], error: "This invoice cannot be marked as paid." },
  void: { from: ["Sent"], error: "Only sent, unpaid invoices can be voided." },
};

function text(formData, name) {
  return String(formData.get(name) ?? "").trim();
}

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function parseItems(formData) {
  const descriptions = formData.getAll("item_description").map((value) => String(value).trim());
  const quantities = formData.getAll("item_quantity").map((value) => String(value).trim());
  const unitPrices = formData.getAll("item_unit_price").map((value) => String(value).trim());

  const items = [];
  for (let index = 0; index < descriptions.length; index += 1) {
    const description = descriptions[index];
    const quantityText = quantities[index] ?? "";
    const priceText = unitPrices[index] ?? "";
    if (!description && !quantityText && !priceText) continue; // an untouched blank row

    const quantity = Number(quantityText || "1");
    const unitPrice = Number(priceText);

    if (!description) return { error: `Line ${index + 1} needs a description.` };
    if (description.length > 200) return { error: `Line ${index + 1}: keep the description to 200 characters.` };
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 9999) {
      return { error: `Line ${index + 1}: quantity must be between 1 and 9,999.` };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 99999999) {
      return { error: `Line ${index + 1}: enter a valid unit price.` };
    }

    items.push({
      position: items.length,
      description,
      quantity: Math.round(quantity * 100) / 100,
      unit_price: Math.round(unitPrice * 100) / 100,
    });
  }

  if (!items.length) return { error: "Add at least one line item." };
  if (items.length > MAX_INVOICE_ITEMS) return { error: `An invoice can have at most ${MAX_INVOICE_ITEMS} line items.` };
  return { items };
}

export function parseInvoiceForm(formData) {
  const clientId = text(formData, "client_id");
  const issueDate = text(formData, "issue_date");
  const dueDate = text(formData, "due_date");
  const notes = text(formData, "notes");

  if (!isUuid(clientId)) return { error: "Select a valid client record." };
  if (!isDate(issueDate)) return { error: "Enter a valid issue date." };
  if (!isDate(dueDate)) return { error: "Enter a valid due date." };
  if (dueDate < issueDate) return { error: "The due date cannot be before the issue date." };
  if (notes.length > 2000) return { error: "Notes must be 2,000 characters or fewer." };

  const { items, error } = parseItems(formData);
  if (error) return { error };

  return {
    values: { client_id: clientId, issue_date: issueDate, due_date: dueDate, notes: notes || null },
    items,
  };
}

export function invoiceTotal(items) {
  const total = (items ?? []).reduce(
    (sum, item) => sum + Number(item.quantity) * Number(item.unit_price),
    0,
  );
  return Math.round(total * 100) / 100;
}

/** The status shown to people: a sent invoice past its due date reads Overdue. */
export function displayInvoiceStatus(invoice, todayDate) {
  if (invoice.status === "Sent" && todayDate && invoice.due_date < todayDate) return "Overdue";
  return invoice.status;
}

/** Null when the action is allowed from the invoice's current status. */
export function invoiceActionError(invoice, action) {
  const rule = ACTION_RULES[action];
  if (!rule) return "Unknown invoice action.";
  return rule.from.includes(invoice.status) ? null : rule.error;
}

/** Everything issued but not yet settled: what the client still owes. */
export function outstandingInvoiceTotal(invoices) {
  return (invoices ?? [])
    .filter((invoice) => invoice.status === "Sent")
    .reduce((sum, invoice) => Math.round((sum + invoiceTotal(invoice.invoice_items)) * 100) / 100, 0);
}
