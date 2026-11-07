"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createClientService,
  createDeliverable,
  createPayment,
  updateDeliverableStatus,
  updatePaymentStatus,
} from "@/app/admin/dashboard/actions";
import {
  DELIVERABLE_CATEGORIES,
  PAYMENT_STATUSES,
  PIPELINE_STATUSES,
  SERVICE_TYPES,
  todayIsoDate,
} from "@/lib/crmRecords.mjs";

const initialState = { error: "", success: false };

// Runs a server action, then refreshes the dashboard data after each successful save.
function useSavingAction(serverAction, onSaved) {
  const [state, action, pending] = useActionState(serverAction, initialState);
  const router = useRouter();
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    onSavedRef.current = onSaved;
  });

  useEffect(() => {
    if (!state.success) return;
    onSavedRef.current?.();
    router.refresh();
  }, [router, state]);

  return [state, action, pending];
}

function AddRecordPanel({ label, children }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="button button-quiet drawer-add-button" onClick={() => setOpen(true)} type="button">
        <span>＋</span> {label}
      </button>
    );
  }

  return children(() => setOpen(false));
}

function FormFooter({ state, pending, onCancel, submitLabel }) {
  return (
    <>
      {state.error ? <p aria-live="polite" className="form-error">{state.error}</p> : null}
      <div className="drawer-form-actions">
        <button className="button button-quiet" onClick={onCancel} type="button">Cancel</button>
        <button className="button button-primary" disabled={pending}>{pending ? "Saving..." : submitLabel}</button>
      </div>
    </>
  );
}

function ServiceForm({ clientId, onDone }) {
  const [state, action, pending] = useSavingAction(createClientService, onDone);

  return (
    <form action={action} className="drawer-form">
      <input name="client_id" type="hidden" value={clientId} />
      <label>Service type
        <select defaultValue={SERVICE_TYPES[0]} name="service_type" required>
          {SERVICE_TYPES.map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>
      <label>Monthly retainer (₹)
        <input min="0" name="monthly_retainer" required step="1" type="number" />
      </label>
      <div className="drawer-form-row">
        <label>Start date
          <input defaultValue={todayIsoDate()} name="start_date" required type="date" />
        </label>
        <label>Renewal date <span className="optional-label">OPTIONAL</span>
          <input name="renewal_date" type="date" />
        </label>
      </div>
      <FormFooter onCancel={onDone} pending={pending} state={state} submitLabel="Add service" />
    </form>
  );
}

export function AddServiceForm({ clientId }) {
  return (
    <AddRecordPanel label="Add service">
      {(close) => <ServiceForm clientId={clientId} onDone={close} />}
    </AddRecordPanel>
  );
}

function DeliverableForm({ services, onDone }) {
  const [state, action, pending] = useSavingAction(createDeliverable, onDone);

  return (
    <form action={action} className="drawer-form">
      <label>Title
        <input maxLength={200} name="title" placeholder="e.g. Diwali offer reel" required />
      </label>
      <label>Service
        <select defaultValue={services[0].id} name="service_id" required>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.service_type}{service.status === "Active" ? "" : ` (${service.status})`}
            </option>
          ))}
        </select>
      </label>
      <div className="drawer-form-row">
        <label>Category
          <select defaultValue={DELIVERABLE_CATEGORIES[0]} name="category" required>
            {DELIVERABLE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label>Stage
          <select defaultValue="Drafting" name="pipeline_status" required>
            {PIPELINE_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
      </div>
      <label>Due date <span className="optional-label">OPTIONAL</span>
        <input name="due_date" type="date" />
      </label>
      <FormFooter onCancel={onDone} pending={pending} state={state} submitLabel="Add deliverable" />
    </form>
  );
}

export function AddDeliverableForm({ services }) {
  if (!services.length) {
    return <p className="empty-note">Add a service on the Overview tab before adding deliverables.</p>;
  }

  return (
    <AddRecordPanel label="Add deliverable">
      {(close) => <DeliverableForm onDone={close} services={services} />}
    </AddRecordPanel>
  );
}

function PaymentForm({ clientId, onDone }) {
  const [state, action, pending] = useSavingAction(createPayment, onDone);
  const [status, setStatus] = useState("Pending");

  return (
    <form action={action} className="drawer-form">
      <input name="client_id" type="hidden" value={clientId} />
      <div className="drawer-form-row">
        <label>Amount (₹)
          <input min="1" name="amount" required step="1" type="number" />
        </label>
        <label>Status
          <select name="payment_status" onChange={(event) => setStatus(event.target.value)} required value={status}>
            {PAYMENT_STATUSES.map((option) => <option key={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <div className="drawer-form-row">
        <label>Due date
          <input name="due_date" required type="date" />
        </label>
        {status === "Paid" ? (
          <label>Paid date
            <input defaultValue={todayIsoDate()} name="paid_date" required type="date" />
          </label>
        ) : null}
      </div>
      <label>Reference <span className="optional-label">OPTIONAL</span>
        <input maxLength={120} name="transaction_ref" placeholder="Invoice or transaction number" />
      </label>
      <FormFooter onCancel={onDone} pending={pending} state={state} submitLabel="Add payment" />
    </form>
  );
}

export function AddPaymentForm({ clientId }) {
  return (
    <AddRecordPanel label="Add payment">
      {(close) => <PaymentForm clientId={clientId} onDone={close} />}
    </AddRecordPanel>
  );
}

function StatusSelect({ serverAction, idName, id, statusName, value, options, label }) {
  const [state, action, pending] = useSavingAction(serverAction);
  const formRef = useRef(null);

  return (
    <form action={action} className="status-select-form" ref={formRef}>
      <input name={idName} type="hidden" value={id} />
      <select
        aria-label={label}
        className="status-select"
        defaultValue={value}
        disabled={pending}
        key={value}
        name={statusName}
        onChange={() => formRef.current?.requestSubmit()}
      >
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      {state.error ? <span aria-live="polite" className="form-error">{state.error}</span> : null}
    </form>
  );
}

export function DeliverableStatusSelect({ deliverable }) {
  return (
    <StatusSelect
      id={deliverable.id}
      idName="deliverable_id"
      label={`Pipeline stage for ${deliverable.title}`}
      options={PIPELINE_STATUSES}
      serverAction={updateDeliverableStatus}
      statusName="pipeline_status"
      value={deliverable.pipeline_status}
    />
  );
}

export function PaymentStatusSelect({ payment }) {
  return (
    <StatusSelect
      id={payment.id}
      idName="payment_id"
      label="Payment status"
      options={PAYMENT_STATUSES}
      serverAction={updatePaymentStatus}
      statusName="payment_status"
      value={payment.payment_status}
    />
  );
}
