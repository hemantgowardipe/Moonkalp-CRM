"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import {
  createInvoice,
  deleteInvoice,
  markInvoicePaid,
  sendInvoice,
  updateInvoice,
  voidInvoice,
} from "@/app/admin/dashboard/invoiceActions";
import { todayIsoDate } from "@/lib/crmRecords.mjs";
import { formatCurrency } from "@/lib/formatCurrency.mjs";
import { MAX_INVOICE_ITEMS, displayInvoiceStatus, invoiceTotal } from "@/lib/invoiceRules.mjs";
import { defaultDueDate } from "@/lib/settingsRules.mjs";

const initialState = { error: "", success: false };

function useRefreshingAction(serverAction, onSaved) {
  const [state, action, pending] = useActionState(serverAction, initialState);
  const router = useRouter();
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  useEffect(() => {
    if (!state.success) return;
    onSavedRef.current?.(state);
    router.refresh();
  }, [router, state]);

  return [state, action, pending];
}

function formatDate(value) {
  return value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";
}

function Status({ children }) {
  const className = String(children).toLowerCase().replaceAll(" ", "-");
  return <span className={`status-pill status-${className}`}>{children}</span>;
}

function WorkflowButton({ serverAction, invoiceId, label, pendingLabel, confirm, danger, onMessage }) {
  const [state, action, pending] = useRefreshingAction(serverAction, onMessage);
  const [confirming, setConfirming] = useState(false);

  if (confirm && !confirming) {
    return (
      <button className={danger ? "invoice-action invoice-action-danger" : "invoice-action"} onClick={() => setConfirming(true)} type="button">
        {label}
      </button>
    );
  }

  return (
    <form action={action} className="invoice-action-form">
      <input name="invoice_id" type="hidden" value={invoiceId} />
      {confirm ? (
        <>
          <span className="invoice-confirm-note">{confirm}</span>
          <button className="button button-quiet" onClick={() => setConfirming(false)} type="button">Cancel</button>
        </>
      ) : null}
      <button className={danger ? "invoice-action invoice-action-danger" : "invoice-action"} disabled={pending} type="submit">
        {pending ? pendingLabel : confirm ? `Confirm: ${label.toLowerCase()}` : label}
      </button>
      {state.error ? <span className="form-error">{state.error}</span> : null}
    </form>
  );
}

function DeleteDraftButton({ invoiceId }) {
  const [state, action, pending] = useRefreshingAction(deleteInvoice);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="invoice-action invoice-action-danger" onClick={() => setConfirming(true)} type="button">
        Delete draft
      </button>
    );
  }

  return (
    <form action={action} className="invoice-action-form">
      <input name="id" type="hidden" value={invoiceId} />
      <span className="invoice-confirm-note">Delete this draft permanently?</span>
      <button className="button button-quiet" onClick={() => setConfirming(false)} type="button">Keep it</button>
      <button className="invoice-action invoice-action-danger" disabled={pending} type="submit">
        {pending ? "Deleting..." : "Confirm delete"}
      </button>
      {state.error ? <span className="form-error">{state.error}</span> : null}
    </form>
  );
}

const BLANK_ITEM = { description: "", quantity: "1", unit_price: "" };

function InvoiceForm({ clientId, invoice, paymentTermsDays, onDone }) {
  const [state, action, pending] = useRefreshingAction(invoice ? updateInvoice : createInvoice, onDone);
  const [rows, setRows] = useState(() =>
    invoice?.invoice_items?.length
      ? [...invoice.invoice_items]
          .sort((a, b) => a.position - b.position)
          .map((item) => ({
            description: item.description,
            quantity: String(Number(item.quantity)),
            unit_price: String(Number(item.unit_price)),
          }))
      : [{ ...BLANK_ITEM }],
  );

  function setRow(index, field, value) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)));
  }

  const total = invoiceTotal(
    rows.map((row) => ({ quantity: Number(row.quantity) || 0, unit_price: Number(row.unit_price) || 0 })),
  );

  return (
    <form action={action} className="drawer-form invoice-form">
      <input name="client_id" type="hidden" value={clientId} />
      {invoice ? <input name="invoice_id" type="hidden" value={invoice.id} /> : null}

      <div className="drawer-form-row">
        <label>Issue date
          <input defaultValue={invoice?.issue_date ?? todayIsoDate()} name="issue_date" required type="date" />
        </label>
        <label>Due date
          <input defaultValue={invoice?.due_date ?? defaultDueDate(paymentTermsDays)} name="due_date" required type="date" />
        </label>
      </div>

      <div className="invoice-items">
        <span className="section-label">LINE ITEMS</span>
        {rows.map((row, index) => (
          <div className="invoice-item-row" key={index}>
            <label>Description
              <input
                maxLength={200}
                name="item_description"
                onChange={(event) => setRow(index, "description", event.target.value)}
                placeholder="e.g. Social media retainer — November"
                value={row.description}
              />
            </label>
            <label>Qty
              <input
                inputMode="decimal"
                max={9999}
                min={0}
                name="item_quantity"
                onChange={(event) => setRow(index, "quantity", event.target.value)}
                step="0.5"
                type="number"
                value={row.quantity}
              />
            </label>
            <label>Unit price (₹)
              <input
                inputMode="decimal"
                min={0}
                name="item_unit_price"
                onChange={(event) => setRow(index, "unit_price", event.target.value)}
                step="1"
                type="number"
                value={row.unit_price}
              />
            </label>
            {rows.length > 1 ? (
              <button
                aria-label={`Remove line ${index + 1}`}
                className="icon-button invoice-item-remove"
                onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                type="button"
              >
                <Icon name="close" size={16} />
              </button>
            ) : null}
          </div>
        ))}
        {rows.length < MAX_INVOICE_ITEMS ? (
          <button
            className="button button-quiet"
            onClick={() => setRows((current) => [...current, { ...BLANK_ITEM }])}
            type="button"
          >
            <span>＋</span> Add line
          </button>
        ) : null}
        <p className="invoice-form-total">Total <strong className="mono">{formatCurrency(total)}</strong></p>
      </div>

      <label>Notes <span className="optional-label">OPTIONAL</span>
        <textarea defaultValue={invoice?.notes ?? ""} maxLength={2000} name="notes" placeholder="Payment instructions, scope notes..." rows={2} />
      </label>

      {state.error ? <p aria-live="polite" className="form-error">{state.error}</p> : null}
      <div className="drawer-form-actions">
        <button className="button button-quiet" onClick={onDone} type="button">Cancel</button>
        <button className="button button-primary" disabled={pending} type="submit">
          {pending ? "Saving..." : invoice ? "Save draft" : "Create draft"}
        </button>
      </div>
    </form>
  );
}

export default function InvoicesSection({ client, invoices, paymentTermsDays }) {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const today = todayIsoDate();
  const sorted = [...invoices].sort((a, b) => b.created_at.localeCompare(a.created_at));

  function onWorkflowMessage(saved) {
    setMessage(saved.message ?? saved.warning ?? "");
  }

  return (
    <>
      <h3 className="section-label">INVOICES <span>{sorted.length}</span></h3>
      {message ? <p aria-live="polite" className="invite-warning">{message}</p> : null}
      {sorted.length ? (
        <ul className="invoice-list">
          {sorted.map((invoice) => {
            const status = displayInvoiceStatus(invoice, today);
            if (editingId === invoice.id) {
              return (
                <li className="invoice-card invoice-card-editing" key={invoice.id}>
                  <InvoiceForm
                    clientId={client.id}
                    invoice={invoice}
                    onDone={() => setEditingId(null)}
                    paymentTermsDays={paymentTermsDays}
                  />
                </li>
              );
            }
            return (
              <li className="invoice-card" key={invoice.id}>
                <div className="invoice-card-head">
                  <div>
                    <strong className="mono">{invoice.invoice_number}</strong>
                    <span>
                      {formatCurrency(invoiceTotal(invoice.invoice_items))} ·{" "}
                      {invoice.status === "Paid" ? `Paid ${formatDate(invoice.paid_at?.slice(0, 10))}` : `Due ${formatDate(invoice.due_date)}`}
                    </span>
                  </div>
                  <Status>{status}</Status>
                </div>
                <div className="invoice-card-actions">
                  <a className="invoice-action" href={`/invoices/${invoice.id}`} rel="noreferrer" target="_blank">
                    View
                  </a>
                  {invoice.status === "Draft" ? (
                    <>
                      <button className="invoice-action" onClick={() => setEditingId(invoice.id)} type="button">Edit</button>
                      <WorkflowButton invoiceId={invoice.id} label="Send to client" onMessage={onWorkflowMessage} pendingLabel="Sending..." serverAction={sendInvoice} />
                    </>
                  ) : null}
                  {invoice.status === "Draft" || invoice.status === "Sent" ? (
                    <WorkflowButton invoiceId={invoice.id} label="Mark paid" onMessage={onWorkflowMessage} pendingLabel="Recording..." serverAction={markInvoicePaid} />
                  ) : null}
                  {invoice.status === "Sent" ? (
                    <WorkflowButton
                      confirm="Voiding keeps the number but cancels the invoice."
                      danger
                      invoiceId={invoice.id}
                      label="Void"
                      onMessage={onWorkflowMessage}
                      pendingLabel="Voiding..."
                      serverAction={voidInvoice}
                    />
                  ) : null}
                  {invoice.status === "Draft" ? <DeleteDraftButton invoiceId={invoice.id} /> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-note">No invoices yet. Create one to bill this client.</p>
      )}

      {creating ? (
        <InvoiceForm clientId={client.id} onDone={() => setCreating(false)} paymentTermsDays={paymentTermsDays} />
      ) : (
        <button className="button button-quiet drawer-add-button" onClick={() => setCreating(true)} type="button">
          <span>＋</span> New invoice
        </button>
      )}
    </>
  );
}
