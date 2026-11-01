"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

let supabase;

export function createClient() {
  if (!supabase) {
    const { url, key } = getSupabaseConfig();
    supabase = createBrowserClient(url, key);
  }

  return supabase;
}
