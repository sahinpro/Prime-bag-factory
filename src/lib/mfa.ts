import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * MFA helpers for the admin panel (plan §15 D2, order-of-work step 11).
 *
 * Enforcement is deliberately **flag-gated** so the panel is never locked out by
 * an un-coordinated config change: page-level blocking of owner/manager sessions
 * that sit below AAL2 only happens while `settings.security.require_mfa` is
 * `true` (seeded `false`). Turning it on is an explicit owner action, taken only
 * after TOTP is enabled on the Supabase host and every owner/manager has enrolled
 * on `/admin/security`. With the flag off, `assertMfaIfRequired` is a no-op and
 * admin behaves exactly as before, so the existing suite stays green.
 */

/** Roles that must clear AAL2 when enforcement is on (plan: owner + manager). */
const MFA_ROLES = new Set(["owner", "manager"]);

/**
 * Pure decision used by `assertMfaIfRequired` and unit-tested in isolation: a
 * session is blocked only when enforcement is on, the role is owner/manager, and
 * the current authenticator assurance level is anything short of `aal2`.
 */
export function shouldBlockForMfa(args: {
  requireMfa: boolean;
  role: string;
  aal: string | null;
}): boolean {
  if (!args.requireMfa) return false;
  if (!MFA_ROLES.has(args.role)) return false;
  return args.aal !== "aal2";
}

/** Thrown by `requireRole` when an owner/manager session must elevate to AAL2. */
export class MfaRequiredError extends Error {
  constructor() {
    super("MFA_REQUIRED");
    this.name = "MfaRequiredError";
  }
}

export type MfaFactor = {
  id: string;
  friendlyName: string | null;
  enrolledAt: string | null;
};

export type MfaFactorRow = MfaFactor & { verified: boolean };

/** Read the enforcement flag (default OFF). Settings are public-read, so any
 * verified session may consult it; only owner/manager may write it (RLS). */
export async function getRequireMfaFlag(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "security")
    .maybeSingle();
  const value = (data?.value ?? {}) as Record<string, unknown>;
  return value.require_mfa === true;
}

/** The current session's authenticator assurance level (`aal1`/`aal2`/null). */
export async function getCurrentAal(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel ?? null;
}

/** Confirmed TOTP factors on the current user (for the login/enrolment pages). */
export async function listTotpFactors(): Promise<MfaFactor[]> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const totp = data?.totp ?? [];
  return totp
    .filter((f) => f.status === "verified")
    .map((f) => ({
      id: f.id,
      friendlyName: f.friendly_name ?? null,
      enrolledAt: f.created_at ?? null,
    }));
}

/** Whether the current user has any verified TOTP factor (drives the login
 * challenge independent of the enforcement flag). */
export async function hasVerifiedTotp(): Promise<boolean> {
  return (await listTotpFactors()).length > 0;
}

/** Every TOTP factor on the current user, verified or still pending, so the
 * security page can list and remove a half-finished enrolment. */
export async function listAllFactors(): Promise<MfaFactorRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const totp = data?.totp ?? [];
  return totp.map((f) => ({
    id: f.id,
    friendlyName: f.friendly_name ?? null,
    enrolledAt: f.created_at ?? null,
    verified: f.status === "verified",
  }));
}

/**
 * Called from `requireRole` after the role check passes. Cheap no-op unless the
 * role is owner/manager; then it reads the flag and, only when enforcement is
 * on, checks the AAL level and throws so the mutation is refused.
 */
export async function assertMfaIfRequired(profile: {
  role: string;
}): Promise<void> {
  if (!MFA_ROLES.has(profile.role)) return;
  const requireMfa = await getRequireMfaFlag();
  if (!requireMfa) return;
  const aal = await getCurrentAal();
  if (shouldBlockForMfa({ requireMfa, role: profile.role, aal })) {
    throw new MfaRequiredError();
  }
}

/** Convenience for the protected layout: does this signed-in staff member need
 * to be sent to the MFA challenge right now? */
export async function adminNeedsMfaChallenge(profile: {
  role: string;
}): Promise<boolean> {
  if (!MFA_ROLES.has(profile.role)) return false;
  const requireMfa = await getRequireMfaFlag();
  if (!requireMfa) return false;
  const aal = await getCurrentAal();
  return shouldBlockForMfa({ requireMfa, role: profile.role, aal });
}
