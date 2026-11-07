"use server";

import { getClientInviteRedirectUrl } from "@/lib/clientInvite.mjs";
import { describeAuthError } from "@/lib/portalAccess.mjs";
import { createEmailLinkClient } from "@/lib/supabase/admin";

export async function requestPasswordReset(_previousState, formData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const { redirectTo, error: redirectError } = getClientInviteRedirectUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (redirectError) {
    console.error("[password-reset] Site URL is misconfigured", redirectError);
    return { error: "Password reset is unavailable right now. Contact your agency admin." };
  }

  const { error } = await createEmailLinkClient().auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    const rateLimited = describeAuthError(error);
    if (rateLimited) return { error: rateLimited };

    // Logged for operators, but the visitor gets the same answer as success so
    // the form cannot be used to discover which emails have accounts.
    console.error(
      "[password-reset] Request failed",
      JSON.stringify({ status: error.status ?? null, code: error.code ?? null, message: error.message }),
    );
  }

  return { success: true, email };
}
