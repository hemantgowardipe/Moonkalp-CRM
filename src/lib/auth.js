import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    if (authError.name === "AuthSessionMissingError") return null;

    throw new Error(`Could not verify the current session: ${authError.message}`);
  }

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("users")
    .select("id, auth_id, email, full_name, role, client_id")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load the current user profile: ${error.message}`);
  }

  return profile;
}

export async function requireRole(allowedRoles) {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");

  if (!allowedRoles.includes(profile.role)) {
    redirect(profile.role === "client" ? "/client/portal" : "/admin/dashboard");
  }

  return profile;
}
