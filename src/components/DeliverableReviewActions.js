"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { reviewDeliverable } from "@/app/client/portal/actions";

const initialState = { error: "", success: false };

export default function DeliverableReviewActions({ deliverableId }) {
  const [state, action, pending] = useActionState(reviewDeliverable, initialState);
  const formRef = useRef(null);
  const noteId = useId();
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={action} className="review-form" ref={formRef}>
      <input name="deliverable_id" type="hidden" value={deliverableId} />
      <label className="visually-hidden" htmlFor={noteId}>Feedback (optional)</label>
      <textarea
        className="review-note-input"
        id={noteId}
        maxLength={2000}
        name="note"
        placeholder="Add feedback for the team (optional)"
        rows={2}
      />
      <div className="review-buttons">
        <button className="button button-secondary" disabled={pending} name="decision" type="submit" value="Revision Requested">
          Request changes
        </button>
        <button className="button button-primary" disabled={pending} name="decision" type="submit" value="Approved">
          <Icon name="check" size={18} />
          Approve
        </button>
      </div>
      {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
      {state.success ? <p aria-live="polite" className="form-success">Thanks — your review was sent.</p> : null}
    </form>
  );
}
