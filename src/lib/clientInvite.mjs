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
