"use server";

import { redirect } from "next/navigation";
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
    return { error: "Email or password is incorrect." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("role")
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

  redirect(profile.role === "client" ? "/client/portal" : "/admin/dashboard");
}
