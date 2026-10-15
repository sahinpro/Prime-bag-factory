import "server-only";

export const roles = [
  "owner",
  "manager",
  "sales",
  "inventory",
  "customer",
] as const;

export type Role = (typeof roles)[number];

/**
 * Staff authorization stub. Phase 1 replaces this with a Supabase session check.
 * It fails closed so a missing session cannot be treated as allowed.
 */
export async function requireRole(_allowed: readonly Role[]): Promise<never> {
  throw new Error(
    "requireRole is not available until staff auth is added in Phase 1.",
  );
}
