"use client";

import { useActionState } from "react";
import { PASSWORD_MIN_LENGTH } from "@/lib/passwordPolicy.mjs";

const initialState = { error: "" };

export default function PasswordForm({ formAction, submitLabel = "Set password" }) {
  const [state, action, pending] = useActionState(formAction, initialState);

  return (
    <form action={action} className="login-form">
      <label htmlFor="new-password">New password</label>
      <input
        autoComplete="new-password"
        id="new-password"
        minLength={PASSWORD_MIN_LENGTH}
        name="password"
        placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
        required
        type="password"
      />
      <label htmlFor="confirm-new-password">Confirm password</label>
      <input
        autoComplete="new-password"
        id="confirm-new-password"
        minLength={PASSWORD_MIN_LENGTH}
        name="confirm_password"
        placeholder="Enter your password again"
        required
        type="password"
      />
      {state.error ? <p aria-live="polite" className="form-error">{state.error}</p> : null}
      <button className="button button-primary login-submit" disabled={pending}>
        {pending ? "Saving..." : submitLabel}
        <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
