"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createClientService,
  createDeliverable,
  createPayment,
  deleteClientService,
  deleteDeliverable,
  deletePayment,
  updateClientRecord,
  updateClientService,
  updateDeliverable,
  updateDeliverableStatus,
  updatePayment,
  updatePaymentStatus,
} from "@/app/admin/dashboard/actions";
import {
  CLIENT_STATUSES,
  DELIVERABLE_CATEGORIES,
  PAYMENT_STATUSES,
  PIPELINE_STATUSES,
  SERVICE_STATUSES,
  SERVICE_TYPES,
  todayIsoDate,
} from "@/lib/crmRecords.mjs";
import { defaultDueDate } from "@/lib/settingsRules.mjs";

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
    onSavedRef.current?.(state);
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

// Shows a record's normal view until Edit is pressed, then its editor.
export function EditableRecord({ children, editor }) {
  const [editing, setEditing] = useState(false);

  return editing ? editor(() => setEditing(false)) : children(() => setEditing(true));
}

export function EditButton({ label, onClick }) {
  return (
    <button aria-label={label} className="edit-record-button" onClick={onClick} type="button">
      Edit
    </button>
  );
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

function DeleteControl({ serverAction, id, label, warning }) {
  const [state, action, pending] = useSavingAction(serverAction);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button className="delete-record-button" onClick={() => setConfirming(true)} type="button">
        Delete {label}
      </button>
    );
  }

  return (
    <form action={action} className="delete-confirm">
      <input name="id" type="hidden" value={id} />
      <p>{warning ?? `Delete this ${label} permanently?`} This cannot be undone.</p>
      {state.error ? <p aria-live="polite" className="form-error">{state.error}</p> : null}
      <div className="drawer-form-actions">
        <button className="button button-quiet" onClick={() => setConfirming(false)} type="button">Keep it</button>
        <button className="button button-danger" disabled={pending}>{pending ? "Deleting..." : "Confirm delete"}</button>
      </div>
    </form>
  );
}

export function ClientDetailsForm({ client, linked, onDone }) {
  // Keep the form open when the save carries a warning (e.g. churn disabled
  // portal access) so the message is seen; Cancel then closes it.
  const [state, action, pending] = useSavingAction(updateClientRecord, (saved) => {
    if (!saved.warning) onDone();
  });

  return (
    <form action={action} className="drawer-form">
      <input name="client_id" type="hidden" value={client.id} />
      <label>Company name
        <input autoComplete="organization" defaultValue={client.company_name} name="company_name" required />
      </label>
      <label>Contact name
        <input autoComplete="name" defaultValue={client.name} name="name" required />
      </label>
      <label>Email address
        <input autoComplete="email" defaultValue={client.email} name="email" readOnly={linked} required type="email" />
      </label>
      {linked ? <p className="field-hint">Email is locked because this client has a linked portal login.</p> : null}
      <div className="drawer-form-row">
        <label>Phone <span className="optional-label">OPTIONAL</span>
          <input autoComplete="tel" defaultValue={client.phone ?? ""} name="phone" type="tel" />
        </label>
        <label>Account status
          <select defaultValue={client.status} name="status">
            {CLIENT_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
        </label>
      </div>
      {state.success && state.warning ? <p aria-live="polite" className="invite-warning">{state.warning}</p> : null}
      <FormFooter onCancel={onDone} pending={pending} state={state} submitLabel="Save details" />
    </form>
  );
}

function ServiceForm({ clientId, service, onDone }) {
  const [state, action, pending] = useSavingAction(service ? updateClientService : createClientService, onDone);

  return (
    <div className="drawer-edit">
      <form action={action} className="drawer-form">
        <input name="client_id" type="hidden" value={clientId} />
        {service ? <input name="service_id" type="hidden" value={service.id} /> : null}
        <div className="drawer-form-row">
          <label>Service type
            <select defaultValue={service?.service_type ?? SERVICE_TYPES[0]} name="service_type" required>
              {SERVICE_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>Status
            <select defaultValue={service?.status ?? "Active"} name="status" required>
              {SERVICE_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>
        <label>Monthly retainer (₹)
          <input defaultValue={service ? Number(service.monthly_retainer) : ""} min="0" name="monthly_retainer" required step="1" type="number" />
        </label>
        <div className="drawer-form-row">
          <label>Start date
            <input defaultValue={service?.start_date ?? todayIsoDate()} name="start_date" required type="date" />
          </label>
          <label>Renewal date <span className="optional-label">OPTIONAL</span>
            <input defaultValue={service?.renewal_date ?? ""} name="renewal_date" type="date" />
          </label>
        </div>
        <FormFooter onCancel={onDone} pending={pending} state={state} submitLabel={service ? "Save service" : "Add service"} />
      </form>
      {service ? (
        <DeleteControl
          id={service.id}
          label="service"
          serverAction={deleteClientService}
          warning={`Delete this service and all ${service.deliverables?.length ?? 0} of its deliverables?`}
        />
      ) : null}
    </div>
  );
}

export function AddServiceForm({ clientId }) {
  return (
    <AddRecordPanel label="Add service">
      {(close) => <ServiceForm clientId={clientId} onDone={close} />}
    </AddRecordPanel>
  );
}

export function EditServiceForm({ clientId, service, onDone }) {
  return <ServiceForm clientId={clientId} onDone={onDone} service={service} />;
}

function DeliverableForm({ services, deliverable, onDone }) {
  const [state, action, pending] = useSavingAction(deliverable ? updateDeliverable : createDeliverable, onDone);

  return (
    <div className="drawer-edit">
      <form action={action} className="drawer-form">
        {deliverable ? <input name="deliverable_id" type="hidden" value={deliverable.id} /> : null}
        <label>Title
          <input defaultValue={deliverable?.title ?? ""} maxLength={200} name="title" placeholder="e.g. Diwali offer reel" required />
        </label>
        <label>Service
          <select defaultValue={deliverable?.serviceId ?? services[0].id} name="service_id" required>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.service_type}{service.status === "Active" ? "" : ` (${service.status})`}
              </option>
            ))}
          </select>
        </label>
        <div className="drawer-form-row">
          <label>Category
            <select defaultValue={deliverable?.category ?? DELIVERABLE_CATEGORIES[0]} name="category" required>
              {DELIVERABLE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label>Stage
            <select defaultValue={deliverable?.pipeline_status ?? "Drafting"} name="pipeline_status" required>
              {PIPELINE_STATUSES.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
        </div>
        <label>Due date <span className="optional-label">OPTIONAL</span>
          <input defaultValue={deliverable?.due_date ?? ""} name="due_date" type="date" />
        </label>
        <FormFooter onCancel={onDone} pending={pending} state={state} submitLabel={deliverable ? "Save deliverable" : "Add deliverable"} />
      </form>
      {deliverable ? (
        <DeleteControl
          id={deliverable.id}
          label="deliverable"
          serverAction={deleteDeliverable}
          warning="Delete this deliverable and its client review history?"
        />
      ) : null}
    </div>
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

export function EditDeliverableForm({ services, deliverable, onDone }) {
  return <DeliverableForm deliverable={deliverable} onDone={onDone} services={services} />;
}

function PaymentForm({ clientId, payment, onDone, paymentTermsDays = 15 }) {
  const [state, action, pending] = useSavingAction(payment ? updatePayment : createPayment, onDone);
  const [status, setStatus] = useState(payment?.payment_status ?? "Pending");

  return (
    <div className="drawer-edit">
      <form action={action} className="drawer-form">
        <input name="client_id" type="hidden" value={clientId} />
        {payment ? <input name="payment_id" type="hidden" value={payment.id} /> : null}
        <div className="drawer-form-row">
          <label>Amount (₹)
            <input defaultValue={payment ? Number(payment.amount) : ""} min="1" name="amount" required step="1" type="number" />
          </label>
          <label>Status
            <select name="payment_status" onChange={(event) => setStatus(event.target.value)} required value={status}>
              {PAYMENT_STATUSES.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <div className="drawer-form-row">
          <label>Due date
            <input defaultValue={payment?.due_date ?? defaultDueDate(paymentTermsDays)} name="due_date" required type="date" />
          </label>
          {status === "Paid" ? (
            <label>Paid date
              <input defaultValue={payment?.paid_date ?? todayIsoDate()} name="paid_date" required type="date" />
            </label>
          ) : null}
        </div>
        <label>Reference <span className="optional-label">OPTIONAL</span>
          <input defaultValue={payment?.transaction_ref ?? ""} maxLength={120} name="transaction_ref" placeholder="Invoice or transaction number" />
        </label>
        <FormFooter onCancel={onDone} pending={pending} state={state} submitLabel={payment ? "Save payment" : "Add payment"} />
      </form>
      {payment ? <DeleteControl id={payment.id} label="payment" serverAction={deletePayment} /> : null}
    </div>
  );
}

export function AddPaymentForm({ clientId, paymentTermsDays }) {
  return (
    <AddRecordPanel label="Add payment">
      {(close) => <PaymentForm clientId={clientId} onDone={close} paymentTermsDays={paymentTermsDays} />}
    </AddRecordPanel>
  );
}

export function EditPaymentForm({ clientId, payment, onDone }) {
  return <PaymentForm clientId={clientId} onDone={onDone} payment={payment} />;
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
