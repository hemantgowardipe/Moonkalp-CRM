import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";
import { isUuid } from "@/lib/crmRecords.mjs";
import { DELIVERABLE_FILES_BUCKET } from "@/lib/deliverableFilesServer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Hands the signed-in user a short-lived link to a deliverable file. The
 * bucket is private; whether this row is visible at all is decided by RLS
 * (staff see everything, clients only files on their own deliverables).
 */
export async function GET(request, { params }) {
  const { fileId } = await params;
  if (!isUuid(fileId)) return new NextResponse("Not found", { status: 404 });

  const profile = await getCurrentProfile();
  if (!profile || profile.access_disabled_at) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createClient();
  const { data: file, error } = await supabase
    .from("deliverable_files")
    .select("id, storage_path, file_name")
    .eq("id", fileId)
    .maybeSingle();

  if (error) return new NextResponse("Could not load the file", { status: 500 });
  if (!file) return new NextResponse("Not found", { status: 404 });

  const wantsDownload = new URL(request.url).searchParams.get("download") === "1";
  const { data: signed, error: signError } = await createAdminClient()
    .storage.from(DELIVERABLE_FILES_BUCKET)
    .createSignedUrl(file.storage_path, 300, wantsDownload ? { download: file.file_name } : undefined);

  if (signError || !signed?.signedUrl) {
    console.error("[deliverable-file] Could not sign URL", signError?.message);
    return new NextResponse("Could not open the file", { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, { headers: { "Cache-Control": "no-store" } });
}
