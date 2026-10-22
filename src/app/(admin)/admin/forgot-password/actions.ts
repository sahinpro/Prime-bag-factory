"use server";

import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/lib/validators/password-reset";
import { getClientKey, hashEmail, isAllowed } from "@/server/abuse";

export type ForgotPasswordState = {
  /** True whenever a reset mail may have been sent — known address or not. */
  sent: boolean;
  error: string | null;
};

const RATE_LIMITED = "Too many requests. Try again in a little while.";

/**
 * Admin "forgot password" (owner track, 2026-10-22). Works with Supabase's
 * DEFAULT recovery email only: `redirectTo` must exactly match the allowlisted
 * URL in Auth → URL Configuration, so it is built from `NEXT_PUBLIC_SITE_URL`
 * with NO extra query string. The response is always the same generic success
 * — whether the address has an account or not is never revealed (no account
 * enumeration). Per-IP and per-email abuse limits ride the existing B1/B2
 * rate-limit RPC (hashed identities, no PII in `rate_limits`).
 */
export async function requestPasswordReset(
  _previousState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
  });

  if (!parsed.success) {
    return { sent: false, error: "Enter a valid email address." };
  }

  const email = parsed.data.email;

  const ipKey = await getClientKey();
  if (ipKey && !(await isAllowed("admin_reset_ip", ipKey))) {
    return { sent: false, error: RATE_LIMITED };
  }
  if (!(await isAllowed("admin_reset_email", hashEmail(email)))) {
    return { sent: false, error: RATE_LIMITED };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/admin/auth/confirm`,
  });

  if (error) {
    // GoTrue-side failure (e.g. its own mail rate limit). Log an inert line —
    // never the address — and still answer with the generic success so the
    // response shape cannot distinguish account states.
    console.error(
      JSON.stringify({
        scope: "admin.forgot_password",
        event: "resetPasswordForEmail_failed",
        detail: error.message,
      }),
    );
  }

  return { sent: true, error: null };
}
