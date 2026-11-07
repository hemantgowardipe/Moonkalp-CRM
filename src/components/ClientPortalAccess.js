"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { inviteClientToPortal } from "@/app/admin/dashboard/actions";
import {
  disableClientPortalAccess,
  enableClientPortalAccess,
  resendPortalInvite,
} from "@/app/admin/dashboard/portalActions";
import { PORTAL_EVENT_LABELS, getPortalStatus } from "@/lib/portalAccess.mjs";

const initialState = { error: "", success: false, warning: "", message: "" };

function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
}

const STATUS_COPY = {
  not_invited: { pill: "Not invited", pillClass: "status-not-invited", title: "No portal access yet" },
  invited: { pill: "Invited", pillClass: "status-pending", title: "Waiting for the client to set a password" },
  active: { pill: "Active", pillClass: "status-active", title: "Portal access active" },
  disabled: { pill: "Disabled", pillClass: "status-overdue", title: "Portal access disabled" },
};

function PortalAction({ serverAction, clientId, label, pendingLabel, quiet = true, confirm }) {
  const [state, action, pending] = useActionState(serverAction, initialState);
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  // A successful action changes the portal status, which swaps this control
  // for the next one, so there is no local state to reset here.
  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state]);

  const feedback = (
    <>
      {state.error ? <p aria-live="polite" className="form-error">{state.error}</p> : null}
      {state.success && state.warning ? <p aria-live="polite" className="invite-warning">{state.warning}</p> : null}
      {state.success && state.message ? <p aria-live="polite" className="invite-success">{state.message}</p> : null}
    </>
  );

  if (confirm && !confirming) {
    return (
      <div className="portal-action">
        <button className={`button ${quiet ? "button-quiet" : "button-primary"}`} onClick={() => setConfirming(true)} type="button">
          {label}
        </button>
        {feedback}
      </div>
    );
  }

  return (
    <form action={action} className={confirm ? "portal-action delete-confirm" : "portal-action"}>
      <input name="client_id" type="hidden" value={clientId} />
      {confirm ? <p>{confirm}</p> : null}
      <div className="drawer-form-actions">
        {confirm ? <button className="button button-quiet" onClick={() => setConfirming(false)} type="button">Cancel</button> : null}
        <button className={`button ${confirm ? "button-danger" : quiet ? "button-quiet" : "button-primary"}`} disabled={pending}>
          {pending ? pendingLabel : confirm ? `Yes, ${label.toLowerCase()}` : label}
        </button>
      </div>
      {feedback}
    </form>
  );
}

export default function ClientPortalAccess({ client }) {
  const access = client.portalAccess;
  const status = getPortalStatus(access);
  const copy = STATUS_COPY[status];
  const events = client.client_portal_events ?? [];

  let detail;
  if (status === "not_invited") detail = `Invite ${client.email} to set up a portal login.`;
  if (status === "invited") detail = `Last invited ${formatDateTime(access.invited_at) || "—"}. Links expire, so resend if the client can't find theirs.`;
  if (status === "active") {
    detail = access.last_sign_in_at ? `Last signed in ${formatDateTime(access.last_sign_in_at)}.` : "Password set; not signed in yet.";
  }
  if (status === "disabled") detail = `Disabled ${formatDateTime(access.disabled_at)}. The client cannot sign in or see any data.`;

  return (
    <div className="portal-access-box">
      <div className="portal-access-head">
        <div>
          <strong>{copy.title}</strong>
          <span>{detail}</span>
        </div>
        <span className={`status-pill ${copy.pillClass}`}>{copy.pill}</span>
      </div>

      <div className="portal-actions">
        {status === "not_invited" ? (
          <PortalAction clientId={client.id} label="Send invite" pendingLabel="Sending..." quiet={false} serverAction={inviteClientToPortal} />
        ) : null}
        {status === "invited" ? (
          <PortalAction clientId={client.id} label="Resend invite" pendingLabel="Sending..." serverAction={resendPortalInvite} />
        ) : null}
        {status === "invited" || status === "active" ? (
          <PortalAction
            clientId={client.id}
            confirm={`Disable portal access for ${client.email}? They are signed out everywhere and cannot sign in until access is re-enabled. Their data is kept.`}
            label="Disable access"
            pendingLabel="Disabling..."
            serverAction={disableClientPortalAccess}
          />
        ) : null}
        {status === "disabled" ? (
          <PortalAction clientId={client.id} label="Re-enable access" pendingLabel="Enabling..." serverAction={enableClientPortalAccess} />
        ) : null}
      </div>

      {events.length ? (
        <ul className="portal-events" aria-label="Recent portal activity">
          {events.map((event) => (
            <li key={event.id}>
              <span>{PORTAL_EVENT_LABELS[event.event] ?? event.event}</span>
              <time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
