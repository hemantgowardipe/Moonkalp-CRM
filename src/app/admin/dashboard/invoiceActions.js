"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { isUuid, todayIsoDate } from "@/lib/crmRecords.mjs";
import { invoiceActionError, invoiceTotal, parseInvoiceForm } from "@/lib/invoiceRules.mjs";
import { buildNotification } from "@/lib/notificationRules.mjs";
import { notifyClientUsers } from "@/lib/notificationsServer";
import { createClient } from "@/lib/supabase/server";

const INVOICE_COLUMNS = "id, invoice_number, client_id, status, issue_date, due_date, notes, invoice_items(id, position, description, quantity, unit_price)";

function logFailure(label, error) {
  console.error(`[${label}] Failed`, JSON.stringify({ code: error.code ?? null, message: error.message }));
}

async function loadInvoice(supabase, formData, field = "invoice_id") {
  const invoiceId = String(formData.get(field) ?? "");
  if (!isUuid(invoiceId)) return { error: "That invoice could not be found." };

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(INVOICE_COLUMNS)
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) return { error: `Could not load the invoice: ${error.message}` };
  if (!invoice) return { error: "That invoice no longer exists." };
  return { invoice };
}

export async function createInvoice(_previousState, formData) {
  const profile = await requireRole(["admin", "team_member"]);
  const { values, items, error: validationError } = parseInvoiceForm(formData);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { data: invoice, error } = await supabase
    .from("invoices")
    .insert({ ...values, created_by: profile.auth_id })
    .select("id")
    .single();

  if (error) {
    logFailure("invoice-create", error);
    return { error: `Could not create the invoice: ${error.message}` };
  }

  const { error: itemsError } = await supabase
    .from("invoice_items")
    .insert(items.map((item) => ({ ...item, invoice_id: invoice.id })));

  if (itemsError) {
    logFailure("invoice-items", itemsError);
    // Leave no half-written invoice behind.
    await supabase.from("invoices").delete().eq("id", invoice.id);
    return { error: `Could not save the line items: ${itemsError.message}` };
  }

  revalidatePath("/admin/dashboard");
  return { success: true };
}

export async function updateInvoice(_previousState, formData) {
  await requireRole(["admin", "team_member"]);
  const { values, items, error: validationError } = parseInvoiceForm(formData);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { invoice, error: loadError } = await loadInvoice(supabase, formData);
  if (loadError) return { error: loadError };

  const actionError = invoiceActionError(invoice, "edit");
  if (actionError) return { error: actionError };

  // The client a draft belongs to is fixed at creation.
  const { client_id: _ignored, ...editable } = values;
  const { error } = await supabase.from("invoices").update(editable).eq("id", invoice.id);
  if (error) {
    logFailure("invoice-update", error);
    return { error: `Could not save the invoice: ${error.message}` };
  }

  const { error: clearError } = await supabase.from("invoice_items").delete().eq("invoice_id", invoice.id);
  const { error: itemsError } = clearError
    ? { error: clearError }
    : await supabase.from("invoice_items").insert(items.map((item) => ({ ...item, invoice_id: invoice.id })));

  if (itemsError) {
    logFailure("invoice-items", itemsError);
    return { error: `Could not save the line items: ${itemsError.message}. Re-open the draft and check its lines.` };
  }

  revalidatePath("/admin/dashboard");
  return { success: true };
}

export async function sendInvoice(_previousState, formData) {
  await requireRole(["admin", "team_member"]);
  const supabase = await createClient();
  const { invoice, error: loadError } = await loadInvoice(supabase, formData);
  if (loadError) return { error: loadError };

  const actionError = invoiceActionError(invoice, "send");
  if (actionError) return { error: actionError };
  if (!invoice.invoice_items?.length) return { error: "Add at least one line item before sending." };

  const { error } = await supabase
    .from("invoices")
    .update({ status: "Sent", sent_at: new Date().toISOString() })
    .eq("id", invoice.id)
    .eq("status", "Draft");

  if (error) {
    logFailure("invoice-send", error);
    return { error: `Could not send the invoice: ${error.message}` };
  }

  const result = await notifyClientUsers(
    invoice.client_id,
    buildNotification("invoice_sent", {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      amount: invoiceTotal(invoice.invoice_items),
      dueDate: invoice.due_date,
    }),
  );

  revalidatePath("/admin/dashboard");
  if (!result.error && result.delivered === 0) {
    return {
      success: true,
      warning: "Invoice sent, but this client has no enabled portal login to notify. Invite them from Portal access.",
    };
  }
  return { success: true, message: `Invoice ${invoice.invoice_number} sent.` };
}

export async function markInvoicePaid(_previousState, formData) {
  await requireRole(["admin", "team_member"]);
  const supabase = await createClient();
  const { invoice, error: loadError } = await loadInvoice(supabase, formData);
  if (loadError) return { error: loadError };

  const actionError = invoiceActionError(invoice, "mark_paid");
  if (actionError) return { error: actionError };

  const amount = invoiceTotal(invoice.invoice_items);
  if (amount <= 0) return { error: "This invoice has no amount to record." };

  // The payment record is the ledger entry; write it first, then settle the
  // invoice, and undo the payment if settling fails.
  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .insert({
      client_id: invoice.client_id,
      invoice_id: invoice.id,
      amount,
      payment_status: "Paid",
      due_date: invoice.due_date,
      paid_date: todayIsoDate(),
      transaction_ref: invoice.invoice_number,
    })
    .select("id")
    .single();

  if (paymentError) {
    logFailure("invoice-payment", paymentError);
    return { error: `Could not record the payment: ${paymentError.message}` };
  }

  const { error } = await supabase
    .from("invoices")
    .update({ status: "Paid", paid_at: new Date().toISOString() })
    .eq("id", invoice.id)
    .in("status", ["Draft", "Sent"]);

  if (error) {
    logFailure("invoice-paid", error);
    await supabase.from("payments").delete().eq("id", payment.id);
    return { error: `Could not mark the invoice as paid: ${error.message}` };
  }

  if (invoice.status === "Sent") {
    await notifyClientUsers(
      invoice.client_id,
      buildNotification("invoice_paid", {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        amount,
      }),
    );
  }

  revalidatePath("/admin/dashboard");
  return { success: true, message: `${invoice.invoice_number} marked as paid.` };
}

export async function voidInvoice(_previousState, formData) {
  await requireRole(["admin", "team_member"]);
  const supabase = await createClient();
  const { invoice, error: loadError } = await loadInvoice(supabase, formData);
  if (loadError) return { error: loadError };

  const actionError = invoiceActionError(invoice, "void");
  if (actionError) return { error: actionError };

  const { error } = await supabase
    .from("invoices")
    .update({ status: "Void" })
    .eq("id", invoice.id)
    .eq("status", "Sent");

  if (error) {
    logFailure("invoice-void", error);
    return { error: `Could not void the invoice: ${error.message}` };
  }

  revalidatePath("/admin/dashboard");
  return { success: true };
}

export async function deleteInvoice(_previousState, formData) {
  await requireRole(["admin", "team_member"]);
  const supabase = await createClient();
  // DeleteControl posts the record id under "id".
  const { invoice, error: loadError } = await loadInvoice(supabase, formData, "id");
  if (loadError) return { error: loadError };

  const actionError = invoiceActionError(invoice, "delete");
  if (actionError) return { error: actionError };

  const { error } = await supabase.from("invoices").delete().eq("id", invoice.id).eq("status", "Draft");
  if (error) {
    logFailure("invoice-delete", error);
    return { error: `Could not delete the draft: ${error.message}` };
  }

  revalidatePath("/admin/dashboard");
  return { success: true };
}
