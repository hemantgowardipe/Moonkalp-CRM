"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { addDeliverableComment } from "@/app/deliverables/commentActions";
import { relativeTime } from "@/lib/notificationRules.mjs";

const initialState = { error: "", success: false };

/** A compact, collapsible discussion under one deliverable. */
export default function CommentThread({ deliverableId, comments, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const [state, action, pending] = useActionState(addDeliverableComment, initialState);
  const formRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state]);

  const sorted = [...(comments ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="comment-thread">
      <button
        aria-expanded={open}
        className="comment-toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Icon name="comment" size={16} />
        {sorted.length ? `Comments (${sorted.length})` : "Add a comment"}
      </button>

      {open ? (
        <div className="comment-body">
          {sorted.length ? (
            <ul className="comment-list">
              {sorted.map((comment) => (
                <li className={`comment comment-${comment.author_role}`} key={comment.id}>
                  <div className="comment-meta">
                    <strong>{comment.author_name}</strong>
                    <span className="comment-role">{comment.author_role === "staff" ? "Team" : "Client"}</span>
                    <time dateTime={comment.created_at}>{relativeTime(comment.created_at)}</time>
                  </div>
                  <p>{comment.body}</p>
                </li>
              ))}
            </ul>
          ) : null}
          <form action={action} className="comment-form" ref={formRef}>
            <input name="deliverable_id" type="hidden" value={deliverableId} />
            <textarea
              aria-label="Write a comment"
              maxLength={2000}
              name="body"
              placeholder="Write a comment..."
              required
              rows={2}
            />
            <button className="button button-secondary" disabled={pending} type="submit">
              {pending ? "Posting..." : "Post"}
            </button>
          </form>
          {state.error ? <p className="form-error" role="alert">{state.error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
