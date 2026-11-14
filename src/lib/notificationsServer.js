// Server-only notification delivery. Rows are written with the service-role
// client because the recipient is never the acting user (a client action
// notifies staff and vice versa); callers must authorise the actor first.
import { sendEmail } from "@/lib/email";
import { resolveSiteUrl } from "@/lib/clientInvite.mjs";
import { emailForNotification } from "@/lib/notificationRules.mjs";
import { DEFAULT_ORGANIZATION } from "@/lib/settingsRules.mjs";
import { createAdminClient } from "@/lib/supabase/admin";

async function deliver(admin, recipients, notification) {
  if (!recipients.length) return { delivered: 0 };

  const { error } = await admin.from("notifications").insert(
    recipients.map((recipient) => ({
      recipient_auth_id: recipient.auth_id,
      type: notification.type,
      title: notification.title,
      body: notification.body ?? null,
      href: notification.href ?? null,
    })),
  );

  if (error) {
    console.error("[notifications] Insert failed", error.message);
    return { error: error.message };
  }

  // Email mirrors the in-app message; a provider outage only costs the email.
  const { data: organization } = await admin
    .from("organization_settings")
    .select("agency_name")
    .maybeSingle();
  const email = emailForNotification(notification, {
    agencyName: organization?.agency_name ?? DEFAULT_ORGANIZATION.agency_name,
    siteUrl: resolveSiteUrl(),
  });
  await sendEmail({ to: recipients.map((recipient) => recipient.email), ...email });

  return { delivered: recipients.length };
}

/** Notifies the portal login(s) linked to a client record. */
export async function notifyClientUsers(clientId, notification) {
  const admin = createAdminClient();
  const { data: recipients, error } = await admin
    .from("users")
    .select("auth_id, email")
    .eq("client_id", clientId)
    .eq("role", "client")
    .is("access_disabled_at", null);

  if (error) {
    console.error("[notifications] Could not load client recipients", error.message);
    return { error: error.message };
  }
  return deliver(admin, recipients ?? [], notification);
}

/** Notifies every enabled agency user (admins and team members). */
export async function notifyStaff(notification) {
  const admin = createAdminClient();
  const { data: recipients, error } = await admin
    .from("users")
    .select("auth_id, email")
    .in("role", ["admin", "team_member"])
    .is("access_disabled_at", null);

  if (error) {
    console.error("[notifications] Could not load staff recipients", error.message);
    return { error: error.message };
  }
  return deliver(admin, recipients ?? [], notification);
}
