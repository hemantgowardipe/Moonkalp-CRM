import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const url = new URL(request.url);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const redirectOrigin = siteUrl ? new URL(siteUrl).origin : url.origin;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createClient();
  let error;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type === "invite") {
    ({ error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "invite",
    }));
  } else {
    // Default invite emails use the implicit flow, which puts the session in the
    // URL fragment. The server cannot read it, but the browser keeps it across
    // this redirect so the confirm page can.
    return NextResponse.redirect(new URL("/auth/confirm", redirectOrigin));
  }

  if (error) {
    return NextResponse.redirect(new URL("/login?invite=expired", redirectOrigin));
  }

  return NextResponse.redirect(new URL("/client/setup-password", redirectOrigin));
}
