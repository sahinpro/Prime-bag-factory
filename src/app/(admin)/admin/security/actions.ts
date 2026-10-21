"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { mfaCodeSchema, enrollFactorSchema } from "@/lib/validators/mfa";
import { logAudit } from "@/server/audit";

/**
 * MFA self-service actions (plan §15 D2, order-of-work step 11). Owner/manager
 * only, mirroring the enrolment page's gate. These drive Supabase's GoTrue MFA
 * calls; the enrolment/verification itself is not a table write, but every
 * security-relevant action drops an `audit_logs` row (actor, action, factor id —
 * never the shared secret) so the change is tamper-evident.
 */

const MFA_ROLES = ["owner", "manager"] as const;

type ActionResult = { ok: true } | { ok: false; error: string };

export type { ActionResult };

const DENIED_MESSAGE = "You are not authorized to manage security.";

export type EnrollResult =
  | {
      ok: true;
      factorId: string;
      secret: string;
      uri: string;
      qrCode: string;
    }
  | { ok: false; error: string };

/** Start a TOTP enrolment: returns the secret/URI/QR for the authenticator app.
 * The factor is pending until `verifyFactor` confirms a code. */
export async function enrollFactor(
  payload: { friendlyName?: string } = {},
): Promise<EnrollResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(MFA_ROLES)).id;
  } catch {
    return { ok: false, error: DENIED_MESSAGE };
  }

  const parsed = enrollFactorSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Enter a valid device name." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Prime Bag Factory",
    friendlyName: parsed.data.friendlyName || undefined,
  });

  if (error || !data || !data.totp) {
    return { ok: false, error: "Could not start authenticator enrolment." };
  }

  const supabaseForAudit = await createClient();
  await logAudit(supabaseForAudit, {
    actorId,
    action: "mfa.enroll_start",
    tableName: "auth_factors",
    recordId: data.id,
    diff: { friendly_name: parsed.data.friendlyName ?? null },
  });

  return {
    ok: true,
    factorId: data.id,
    secret: data.totp.secret,
    uri: data.totp.uri,
    qrCode: data.totp.qr_code,
  };
}

/** Confirm a pending factor with a 6-digit code, making it the active factor. */
export async function verifyFactor(
  factorId: string,
  code: string,
): Promise<ActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(MFA_ROLES)).id;
  } catch {
    return { ok: false, error: DENIED_MESSAGE };
  }

  const parsed = mfaCodeSchema.safeParse(code);
  if (!parsed.success || !factorId) {
    return { ok: false, error: "Enter the 6-digit code from your app." };
  }

  const supabase = await createClient();
  // GoTrue always pairs a verify with a fresh challenge, including the initial
  // confirm right after enrolment.
  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challenge?.id) {
    return { ok: false, error: "Could not start verification. Try again." };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: parsed.data,
  });

  if (error) {
    return { ok: false, error: "That code is not valid. Try again." };
  }

  const supabaseForAudit = await createClient();
  await logAudit(supabaseForAudit, {
    actorId,
    action: "mfa.enroll_verify",
    tableName: "auth_factors",
    recordId: factorId,
    diff: null,
  });

  revalidatePath("/admin/security");
  return { ok: true };
}

/** Remove a factor (verified or pending). */
export async function unenrollFactor(factorId: string): Promise<ActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(MFA_ROLES)).id;
  } catch {
    return { ok: false, error: DENIED_MESSAGE };
  }

  if (!factorId) return { ok: false, error: "Pick a device to remove." };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return { ok: false, error: "Could not remove that authenticator." };
  }

  const supabaseForAudit = await createClient();
  await logAudit(supabaseForAudit, {
    actorId,
    action: "mfa.unenroll",
    tableName: "auth_factors",
    recordId: factorId,
    diff: null,
  });

  revalidatePath("/admin/security");
  return { ok: true };
}

/**
 * Flip MFA enforcement (`settings.security.require_mfa`). Turning it ON makes
 * every owner/manager session below AAL2 get bounced to the challenge page, so
 * the UI warns loudly and the operator must enrol on every device first. Only
 * owner/manager may write; the flag value (never a secret) is audit-logged.
 */
export async function setRequireMfa(
  enabled: boolean,
): Promise<ActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(MFA_ROLES)).id;
  } catch {
    return { ok: false, error: DENIED_MESSAGE };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "security")
    .maybeSingle();
  const value = {
    ...(existing?.value && typeof existing.value === "object"
      ? (existing.value as Record<string, unknown>)
      : {}),
    require_mfa: enabled,
  };

  const { error } = await supabase
    .from("settings")
    .upsert({ key: "security", value }, { onConflict: "key" });
  if (error) {
    return { ok: false, error: "Could not update the enforcement setting." };
  }

  await logAudit(supabase, {
    actorId,
    action: "settings.security",
    tableName: "settings",
    recordId: null,
    diff: { require_mfa: enabled },
  });

  revalidatePath("/admin/security");
  return { ok: true };
}
