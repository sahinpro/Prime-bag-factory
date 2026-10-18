import "server-only";

import { createClient } from "@/lib/supabase/server";

export const roles = [
  "owner",
  "manager",
  "sales",
  "inventory",
  "customer",
] as const;

export type Role = (typeof roles)[number];

export type SessionProfile = {
  id: string;
  role: Role;
};

export type AdminUser = SessionProfile & {
  fullName: string;
  email: string;
};

export async function getCurrentProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error("Failed to verify the current user.", { cause: error });
  }

  if (!user) {
    return null;
  }

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error("Failed to load the current user's profile.", {
      cause: profileError,
    });
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    role: data.role,
  };
}

/**
 * Require a valid staff/customer session and a matching role from the profiles table.
 * This fails closed to avoid treating an unauthenticated request as authorized.
 */
export async function requireRole(
  allowed: readonly Role[],
): Promise<SessionProfile> {
  const profile = await getCurrentProfile();

  if (!profile) {
    throw new Error("Authentication required.");
  }

  if (!allowed.includes(profile.role)) {
    throw new Error(
      `Access denied. Required role: ${allowed.join(", ")}. ` +
        `Current role: ${profile.role}.`,
    );
  }

  return profile;
}

/**
 * Load the signed-in staff member's identity for the admin shell (name + email
 * for the user card). Returns null when there is no verified staff session.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error("Failed to load the current user's profile.", {
      cause: profileError,
    });
  }

  if (!data || data.role === "customer") {
    return null;
  }

  return {
    id: data.id,
    role: data.role,
    fullName: data.full_name ?? user.email ?? "Staff",
    email: user.email ?? "",
  };
}
