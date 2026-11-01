"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { inviteClientToPortal } from "@/app/admin/dashboard/actions";

const initialState = { error: "", success: false, warning: "" };

export default function ClientPortalInvite({ clientId, email, linked }) {
  const [state, action, pending] = useActionState(inviteClientToPortal, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <div className="portal-invite-box">
      <div>
        <strong>{linked ? "Portal access linked" : "Client portal access"}</strong>
        <span>{linked ? email : `Invite ${email} to set up portal access.`}</span>
      </div>
      {linked ? <span className="status-pill status-active">Linked</span> : (
        <form action={action}>
          <input name="client_id" type="hidden" value={clientId} />
          <button className="button button-quiet" disabled={pending}>
            {pending ? "Sending..." : "Send invite"}
          </button>
        </form>
      )}
      {state.error ? <p aria-live="polite" className="form-error">{state.error}</p> : null}
      {state.warning ? <p aria-live="polite" className="invite-warning">{state.warning}</p> : null}
      {state.success && !state.warning ? (
        <p aria-live="polite" className="invite-success">Portal invitation sent to {email}.</p>
      ) : null}
    </div>
  );
}
