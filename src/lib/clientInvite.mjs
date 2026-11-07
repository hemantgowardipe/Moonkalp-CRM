const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function isLocalUrl(value) {
  try {
    return LOCAL_HOSTS.has(new URL(value).hostname);
  } catch {
    return false;
  }
}

// The public address auth emails should link back to. NEXT_PUBLIC_SITE_URL
// wins, except that a localhost value is never right on a deployed server:
// there we fall back to the address Vercel reports for this deployment.
export function resolveSiteUrl(env = process.env) {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!env.VERCEL || (configured && !isLocalUrl(configured))) return configured || undefined;

  const host = env.VERCEL_ENV === "production" ? env.VERCEL_PROJECT_PRODUCTION_URL : env.VERCEL_URL;
  return host ? `https://${host}` : configured || undefined;
}

export function getClientInviteRedirectUrl(siteUrl) {
  if (!siteUrl) {
    return { error: "Set NEXT_PUBLIC_SITE_URL before sending portal invitations." };
  }

  try {
    const parsedUrl = new URL(siteUrl);
    const isLocalHttp = parsedUrl.protocol === "http:" && parsedUrl.hostname === "localhost";
    if (parsedUrl.protocol !== "https:" && !isLocalHttp) {
      return { error: "NEXT_PUBLIC_SITE_URL must use HTTPS outside localhost." };
    }

    return { redirectTo: new URL("/auth/callback", parsedUrl).toString() };
  } catch {
    return { error: "NEXT_PUBLIC_SITE_URL must be a valid absolute URL." };
  }
}
