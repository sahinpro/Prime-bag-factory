"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/validators/password-reset";
import { logAudit } from "@/server/audit";

export type ResetPasswordState = {
  error: string | null;
};

/**
 * Completes the admin password reset. Only meaningful with the recovery
 * session minted by `/admin/auth/confirm` — without it the page itself
 * redirects. On success: the password is updated, every OTHER session of the
 * account is signed out (a reset exists because a session may be compromised),
 * an audit row is written (ids only, never the password), and the browser is
 * sent back to the sign-in page with a success note.
 */
export async function completePasswordReset(
  _previousState: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/forgot-password?reason=invalid");
  }

  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Enter your new password twice (at least 12 characters).",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    // Generic — GoTrue messages can leak account state. Most common cause is
    // an expired/rotated recovery session: the user just asks for a new link.
    return {
      error: "Could not update the password. Request a new reset link.",
    };
  }

  await logAudit(supabase, {
    actorId: user.id,
    action: "auth.password_reset",
    tableName: "auth",
    recordId: user.id,
    diff: null,
  });

  // Kill every other live session of the account; this (recovery) session
  // simply rides the redirect back to the sign-in page.
  await supabase.auth.signOut({ scope: "others" });

  redirect("/admin/login?reset=1");
}
