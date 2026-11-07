"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile, hasRecentEmailLinkSession } from "@/lib/auth";
import { validateNewPassword } from "@/lib/passwordPolicy.mjs";
import { createClient } from "@/lib/supabase/server";

export async function resetPassword(_previousState, formData) {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Your reset link has expired. Request a new one from the sign-in page." };
  if (profile.access_disabled_at) redirect("/login?access=disabled");
  if (!(await hasRecentEmailLinkSession())) {
    return { error: "This reset link has expired. Request a new one from the sign-in page." };
  }

  const password = String(formData.get("password") ?? "");
  const validationError = validateNewPassword(password, String(formData.get("confirm_password") ?? ""));
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: `Could not update your password: ${error.message}` };
  }

  // Anyone else holding an old session (e.g. whoever learned the old
  // password) is signed out; this browser stays signed in.
  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) {
    console.error("[password-reset] Could not sign out other sessions", signOutError.message);
  }

  redirect(profile.role === "client" ? "/client/portal" : "/admin/dashboard");
}
