import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Plan 15.2 B4b — server-side reads for the blocklist admin page. The
 * signed-in staff session rides the cookie client, so the Phase 1
 * owner/manager/sales RLS policy on `blocked_contacts` is what actually
 * decides visibility; the page gates owner/manager on top. Mutations live in
 * `app/(admin)/admin/blocked-contacts/actions.ts`.
 */

export type BlockedContactRow = {
  id: string;
  type: "phone" | "ip_hash";
  value: string;
  reason: string | null;
  created_at: string;
  /** Display name of the staff member who created the block, if known. */
  blocked_by: string | null;
};

/**
 * Newest first — the freshest block is the one staff most often need to undo.
 * Returns null on a read failure so the page can show the kit error state
 * (plan 9c.1.4: every list ships an error state).
 */
export async function listBlockedContacts(): Promise<
  BlockedContactRow[] | null
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blocked_contacts")
    .select(
      "id, type, value, reason, created_at, created_by, profiles ( full_name )",
    )
    .order("created_at", { ascending: false });

  if (error) return null;

  return (data ?? []).map((raw) => {
    const row = raw as unknown as {
      id: string;
      type: BlockedContactRow["type"];
      value: string;
      reason: string | null;
      created_at: string;
      created_by: string | null;
      profiles: { full_name: string | null } | null;
    };
    return {
      id: row.id,
      type: row.type,
      value: row.value,
      reason: row.reason,
      created_at: row.created_at,
      blocked_by: row.profiles?.full_name ?? null,
    };
  });
}
