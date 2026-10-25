"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { createClient } from "@/lib/supabase/server";

/** End the staff session and return to the login page. */
export async function signOut() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error("Could not sign out.", { cause: error });
  }

  redirect("/admin/login");
}

const markSeenSchema = z.object({
  kind: z.enum(["quote", "order"]),
  id: z.guid(),
});

/**
 * Unseen badges: stamp `first_viewed_at` on a quote/order the staff member has
 * just opened. The `mark_seen` RPC is idempotent (only writes when NULL) and
 * re-checks the staff role internally; `requireRole` mirrors that at the app
 * layer. `updateTag` gives read-your-writes on the sidebar badge — no other
 * revalidation, and no audit row: this is a view marker, not a business
 * action. Called from the <MarkSeen /> effect, never during render.
 */
export async function markSeen(
  kind: "quote" | "order",
  id: string,
): Promise<{ ok: true } | { ok: false }> {
  try {
    await requireRole(["owner", "manager", "sales"]);
  } catch {
    return { ok: false };
  }
  const parsed = markSeenSchema.safeParse({ kind, id });
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_seen", {
    p_kind: parsed.data.kind,
    p_id: parsed.data.id,
  });
  if (error) return { ok: false };

  updateTag(CACHE_TAGS.adminCounts);
  return { ok: true };
}
