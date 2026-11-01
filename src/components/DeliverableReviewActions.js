"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { reviewDeliverable } from "@/app/client/portal/actions";

const initialState = { error: "", success: false };

export default function DeliverableReviewActions({ deliverableId }) {
  const [state, action, pending] = useActionState(reviewDeliverable, initialState);
  const formRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={action} className="review-actions" ref={formRef}>
      <input name="deliverable_id" type="hidden" value={deliverableId} />
      <input
        aria-label="Optional feedback"
        className="review-note-input"
        maxLength={2000}
        name="note"
        placeholder="Add feedback (optional)"
      />
      <button
        className="button button-review"
        disabled={pending}
        name="decision"
        type="submit"
        value="Revision Requested"
      >
        Request revision
      </button>
      <button
        className="button button-approve"
        disabled={pending}
        name="decision"
        type="submit"
        value="Approved"
      >
        Approve
      </button>
      {state.error ? <span aria-live="polite" className="form-error">{state.error}</span> : null}
      {state.success ? <span aria-live="polite" className="review-success">Review submitted.</span> : null}
    </form>
  );
}
