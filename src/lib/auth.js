import { cache } from "react";
import { redirect } from "next/navigation";
import { isRecentEmailLinkSession } from "@/lib/portalAccess.mjs";
import { createClient } from "@/lib/supabase/server";

/**
 * The signed-in user, verified with the Supabase Auth server. React's cache()
 * shares one round trip across everything rendered for a single request
 * (requireRole, the workspace shell preload, the Security settings). It only
 * memoizes during a server render, so Server Actions and Route Handlers still
 * check the session on every call.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  return supabase.auth.getUser();
});

export const getCurrentProfile = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await getAuthUser();

  if (authError) {
    // A missing, expired, or revoked session (e.g. a stale refresh token cookie)
    // means the visitor is signed out; only unexpected failures should throw.
    if (authError.name === "AuthSessionMissingError") return null;
    if (authError.status >= 400 && authError.status < 500) return null;

    throw new Error(`Could not verify the current session: ${authError.message}`);
  }

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("users")
    .select("id, auth_id, email, full_name, role, client_id, access_disabled_at")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the current user profile: ${error.message}`);
  }

  return profile;
});

export async function hasRecentEmailLinkSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error) return false;
  return isRecentEmailLinkSession(data?.claims);
}

export async function requireRole(allowedRoles) {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");

  // RLS already hides all data from disabled profiles; this turns the
  // resulting empty pages into a clear message.
  if (profile.access_disabled_at) redirect("/login?access=disabled");

  if (!allowedRoles.includes(profile.role)) {
    redirect(profile.role === "client" ? "/client/portal" : "/admin/dashboard");
  }

  return profile;
}
