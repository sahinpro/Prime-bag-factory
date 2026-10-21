"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getSafeAdminRedirectPath } from "@/lib/auth-redirect";
import { mfaCodeSchema } from "@/lib/validators/mfa";

export type MfaVerifyState = { error: string | null };

/**
 * Verify a TOTP challenge (plan §15 D2). The page created the challenge and
 * hands `factorId`/`challengeId` down; this action validates the 6-digit code
 * with zod and calls GoTrue, which elevates the session to AAL2 on success. The
 * `next` target is sanitized with the same helper the login uses, so a crafted
 * value can only ever point back into `/admin`.
 */
export async function verifyMfaCode(
  _previous: MfaVerifyState,
  formData: FormData,
): Promise<MfaVerifyState> {
  const parsed = mfaCodeSchema.safeParse(formData.get("code"));
  const factorId = String(formData.get("factorId") ?? "");
  const challengeId = String(formData.get("challengeId") ?? "");
  const next = getSafeAdminRedirectPath(
    formData.get("next") ? String(formData.get("next")) : undefined,
  );

  if (!parsed.success || !factorId || !challengeId) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId,
    code: parsed.data,
  });

  if (error) {
    return { error: "That code is not valid. Check your app and try again." };
  }

  redirect(next);
}

/** Leave the challenge and end the half-authenticated session. */
export async function cancelMfaChallenge(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
