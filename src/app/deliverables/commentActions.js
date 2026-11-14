"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/crmRecords.mjs";
import { parseCommentForm } from "@/lib/deliverableFiles.mjs";
import { buildNotification } from "@/lib/notificationRules.mjs";
import { notifyClientUsers, notifyStaff } from "@/lib/notificationsServer";
import { createClient } from "@/lib/supabase/server";

export async function addDeliverableComment(_previousState, formData) {
  const profile = await requireRole(["admin", "team_member", "client"]);
  const isClient = profile.role === "client";

  const deliverableId = String(formData.get("deliverable_id") ?? "");
  if (!isUuid(deliverableId)) return { error: "That deliverable could not be found." };

  const { values, error: validationError } = parseCommentForm(formData);
  if (validationError) return { error: validationError };

  // RLS scopes this read: a client can only load their own deliverables.
  const supabase = await createClient();
  const { data: deliverable, error: loadError } = await supabase
    .from("deliverables")
    .select("id, title, client_services!inner(client_id)")
    .eq("id", deliverableId)
    .maybeSingle();

  if (loadError) return { error: `Could not load the deliverable: ${loadError.message}` };
  if (!deliverable) return { error: "That deliverable is not available." };

  const { error } = await supabase.from("deliverable_comments").insert({
    deliverable_id: deliverableId,
    author_auth_id: profile.auth_id,
    author_name: profile.full_name,
    author_role: isClient ? "client" : "staff",
    body: values.body,
  });

  if (error) return { error: `Could not post your comment: ${error.message}` };

  const notification = buildNotification("comment_added", {
    deliverableTitle: deliverable.title,
    authorName: profile.full_name,
    comment: values.body,
    forStaff: isClient,
  });
  if (isClient) await notifyStaff(notification);
  else await notifyClientUsers(deliverable.client_services.client_id, notification);

  revalidatePath("/admin/dashboard");
  revalidatePath("/client/portal");
  return { success: true };
}
