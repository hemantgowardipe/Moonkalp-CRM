"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { isUuid } from "@/lib/crmRecords.mjs";
import { deliverableStoragePath, validateDeliverableFile } from "@/lib/deliverableFiles.mjs";
import { DELIVERABLE_FILES_BUCKET } from "@/lib/deliverableFilesServer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function uploadDeliverableFile(_previousState, formData) {
  const profile = await requireRole(["admin", "team_member"]);

  const deliverableId = String(formData.get("deliverable_id") ?? "");
  if (!isUuid(deliverableId)) return { error: "That deliverable could not be found." };

  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a file to upload." };

  const { values, error: validationError } = validateDeliverableFile({ name: file.name, size: file.size });
  if (validationError) return { error: validationError };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "File uploads require SUPABASE_SERVICE_ROLE_KEY in the server environment." };
  }

  // RLS scopes this read, so it also confirms the deliverable exists for staff.
  const supabase = await createClient();
  const { data: deliverable, error: deliverableError } = await supabase
    .from("deliverables")
    .select("id")
    .eq("id", deliverableId)
    .maybeSingle();

  if (deliverableError) return { error: `Could not check the deliverable: ${deliverableError.message}` };
  if (!deliverable) return { error: "That deliverable no longer exists." };

  const fileId = randomUUID();
  const storagePath = deliverableStoragePath(deliverableId, fileId, values.extension);

  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from(DELIVERABLE_FILES_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), { contentType: values.contentType });

  if (uploadError) {
    console.error("[deliverable-file] Upload failed", uploadError.message);
    return { error: `Could not store the file: ${uploadError.message}` };
  }

  const { error: insertError } = await supabase.from("deliverable_files").insert({
    id: fileId,
    deliverable_id: deliverableId,
    storage_path: storagePath,
    file_name: values.fileName,
    content_type: values.contentType,
    size_bytes: values.sizeBytes,
    uploaded_by: profile.auth_id,
  });

  if (insertError) {
    console.error("[deliverable-file] Record failed", insertError.message);
    // Don't leave unreachable bytes in the bucket.
    await admin.storage.from(DELIVERABLE_FILES_BUCKET).remove([storagePath]);
    return { error: `Could not save the file record: ${insertError.message}` };
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/client/portal");
  return { success: true };
}

export async function deleteDeliverableFile(_previousState, formData) {
  await requireRole(["admin", "team_member"]);

  const fileId = String(formData.get("id") ?? "");
  if (!isUuid(fileId)) return { error: "That file could not be found." };

  const supabase = await createClient();
  const { data: file, error: loadError } = await supabase
    .from("deliverable_files")
    .select("id, storage_path")
    .eq("id", fileId)
    .maybeSingle();

  if (loadError) return { error: `Could not load the file record: ${loadError.message}` };
  if (!file) return { error: "That file no longer exists." };

  const { error } = await supabase.from("deliverable_files").delete().eq("id", fileId);
  if (error) return { error: `Could not delete the file: ${error.message}` };

  const { error: removeError } = await createAdminClient()
    .storage.from(DELIVERABLE_FILES_BUCKET)
    .remove([file.storage_path]);
  if (removeError) {
    // The record is gone so nothing can reach the bytes; log for cleanup.
    console.error("[deliverable-file] Orphaned object", file.storage_path, removeError.message);
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/client/portal");
  return { success: true };
}
