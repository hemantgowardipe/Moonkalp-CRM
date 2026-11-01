"use client";

import { useActionState } from "react";
import { setClientPassword } from "./actions";

const initialState = { error: "" };

export default function PasswordForm() {
  const [state, action, pending] = useActionState(setClientPassword, initialState);

  return (
    <form action={action} className="login-form">
      <label htmlFor="new-password">New password</label>
      <input
        autoComplete="new-password"
        id="new-password"
        minLength={8}
        name="password"
        placeholder="At least 8 characters"
        required
        type="password"
      />
      <label htmlFor="confirm-new-password">Confirm password</label>
      <input
        autoComplete="new-password"
        id="confirm-new-password"
        minLength={8}
        name="confirm_password"
        placeholder="Enter your password again"
        required
        type="password"
      />
      {state.error ? <p aria-live="polite" className="form-error">{state.error}</p> : null}
      <button className="button button-primary login-submit" disabled={pending}>
        {pending ? "Saving..." : "Set password"}
        <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
