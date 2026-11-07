// Server-only helpers for client portal logins. These use the service-role
// client, so callers must authorise the acting staff member first.
import { createAdminClient } from "@/lib/supabase/admin";

// Long enough to be permanent; Supabase Auth has no "forever" ban value.
const BAN_DURATION = "876000h";

export async function recordPortalEvent(admin, clientId, event, actorAuthId) {
  const { error } = await admin.from("client_portal_events").insert({
    client_id: clientId,
    event,
    actor_auth_id: actorAuthId,
  });

  // The access change itself already happened; a missing audit row should be
  // visible in the logs but must not report the whole action as failed.
  if (error) {
    console.error("[portal-access] Could not record event", JSON.stringify({ clientId, event, message: error.message }));
  }
}

export async function getClientLogin(admin, clientId) {
  const { data, error } = await admin
    .from("users")
    .select("id, auth_id, email, access_disabled_at")
    .eq("client_id", clientId)
    .eq("role", "client")
    .maybeSingle();

  if (error) throw new Error(`Could not load the client's portal login: ${error.message}`);
  return data;
}

/**
 * Turns a client's portal login off. Order matters: the profile flag is set
 * first because RLS keys off it and cuts data access immediately; the Auth ban
 * then blocks new sign-ins, and session revocation ends existing ones.
 * Returns { error } or { warning } when only some layers could be applied.
 */
export async function disablePortalLogin(clientId, actorAuthId) {
  const admin = createAdminClient();
  const login = await getClientLogin(admin, clientId);
  if (!login) return { error: "This client does not have a portal login." };

  if (!login.access_disabled_at) {
    const { error } = await admin
      .from("users")
      .update({ access_disabled_at: new Date().toISOString(), access_disabled_by: actorAuthId })
      .eq("id", login.id);
    if (error) return { error: `Could not disable portal access: ${error.message}` };
  }

  const problems = [];
  const { error: banError } = await admin.auth.admin.updateUserById(login.auth_id, { ban_duration: BAN_DURATION });
  if (banError) problems.push(`sign-in block (${banError.message})`);

  const { error: revokeError } = await admin.rpc("revoke_user_sessions", { p_auth_id: login.auth_id });
  if (revokeError) problems.push(`session sign-out (${revokeError.message})`);

  if (!login.access_disabled_at) {
    await recordPortalEvent(admin, clientId, "access_disabled", actorAuthId);
  }

  if (problems.length) {
    console.error("[portal-access] Partial disable", JSON.stringify({ clientId, problems }));
    return {
      warning: `Access is disabled, but these steps failed and should be retried: ${problems.join(", ")}.`,
    };
  }
  return {};
}

/**
 * Turns a client's portal login back on. The Auth ban is lifted first; if the
 * profile update then fails, the RLS flag still blocks access, which is the
 * safe direction to fail in.
 */
export async function enablePortalLogin(clientId, actorAuthId) {
  const admin = createAdminClient();
  const login = await getClientLogin(admin, clientId);
  if (!login) return { error: "This client does not have a portal login." };

  const { error: unbanError } = await admin.auth.admin.updateUserById(login.auth_id, { ban_duration: "none" });
  if (unbanError) return { error: `Could not re-enable sign-in: ${unbanError.message}` };

  if (login.access_disabled_at) {
    const { error } = await admin
      .from("users")
      .update({ access_disabled_at: null, access_disabled_by: null })
      .eq("id", login.id);
    if (error) return { error: `Sign-in was unblocked, but access could not be restored: ${error.message}` };

    await recordPortalEvent(admin, clientId, "access_enabled", actorAuthId);
  }

  return {};
}
