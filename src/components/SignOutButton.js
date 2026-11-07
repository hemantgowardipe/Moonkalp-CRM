"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { createClient } from "@/lib/supabase/browser";

export default function SignOutButton({ className = "nav-link" }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    setError("");
    setPending(true);
    // Only this device; Settings → Security signs out the others.
    const { error: signOutError } = await createClient().auth.signOut({ scope: "local" });
    if (signOutError) {
      setPending(false);
      setError("Sign out failed. Please try again.");
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="signout-wrap">
      <button className={className} disabled={pending} onClick={handleSignOut} type="button">
        <Icon name="logout" />
        <span>{pending ? "Signing out..." : "Sign out"}</span>
      </button>
      {error ? <span className="form-error" role="alert">{error}</span> : null}
    </div>
  );
}
