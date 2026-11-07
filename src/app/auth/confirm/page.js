"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";

export default function ConfirmInvitePage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (params.get("error") || !accessToken || !refreshToken) {
      router.replace(`/login?invite=${params.get("error") ? "expired" : "invalid"}`);
      return;
    }

    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        router.replace(error ? "/login?invite=expired" : "/client/setup-password");
      });
  }, [router]);

  return (
    <main className="setup-screen">
      <section className="setup-card">
        <div className="password-setup-copy">
          <span className="eyebrow">CLIENT PORTAL / INVITATION</span>
          <h1>Confirming your invitation...</h1>
        </div>
      </section>
    </main>
  );
}
