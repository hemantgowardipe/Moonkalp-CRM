"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

const initialState = { error: "" };

export default function LoginForm({ inviteStatus }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  const inviteMessage = inviteStatus === "expired"
    ? "This invitation link is invalid or has expired. Ask your agency contact to send a new one."
    : inviteStatus === "invalid"
      ? "This invitation link is incomplete. Ask your agency contact to send a new one."
      : "";

  return (
    <form action={action} className="login-form">
      {inviteMessage ? <p aria-live="polite" className="form-error">{inviteMessage}</p> : null}
      <label htmlFor="email">Email address</label>
      <input
        autoComplete="email"
        id="email"
        name="email"
        placeholder="you@company.com"
        required
        type="email"
      />
      <label htmlFor="password">Password</label>
      <input
        autoComplete="current-password"
        id="password"
        name="password"
        placeholder="Enter your password"
        required
        type="password"
      />
      {state.error ? (
        <p aria-live="polite" className="form-error">
          {state.error}
        </p>
      ) : null}
      <button className="button button-primary login-submit" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
        <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
