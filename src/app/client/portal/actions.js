"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function reviewDeliverable(_previousState, formData) {
  const profile = await requireRole(["client"]);
  const deliverableId = String(formData.get("deliverable_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!deliverableId || !["Approved", "Revision Requested"].includes(decision)) {
    return { error: "Select a valid deliverable review action." };
  }

  if (note.length > 2000) {
    return { error: "Your note must be 2,000 characters or fewer." };
  }

  const supabase = await createClient();
  const { data: deliverable, error: deliverableError } = await supabase
    .from("deliverables")
    .select("id, pipeline_status, client_services!inner(client_id)")
    .eq("id", deliverableId)
    .eq("client_services.client_id", profile.client_id)
    .maybeSingle();

  if (deliverableError) {
    return { error: `Could not verify this deliverable: ${deliverableError.message}` };
  }

  if (!deliverable || deliverable.pipeline_status !== "Pending Approval") {
    return { error: "This deliverable is no longer available for review." };
  }

  const { error } = await supabase.from("deliverable_reviews").insert({
    deliverable_id: deliverableId,
    client_id: profile.client_id,
    reviewed_by: profile.auth_id,
    action: decision,
    note: note || null,
  });

  if (error) {
    return { error: `Could not submit your review: ${error.message}` };
  }

  revalidatePath("/client/portal");
  return { success: true };
}
