"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function SignOutButton() {
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSignOut() {
    setError("");
    const { error: signOutError } = await createClient().auth.signOut();
    if (signOutError) {
      setError("Sign out failed. Please try again.");
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="signout-wrap">
      <button className="nav-link signout-button" onClick={handleSignOut} type="button">
        <span className="nav-icon">↪</span>
        <span>Sign out</span>
      </button>
      {error ? <span className="signout-error">{error}</span> : null}
    </div>
  );
}
