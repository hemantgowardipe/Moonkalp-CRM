import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_ORGANIZATION,
  DENSITY_COOKIE,
  PREFERENCE_COOKIE_MAX_AGE,
  THEME_COOKIE,
  normalizeDensity,
  normalizeTheme,
} from "@/lib/settingsRules.mjs";

const ORGANIZATION_COLUMNS =
  "agency_name, support_email, support_phone, website_url, payment_terms_days, revision_turnaround_days, updated_at, updated_by";

/**
 * Agency configuration for display. Falls back to defaults (and logs) when the
 * row cannot be read, so a settings outage never takes down the workspace.
 */
export async function getOrganizationSettings(supabase) {
  const { data, error } = await supabase.from("organization_settings").select(ORGANIZATION_COLUMNS).maybeSingle();

  if (error) {
    console.error("[settings] Could not load organization settings", error.message);
    return { ...DEFAULT_ORGANIZATION, loadError: error.message };
  }
  return { ...DEFAULT_ORGANIZATION, ...data };
}

// One read per request, shared by the shell and the page that renders in it.
export const getCurrentOrganizationSettings = cache(async () => getOrganizationSettings(await createClient()));

export async function getUserPreferences(supabase, authId) {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("theme, density")
    .eq("auth_id", authId)
    .maybeSingle();

  if (error) {
    console.error("[settings] Could not load user preferences", error.message);
  }
  return { theme: normalizeTheme(data?.theme), density: normalizeDensity(data?.density) };
}

export async function readAppearanceCookies() {
  const store = await cookies();
  return {
    theme: normalizeTheme(store.get(THEME_COOKIE)?.value),
    density: normalizeDensity(store.get(DENSITY_COOKIE)?.value),
  };
}

// Only callable from Server Functions and Route Handlers (cookies().set).
export async function writeAppearanceCookies({ theme, density }) {
  const store = await cookies();
  const options = {
    httpOnly: true,
    maxAge: PREFERENCE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };
  store.set(THEME_COOKIE, normalizeTheme(theme), options);
  store.set(DENSITY_COOKIE, normalizeDensity(density), options);
}
