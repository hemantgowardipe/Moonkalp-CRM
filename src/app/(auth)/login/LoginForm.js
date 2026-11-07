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
    // Supabase reports used and expired links the same way, and every emailed
    // link works only once, so cover both cases.
    return {
      kind: "error",
      text: "This link has already been used or has expired. Each emailed link works only once. If you've already set your password, sign in below (or use “Forgot password?”). If you never finished setting up, ask your agency contact to resend your invitation.",
    };
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
