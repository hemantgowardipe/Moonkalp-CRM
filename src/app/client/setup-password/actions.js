"use server";

import { redirect } from "next/navigation";
import { hasRecentEmailLinkSession, requireRole } from "@/lib/auth";
import { validateNewPassword } from "@/lib/passwordPolicy.mjs";
import { createClient } from "@/lib/supabase/server";

export async function setClientPassword(_previousState, formData) {
  await requireRole(["client"]);
  if (!(await hasRecentEmailLinkSession())) {
    return { error: "This invitation link has expired. Ask your agency contact to resend it." };
  }

  const password = String(formData.get("password") ?? "");
  const validationError = validateNewPassword(password, String(formData.get("confirm_password") ?? ""));
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: `Could not set your password: ${error.message}` };
  }

  redirect("/client/portal");
}
