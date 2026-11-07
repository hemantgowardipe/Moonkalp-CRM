"use server";

import { revalidatePath } from "next/cache";
import { getClientInviteRedirectUrl } from "@/lib/clientInvite.mjs";
import {
  PAYMENT_STATUSES,
  PIPELINE_STATUSES,
  isUuid,
  parseDeliverableForm,
  parsePaymentForm,
  parseServiceForm,
  todayIsoDate,
} from "@/lib/crmRecords.mjs";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function createClientRecord(_previousState, formData) {
  await requireRole(["admin", "team_member"]);

  const name = String(formData.get("name") ?? "").trim();
  const companyName = String(formData.get("company_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!name || !companyName || !email) {
    return { error: "Contact name, company name, and email are required." };
  }

  const supabase = await createClient();
  const { data: createdClient, error } = await supabase
    .from("clients")
    .insert({
      name,
      company_name: companyName,
      email,
      phone: phone || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error(
      "[client-record] Insert failed",
      JSON.stringify({
        code: error.code ?? null,
        message: error.message,
        hint: error.hint ?? null,
      }),
    );
    const code = error.code ? ` (${error.code})` : "";
    return { error: `Could not save this client${code}: ${error.message}` };
  }

  if (!createdClient?.id) {
    throw new Error("Supabase did not return the ID of the created client record.");
  }

  revalidatePath("/admin/dashboard");
  return { success: true };
}

export async function inviteClientToPortal(_previousState, formData) {
  const profile = await requireRole(["admin", "team_member"]);
  const clientId = String(formData.get("client_id") ?? "");

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)) {
    return { error: "Select a valid client record." };
  }

  const supabase = await createClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, company_name, email")
    .eq("id", clientId)
    .maybeSingle();

  if (clientError) {
    return { error: `Could not load client record: ${clientError.message}` };
  }
  if (!client) return { error: "That client record could not be found." };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Portal invitations require SUPABASE_SERVICE_ROLE_KEY in the server environment." };
  }

  const { redirectTo, error: redirectError } = getClientInviteRedirectUrl(
    process.env.NEXT_PUBLIC_SITE_URL,
  );
  if (redirectError) return { error: redirectError };

  const admin = createAdminClient();
  const { data: linkedProfile, error: linkedProfileError } = await admin
    .from("users")
    .select("id")
    .eq("client_id", client.id)
    .maybeSingle();

  if (linkedProfileError) {
    console.error("[client-invite] Could not check existing profile", linkedProfileError.message);
    return { error: "Could not check whether this client already has portal access." };
  }
  if (linkedProfile) {
    return { error: "This client already has a portal account linked." };
  }

  // A previous attempt may have left a pending invitation for this client; reuse it.
  const { data: pendingInvitation, error: pendingInvitationError } = await admin
    .from("client_portal_invitations")
    .select("id")
    .eq("client_id", client.id)
    .eq("email", client.email)
    .is("consumed_at", null)
    .maybeSingle();

  if (pendingInvitationError) {
    console.error("[client-invite] Could not check pending invitations", pendingInvitationError.message);
    return { error: "Could not check for an existing invitation for this client." };
  }

  const { data: invitation, error: invitationError } = pendingInvitation
    ? { data: pendingInvitation, error: null }
    : await admin
      .from("client_portal_invitations")
      .insert({
        client_id: client.id,
        email: client.email,
        invited_by: profile.auth_id,
      })
      .select("id")
      .single();

  if (invitationError) {
    console.error(
      "[client-invite] Could not create invitation record",
      JSON.stringify({
        code: invitationError.code ?? null,
        message: invitationError.message,
      }),
    );
    return {
      error: invitationError.code === "23505"
        ? "An invitation for this email is already being processed."
        : `Could not prepare the invitation: ${invitationError.message}`,
    };
  }

  const { data: inviteData, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(client.email, {
      data: { full_name: client.name, company_name: client.company_name },
      redirectTo,
    });

  if (inviteError) {
    const { data: linkedAfterFailure, error: linkedAfterFailureError } = await admin
      .from("users")
      .select("id")
      .eq("client_id", client.id)
      .maybeSingle();

    if (linkedAfterFailureError) {
      console.error("[client-invite] Could not verify invitation after send error", linkedAfterFailureError.message);
      return {
        error: "Supabase reported an invitation error, and portal access could not be verified. Check the client record before retrying.",
      };
    }

    if (!linkedAfterFailure) {
      const { error: cleanupError } = await admin
        .from("client_portal_invitations")
        .delete()
        .eq("id", invitation.id)
        .is("consumed_at", null);
      if (cleanupError) {
        console.error("[client-invite] Could not clean up pending invitation", cleanupError.message);
        return {
          error: "The invitation failed and its pending record could not be cleared. Contact your administrator before retrying.",
        };
      }
      console.error(
        "[client-invite] Supabase rejected invitation",
        JSON.stringify({
          code: inviteError.code ?? null,
          status: inviteError.status ?? null,
          message: inviteError.message,
        }),
      );
      return {
        error: inviteError.status === 429
          ? "Supabase is temporarily limiting invitation emails. Wait before retrying."
          : `Could not send the invitation: ${inviteError.message}`,
      };
    }

    revalidatePath("/admin/dashboard");
    return {
      success: true,
      warning: "The portal account was linked, but Supabase reported an email delivery issue. Check Auth email settings before inviting again.",
    };
  }

  const invitedAuthId = inviteData.user?.id;
  if (!invitedAuthId) {
    throw new Error("Supabase accepted the invitation but did not return the invited user's ID.");
  }
  const { data: linkedProfileAfterInvite, error: profileLookupError } = await admin
    .from("users")
    .select("id")
    .eq("client_id", client.id)
    .eq("auth_id", invitedAuthId)
    .maybeSingle();

  if (profileLookupError) {
    throw new Error(`The invitation was sent, but the client profile check failed: ${profileLookupError.message}`);
  }
  if (!linkedProfileAfterInvite) {
    throw new Error(
      "Supabase sent the invitation but did not link a client portal profile. Check that the portal-invites migration was run.",
    );
  }

  revalidatePath("/admin/dashboard");
  return { success: true };
}

async function saveRecord(label, run) {
  await requireRole(["admin", "team_member"]);

  const supabase = await createClient();
  const { error } = await run(supabase);

  if (error) {
    console.error(
      `[${label}] Save failed`,
      JSON.stringify({ code: error.code ?? null, message: error.message, hint: error.hint ?? null }),
    );
    const code = error.code ? ` (${error.code})` : "";
    return { error: `Could not save${code}: ${error.message}` };
  }

  revalidatePath("/admin/dashboard");
  return { success: true };
}

export async function createClientService(_previousState, formData) {
  const { values, error } = parseServiceForm(formData);
  if (error) return { error };

  return saveRecord("client-service", (supabase) =>
    supabase.from("client_services").insert(values),
  );
}

export async function createDeliverable(_previousState, formData) {
  const { values, error } = parseDeliverableForm(formData);
  if (error) return { error };

  return saveRecord("deliverable", (supabase) =>
    supabase.from("deliverables").insert(values),
  );
}

export async function updateDeliverableStatus(_previousState, formData) {
  const deliverableId = String(formData.get("deliverable_id") ?? "");
  const pipelineStatus = String(formData.get("pipeline_status") ?? "");

  if (!isUuid(deliverableId) || !PIPELINE_STATUSES.includes(pipelineStatus)) {
    return { error: "Choose a valid pipeline stage." };
  }

  return saveRecord("deliverable-status", (supabase) =>
    supabase.from("deliverables").update({ pipeline_status: pipelineStatus }).eq("id", deliverableId),
  );
}

export async function createPayment(_previousState, formData) {
  const { values, error } = parsePaymentForm(formData);
  if (error) return { error };

  return saveRecord("payment", (supabase) =>
    supabase.from("payments").insert(values),
  );
}

export async function updatePaymentStatus(_previousState, formData) {
  const paymentId = String(formData.get("payment_id") ?? "");
  const paymentStatus = String(formData.get("payment_status") ?? "");

  if (!isUuid(paymentId) || !PAYMENT_STATUSES.includes(paymentStatus)) {
    return { error: "Choose a valid payment status." };
  }

  return saveRecord("payment-status", (supabase) =>
    supabase
      .from("payments")
      .update({
        payment_status: paymentStatus,
        paid_date: paymentStatus === "Paid" ? todayIsoDate() : null,
      })
      .eq("id", paymentId),
  );
}
