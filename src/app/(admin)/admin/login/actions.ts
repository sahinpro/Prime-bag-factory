"use server";

import { redirect } from "next/navigation";

import { staffLoginSchema } from "@/lib/validators/staff-login";
import { createClient } from "@/lib/supabase/server";
import { getSafeAdminRedirectPath } from "@/lib/auth-redirect";

export type StaffLoginState = {
  error: string | null;
};

export async function signIn(
  _previousState: StaffLoginState,
  formData: FormData,
): Promise<StaffLoginState> {
  const parsed = staffLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: "Email or password is incorrect." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError) {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      throw new Error("Could not end the unverified session.", {
        cause: signOutError,
      });
    }
    throw new Error("Could not verify staff access.", { cause: profileError });
  }

  if (!profile || profile.role === "customer") {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      throw new Error("Could not end the unauthorized session.", {
        cause: signOutError,
      });
    }
    return { error: "This account is not authorized for admin access." };
  }

  redirect(getSafeAdminRedirectPath(parsed.data.next));
}
