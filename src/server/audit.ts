import "server-only";

import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AuditEntry = {
  /** The acting staff profile id (from `requireRole()`'s returned session). */
  actorId: string;
  /** Stable, machine-readable verb, e.g. "category.create", "order.status". */
  action: string;
  /** Table the row targets, e.g. "categories". */
  tableName: string;
  /** Primary key of the affected row, when one exists. */
  recordId?: string | null;
  /**
   * What changed. Store ids, statuses, counts and field names only — never
   * customer PII (phone, email, name, address) beyond the record id (plan D1).
   */
  diff?: Record<string, unknown> | null;
};

/**
 * Append a row to `audit_logs` (plan §15 D1).
 *
 * Runs on the caller's own session (the same `createClient()` used for the
 * mutation), so the RLS "Staff can append audit logs" policy enforces
 * `actor_id = auth.uid()` and the staff role. Best-effort by design: an audit
 * hiccup must not roll back or hide an admin action that already succeeded, so
 * a failure is logged to the server console rather than thrown. Every admin
 * mutation should call this after its write; mutations routed through a
 * security-definer RPC that already writes its own audit row (E3
 * `admin_create_order`, B4b `admin_unblock_contact`) must NOT double-log here.
 */
export async function logAudit(
  supabase: SupabaseClient,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    table_name: entry.tableName,
    record_id: entry.recordId ?? null,
    // `diff` is a jsonb column typed as the recursive `Json` union; a plain
    // Record<string, unknown> is not assignable, so cast the one free-form field.
    diff: (entry.diff ?? null) as never,
  });

  if (error) {
    console.error("audit_log write failed", {
      action: entry.action,
      table_name: entry.tableName,
      record_id: entry.recordId ?? null,
      error: error.message,
    });
  }
}
