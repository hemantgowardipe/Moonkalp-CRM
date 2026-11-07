"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "./actions";

const initialState = { error: "", success: false };

export default function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  if (state.success) {
    return (
      <div className="reset-sent" aria-live="polite">
        <p>
          If an account exists for <strong>{state.email}</strong>, we&apos;ve emailed a link to choose a new
          password. It can be used once and expires soon, so open it from the newest email.
        </p>
        <p>Nothing arrived after a few minutes? Check your spam folder, or contact your agency admin.</p>
        <Link className="button button-quiet" href="/login">Back to sign in</Link>
      </div>
    );
  }

  return (
    <form action={action} className="login-form">
      <label htmlFor="reset-email">Email address</label>
      <input autoComplete="email" id="reset-email" name="email" placeholder="you@company.com" required type="email" />
      {state.error ? <p aria-live="polite" className="form-error">{state.error}</p> : null}
      <button className="button button-primary login-submit" disabled={pending}>
        {pending ? "Sending..." : "Email me a reset link"}
        <span aria-hidden="true">↗</span>
      </button>
      <Link className="back-link" href="/login">← Back to sign in</Link>
    </form>
  );
}
