"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClientRecord } from "@/app/admin/dashboard/actions";
import Icon from "@/components/Icon";

const initialState = { error: "", success: false };

function ClientForm({ dialog, onCreated }) {
  const [state, action, pending] = useActionState(createClientRecord, initialState);

  useEffect(() => {
    if (state.success) onCreated();
  }, [onCreated, state.success]);

  return (
    <>
      <form action={action} className="modal-form">
        <div className="drawer-topline">
          <span className="eyebrow">CLIENT RECORD / NEW</span>
          <button aria-label="Close dialog" className="icon-button" formNoValidate onClick={() => dialog.current?.close()} type="button"><Icon name="close" /></button>
        </div>
        <h2>Add a client</h2>
        <p className="login-subtitle">Start with their contact details. You can add services and billing next.</p>
        <label htmlFor="client-company">Company name</label>
        <input autoComplete="organization" id="client-company" name="company_name" required />
        <label htmlFor="client-contact">Contact name</label>
        <input autoComplete="name" id="client-contact" name="name" required />
        <label htmlFor="client-email">Email address</label>
        <input autoComplete="email" id="client-email" name="email" required type="email" />
        <label htmlFor="client-phone">Phone <span className="optional-label">OPTIONAL</span></label>
        <input autoComplete="tel" id="client-phone" name="phone" type="tel" />
        {state.error ? <p aria-live="polite" className="form-error">{state.error}</p> : null}
        <div className="modal-actions">
          <button className="button button-quiet" onClick={() => dialog.current?.close()} type="button">Cancel</button>
          <button className="button button-primary" disabled={pending}>{pending ? "Creating..." : "Create client"}</button>
        </div>
      </form>
    </>
  );
}

export default function NewClientForm() {
  const [formKey, setFormKey] = useState(0);
  const dialog = useRef(null);
  const router = useRouter();
  const onCreated = useCallback(() => {
    dialog.current?.close();
    router.refresh();
  }, [router]);

  return (
    <>
      <button className="button button-primary" onClick={() => dialog.current?.showModal()} type="button">
        <Icon name="plus" size={18} /> New client
      </button>
      <dialog className="client-modal" onClose={() => setFormKey((key) => key + 1)} ref={dialog}>
        <ClientForm dialog={dialog} key={formKey} onCreated={onCreated} />
      </dialog>
    </>
  );
}
