"use server";

import { redirect } from "next/navigation";
import { getUserPreferences, writeAppearanceCookies } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export async function signIn(_previousState, formData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    if (error.code === "user_banned") {
      return { error: "Your portal access has been disabled. Contact your agency if you think this is a mistake." };
    }
    if (error.status === 429) {
      return { error: "Too many sign-in attempts. Wait a few minutes and try again." };
    }
    return { error: "Email or password is incorrect." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role, access_disabled_at")
    .eq("auth_id", data.user.id)
    .maybeSingle();

  if (profileError) {
    await supabase.auth.signOut();
    return { error: "We could not load your CRM profile. Contact your agency admin." };
  }

  if (!profile) {
    await supabase.auth.signOut();
    return { error: "Your login is not linked to a CRM profile. Contact your agency admin." };
  }

  if (profile.access_disabled_at) {
    await supabase.auth.signOut();
    return { error: "Your portal access has been disabled. Contact your agency if you think this is a mistake." };
  }

  // Bring the user's saved appearance to this device.
  await writeAppearanceCookies(await getUserPreferences(supabase, data.user.id));

  redirect(profile.role === "client" ? "/client/portal" : "/admin/dashboard");
}
