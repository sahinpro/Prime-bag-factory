"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { unblockSchema } from "@/lib/validators/blocked-contacts";

/**
 * Plan 15.2 B4b — remove an entry from the staff blocklist. One row id goes
 * in; the delete AND its audit trail happen atomically inside the
 * `admin_unblock_contact` security-definer function, which re-checks the
 * owner/manager role itself. The action re-checks it too (defense in depth,
 * same shape as every other admin mutation).
 */

const BLOCKLIST_ROLES = ["owner", "manager"] as const;

export type UnblockResult = { ok: true } | { ok: false; error: string };

const NOT_ALLOWED = "You are not authorized to manage the blocklist.";

export async function unblockContact(
  payload: unknown,
): Promise<UnblockResult> {
  try {
    await requireRole(BLOCKLIST_ROLES);
  } catch {
    return { ok: false, error: NOT_ALLOWED };
  }

  const parsed = unblockSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid entry id." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_unblock_contact", {
    p_id: parsed.data.id,
  });

  if (error) {
    // The RPC raises short, stable codes — translate, never show raw SQL text.
    const code = error.message.trim().split(/\s+/)[0] ?? "";
    switch (code) {
      case "not_allowed":
        return { ok: false, error: NOT_ALLOWED };
      case "block_not_found":
        return {
          ok: false,
          error: "That entry is already gone — someone unblocked it first.",
        };
      default:
        return { ok: false, error: "Could not unblock. Try again." };
    }
  }

  revalidatePath("/admin/blocked-contacts");
  return { ok: true };
}
