"use server";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema } from "@/lib/validators/password-reset";
import { logAudit } from "@/server/audit";

export type ChangePasswordState = {
  error: string | null;
  success: boolean;
};

const STAFF_ROLES = ["owner", "manager", "sales", "inventory"] as const;

/**
 * Logged-in staff change their own password (owner track, 2026-10-22). The
 * current password is verified by re-authenticating with
 * `signInWithPassword` — GoTrue itself is the oracle, we never compare hashes.
 * On success the new password is set on the fresh session, an audit row is
 * written (ids only, never any password), and the form reports success. The
 * current session stays signed in (this is a routine change, not a breach
 * response — the reset flow is the one that kills other sessions).
 */
export async function changePassword(
  _previousState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const profile = await requireRole(STAFF_ROLES);

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error:
        parsed.error.issues[0]?.message ??
        "Fill in every field (new password at least 12 characters).",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { success: false, error: "Session expired. Sign in again." };
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  });

  if (reauthError) {
    // One generic message — GoTrue's "Invalid login credentials" wording and
    // rate-limit errors are not distinguished for the caller.
    return { success: false, error: "Current password is incorrect." };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      success: false,
      error: "Could not update the password. Try again.",
    };
  }

  await logAudit(supabase, {
    actorId: profile.id,
    action: "auth.password_change",
    tableName: "auth",
    recordId: profile.id,
    diff: null,
  });

  return { success: true, error: null };
}
