"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "./actions";

const initialState = { error: "" };

function getStatusMessage({ accessStatus, inviteStatus }) {
  if (accessStatus === "disabled") {
    return { kind: "error", text: "Your portal access has been disabled. Contact your agency if you think this is a mistake." };
  }
  if (inviteStatus === "expired") {
    return { kind: "error", text: "This link is invalid or has expired. Request a new one, or ask your agency contact to resend your invitation." };
  }
  if (inviteStatus === "invalid") {
    return { kind: "error", text: "This link is incomplete. Request a new one, or ask your agency contact to resend your invitation." };
  }
  return null;
}

export default function LoginForm({ accessStatus, inviteStatus }) {
  const [state, action, pending] = useActionState(signIn, initialState);
  const status = getStatusMessage({ accessStatus, inviteStatus });

  return (
    <form action={action} className="login-form">
      {status ? <p aria-live="polite" className="form-error">{status.text}</p> : null}
      <label htmlFor="email">Email address</label>
      <input
        autoComplete="email"
        id="email"
        name="email"
        placeholder="you@company.com"
        required
        type="email"
      />
      <div className="label-row">
        <label htmlFor="password">Password</label>
        <Link className="forgot-link" href="/forgot-password">Forgot password?</Link>
      </div>
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
