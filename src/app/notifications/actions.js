"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function markAllNotificationsRead() {
  const profile = await requireRole(["admin", "team_member", "client"]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_auth_id", profile.auth_id)
    .is("read_at", null);

  if (error) return { error: `Could not update notifications: ${error.message}` };

  revalidatePath("/admin/dashboard");
  revalidatePath("/client/portal");
  return { success: true };
}
