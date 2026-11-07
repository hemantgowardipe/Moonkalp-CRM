"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { getClientInviteRedirectUrl } from "@/lib/clientInvite.mjs";
import { isUuid } from "@/lib/crmRecords.mjs";
import { describeAuthError, getPortalStatus } from "@/lib/portalAccess.mjs";
import { disablePortalLogin, enablePortalLogin, recordPortalEvent } from "@/lib/portalAccessServer";
import { createAdminClient, createEmailLinkClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function loadClientAccess(clientId) {
  const supabase = await createClient();
  const [{ data: client, error: clientError }, { data: accessRows, error: accessError }] = await Promise.all([
    supabase.from("clients").select("id, name, company_name, email").eq("id", clientId).maybeSingle(),
    supabase.rpc("client_portal_access", { p_client_id: clientId }),
  ]);

  if (clientError) return { error: `Could not load client record: ${clientError.message}` };
  if (accessError) return { error: `Could not load portal access: ${accessError.message}` };
  if (!client) return { error: "That client record could not be found." };

  const access = accessRows?.[0] ?? null;
  return { client, access, status: getPortalStatus(access) };
}

export async function resendPortalInvite(_previousState, formData) {
  const profile = await requireRole(["admin", "team_member"]);
  const clientId = String(formData.get("client_id") ?? "");
  if (!isUuid(clientId)) return { error: "Select a valid client record." };

  const { client, access, status, error } = await loadClientAccess(clientId);
  if (error) return { error };
  if (status === "not_invited") return { error: "This client has not been invited yet. Use Send invite instead." };
  if (status === "disabled") return { error: "Re-enable portal access before sending a new link." };
  if (status === "active") {
    return { error: "This client has already set a password. They can use “Forgot password?” on the sign-in page." };
  }

  const { redirectTo, error: redirectError } = getClientInviteRedirectUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (redirectError) return { error: redirectError };

  const admin = createAdminClient();
  const { data: authData, error: userError } = await admin.auth.admin.getUserById(access.auth_id);
  if (userError || !authData?.user) {
    return { error: `Could not load the client's login: ${userError?.message ?? "not found"}` };
  }

  const loginEmail = authData.user.email?.toLowerCase();
  if (loginEmail !== client.email.toLowerCase()) {
    return { error: "The client's email no longer matches their portal login. Contact an administrator." };
  }

  // Supabase only re-sends invitations to users who have not opened one yet.
  // Anyone who opened the link but never set a password gets a set-password
  // (recovery) link instead, which lands on the same password screen.
  const { error: sendError } = authData.user.email_confirmed_at
    ? await createEmailLinkClient().auth.resetPasswordForEmail(loginEmail, { redirectTo })
    : await admin.auth.admin.inviteUserByEmail(loginEmail, {
      data: { full_name: client.name, company_name: client.company_name },
      redirectTo,
    });

  if (sendError) {
    console.error(
      "[client-invite] Resend failed",
      JSON.stringify({ clientId, status: sendError.status ?? null, code: sendError.code ?? null, message: sendError.message }),
    );
    return { error: describeAuthError(sendError) ?? `Could not send the link: ${sendError.message}` };
  }

  await recordPortalEvent(admin, clientId, "invite_resent", profile.auth_id);
  revalidatePath("/admin/dashboard");
  return { success: true, message: `A new set-up link was sent to ${loginEmail}.` };
}

export async function disableClientPortalAccess(_previousState, formData) {
  const profile = await requireRole(["admin", "team_member"]);
  const clientId = String(formData.get("client_id") ?? "");
  if (!isUuid(clientId)) return { error: "Select a valid client record." };

  const result = await disablePortalLogin(clientId, profile.auth_id);
  if (result.error) return { error: result.error };

  revalidatePath("/admin/dashboard");
  return { success: true, warning: result.warning ?? "" };
}

export async function enableClientPortalAccess(_previousState, formData) {
  const profile = await requireRole(["admin", "team_member"]);
  const clientId = String(formData.get("client_id") ?? "");
  if (!isUuid(clientId)) return { error: "Select a valid client record." };

  const result = await enablePortalLogin(clientId, profile.auth_id);
  if (result.error) return { error: result.error };

  revalidatePath("/admin/dashboard");
  return { success: true };
}
