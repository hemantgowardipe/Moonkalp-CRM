"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { validateNewPassword } from "@/lib/passwordPolicy.mjs";
import { writeAppearanceCookies } from "@/lib/settings";
import { parseAppearanceForm, parseOrganizationForm, parseProfileForm } from "@/lib/settingsRules.mjs";
import { createEmailLinkClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ALL_ROLES = ["admin", "team_member", "client"];

function logFailure(label, error) {
  console.error(`[settings] ${label}`, JSON.stringify({ code: error.code ?? null, message: error.message }));
}

export async function updateProfile(_previousState, formData) {
  await requireRole(ALL_ROLES);
  const { values, error } = parseProfileForm(formData);
  if (error) return { error };

  const supabase = await createClient();
  const { error: saveError } = await supabase.rpc("update_my_profile", { p_full_name: values.full_name });
  if (saveError) {
    logFailure("Profile update failed", saveError);
    return { error: "Could not save your name. Try again." };
  }

  revalidatePath("/", "layout");
  return { success: true, message: "Profile saved." };
}

export async function updateAppearance(_previousState, formData) {
  const profile = await requireRole(ALL_ROLES);
  const { values, error } = parseAppearanceForm(formData);
  if (error) return { error };

  const supabase = await createClient();
  const { error: saveError } = await supabase
    .from("user_preferences")
    .upsert({ auth_id: profile.auth_id, ...values }, { onConflict: "auth_id" });
  if (saveError) {
    logFailure("Appearance update failed", saveError);
    return { error: "Could not save your appearance settings. Try again." };
  }

  await writeAppearanceCookies(values);
  revalidatePath("/", "layout");
  return { success: true, message: "Appearance saved." };
}

export async function changePassword(_previousState, formData) {
  const profile = await requireRole(ALL_ROLES);
  const currentPassword = String(formData.get("current_password") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!currentPassword) return { error: "Enter your current password." };
  const validationError = validateNewPassword(password, String(formData.get("confirm_password") ?? ""));
  if (validationError) return { error: validationError };
  if (password === currentPassword) return { error: "Choose a password different from your current one." };

  // Confirm the current password on a throwaway client so the browser's own
  // session is untouched, then end that verification session again.
  const verifier = createEmailLinkClient();
  const { error: verifyError } = await verifier.auth.signInWithPassword({ email: profile.email, password: currentPassword });
  if (verifyError) {
    if (verifyError.status === 429) return { error: "Too many attempts. Wait a few minutes and try again." };
    return { error: "Your current password is incorrect." };
  }
  await verifier.auth.signOut({ scope: "local" });

  const supabase = await createClient();
  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    logFailure("Password change failed", updateError);
    return { error: `Could not change your password: ${updateError.message}` };
  }

  const { error: signOutError } = await supabase.auth.signOut({ scope: "others" });
  if (signOutError) logFailure("Could not sign out other sessions after password change", signOutError);

  return { success: true, message: "Password changed. Other devices have been signed out." };
}

export async function signOutOtherSessions() {
  await requireRole(ALL_ROLES);
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  if (error) {
    logFailure("Sign out of other sessions failed", error);
    return { error: "Could not sign out other devices. Try again." };
  }
  return { success: true, message: "All other devices have been signed out." };
}

export async function updateOrganization(_previousState, formData) {
  const profile = await requireRole(["admin"]);
  const { values, error } = parseOrganizationForm(formData);
  if (error) return { error };

  const supabase = await createClient();
  const { data, error: saveError } = await supabase
    .from("organization_settings")
    .update({ ...values, updated_by: profile.auth_id })
    .eq("id", true)
    .select("agency_name");

  if (saveError) {
    logFailure("Organization update failed", saveError);
    return { error: `Could not save organization settings: ${saveError.message}` };
  }
  if (!data?.length) return { error: "Organization settings are missing. Run the settings migration." };

  revalidatePath("/", "layout");
  return { success: true, message: "Organization settings saved." };
}
