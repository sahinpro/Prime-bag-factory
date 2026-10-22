import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Supabase auth confirmation landing for the admin password-reset email
 * (owner track, 2026-10-22). The default email template links to
 * `<SITE_URL>/admin/auth/confirm?code=...` (PKCE flow) — the URL must match
 * the Auth → URL Configuration allowlist exactly, which is why the forgot
 * action sends `redirectTo` with no extra query string.
 *
 * - `code` → `exchangeCodeForSession` (what the DEFAULT template produces).
 * - `token_hash` + `type=recovery` → `verifyOtp` (kept for a future custom
 *   template; the token-hash flow is what implicit/legacy links carry).
 *
 * Success always lands on the hardcoded `/admin/reset-password` — never on a
 * client-supplied target, so this handler is not an open redirect. Failure
 * lands on `/admin/forgot-password?reason=invalid` with one generic message.
 * Codes, hashes and full query strings are never logged.
 */

function noStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function redirectTo(request: NextRequest, path: string): NextResponse {
  return noStore(NextResponse.redirect(new URL(path, request.url), 302));
}

function redirectToInvalidLink(request: NextRequest): NextResponse {
  return redirectTo(request, "/admin/forgot-password?reason=invalid");
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return redirectTo(request, "/admin/reset-password");
    return redirectToInvalidLink(request);
  }

  if (tokenHash && type === "recovery") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (!error) return redirectTo(request, "/admin/reset-password");
    return redirectToInvalidLink(request);
  }

  return redirectToInvalidLink(request);
}
