import { createServerClient } from "@supabase/ssr";
import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";

const handleI18nRouting = createMiddleware(routing);

/**
 * D6 (plan §15) — admin CSP. The admin panel is fully dynamic (`instant = false`
 * + `connection()` on every page), so a per-request nonce costs nothing there,
 * while the public site relies on static rendering / PPR / ISR that a nonce would
 * disable. The policy is therefore scoped to `/admin/*` and sent as
 * `Content-Security-Policy-Report-Only`: the browser reports violations to
 * `/api/csp-report` but blocks nothing, so we can watch for a clean week before
 * enforcing. `style-src 'unsafe-inline'` is required by Tailwind/shadcn (and the
 * inlined stylesheet); scripts are nonce-gated with `strict-dynamic`. Cloudinary
 * and the Supabase origin are allowed for images and XHR/auth.
 */
function buildAdminCsp(nonce: string): string {
  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseOrigin = new URL(supabaseUrl).origin;
  const supabaseWs = supabaseOrigin.replace(/^http/, "ws");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://res.cloudinary.com ${supabaseOrigin}`,
    `connect-src 'self' ${supabaseOrigin} ${supabaseWs}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "report-uri /api/csp-report",
  ].join("; ");
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");

  // Mint the nonce only for admin requests. The internal `x-nonce` header lets
  // the admin layout stamp its own inline theme script; the internal
  // `Content-Security-Policy` request header lets Next auto-stamp its framework
  // scripts. Neither is a response header, so nothing is enforced on the browser
  // here — only the Report-Only header we set on the way out.
  let csp: string | undefined;
  if (isAdmin) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    csp = buildAdminCsp(nonce);
    request.headers.set("x-nonce", nonce);
    request.headers.set("Content-Security-Policy", csp);
  }

  const withReportOnly = (response: NextResponse): NextResponse => {
    if (csp) response.headers.set("Content-Security-Policy-Report-Only", csp);
    return response;
  };

  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return withReportOnly(NextResponse.next({ request }));
  }

  if (isAdmin) {
    let response = NextResponse.next({ request });
    const supabase = createServerClient(
      publicEnv.NEXT_PUBLIC_SUPABASE_URL,
      publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            for (const { name, value } of cookiesToSet) {
              request.cookies.set(name, value);
            }

            response = NextResponse.next({ request });
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      },
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!error && user) {
      return withReportOnly(response);
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return withReportOnly(redirectResponse);
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
