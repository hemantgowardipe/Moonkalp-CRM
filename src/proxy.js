import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function proxy(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/client/portal") ||
    request.nextUrl.pathname.startsWith("/client/setup-password") ||
    request.nextUrl.pathname.startsWith("/reset-password") ||
    request.nextUrl.pathname.startsWith("/settings") ||
    request.nextUrl.pathname.startsWith("/invoices") ||
    request.nextUrl.pathname.startsWith("/files");

  if (!url || !key || !isProtectedRoute) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // getClaims() refreshes an expired session like getUser() does, but then
  // verifies the JWT locally when the project uses asymmetric signing keys
  // (the public keys are cached), so most navigations skip a round trip to the
  // Auth server. With legacy symmetric keys it falls back to getUser(). This is
  // only the fast gate: every page still calls getUser() through requireRole(),
  // so a revoked session is rejected there.
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/client/portal/:path*",
    "/client/setup-password",
    "/reset-password",
    "/settings/:path*",
    "/invoices/:path*",
    "/files/:path*",
  ],
};
