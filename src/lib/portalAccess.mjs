export const PORTAL_EVENT_LABELS = {
  invite_sent: "Invitation sent",
  invite_resent: "Invitation re-sent",
  access_disabled: "Access disabled",
  access_enabled: "Access re-enabled",
};

// Where a redirect may land after an emailed auth link. Anything else falls
// back to the default so links cannot be used as open redirects.
export const AUTH_LINK_DESTINATIONS = {
  invite: "/client/setup-password",
  recovery: "/reset-password",
};

/**
 * Summarises a client's portal login from the client_portal_access() row.
 * - not_invited: no login is linked to the client record
 * - invited: a login exists but no password has been set yet
 * - active: the client has set a password
 * - disabled: staff have switched access off
 */
export function getPortalStatus(access) {
  if (!access) return "not_invited";
  if (access.disabled_at) return "disabled";
  return access.password_set ? "active" : "invited";
}

export function isAuthLinkType(type) {
  return typeof type === "string" && Object.hasOwn(AUTH_LINK_DESTINATIONS, type);
}

export function getAuthLinkDestination(type) {
  return isAuthLinkType(type) ? AUTH_LINK_DESTINATIONS[type] : AUTH_LINK_DESTINATIONS.invite;
}

// Sign-in methods Supabase records (in the JWT "amr" claim) for sessions that
// came from an emailed link rather than a password.
const EMAIL_LINK_METHODS = new Set(["recovery", "invite", "otp", "magiclink"]);
export const EMAIL_LINK_SESSION_MAX_AGE_SECONDS = 60 * 60;

/**
 * True when the session was opened from an emailed link recently. Password
 * screens require this so an unattended signed-in browser cannot be used to
 * change the password without the old one.
 */
export function isRecentEmailLinkSession(claims, nowSeconds = Math.floor(Date.now() / 1000)) {
  const entries = Array.isArray(claims?.amr) ? claims.amr : [];
  return entries.some(
    (entry) =>
      typeof entry === "object" &&
      EMAIL_LINK_METHODS.has(entry.method) &&
      nowSeconds - Number(entry.timestamp) <= EMAIL_LINK_SESSION_MAX_AGE_SECONDS,
  );
}

export function describeAuthError(error) {
  if (error?.status === 429 || error?.code === "over_email_send_rate_limit") {
    return "Too many emails have been sent recently. Wait a few minutes before trying again.";
  }
  return null;
}
