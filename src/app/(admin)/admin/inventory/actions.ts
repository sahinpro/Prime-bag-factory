"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { requireRole } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { createClient } from "@/lib/supabase/server";
import {
  adjustStockSchema,
  setThresholdSchema,
} from "@/lib/validators/inventory";
import { logAudit } from "@/server/audit";
import { listMovements, type MovementRow } from "@/server/inventory";

/**
 * Admin inventory mutations (plan §9 Inventory / 15.2 E1). Same shape as the
 * order actions: requireRole → zod → write → revalidate. A stock adjustment is
 * never a direct `stock_qty` update — it goes through the `admin_adjust_stock`
 * security-definer RPC so the movement row and the delta commit together and the
 * ledger stays the source of truth. The low-stock threshold is ordinary variant
 * metadata (not stock), so it stays a direct write under the staff RLS policy.
 */

const INVENTORY_ROLES = ["owner", "manager", "inventory"] as const;

export type InventoryActionResult = { ok: true } | { ok: false; error: string };

const NOT_ALLOWED = "You are not authorized to manage inventory.";

function denied(): InventoryActionResult {
  return { ok: false, error: NOT_ALLOWED };
}

/** Translate the RPC's short, stable codes into staff prose. */
function adjustError(message: string): string {
  const code = message.trim().split(/\s+/)[0] ?? "";
  switch (code) {
    case "not_allowed":
      return NOT_ALLOWED;
    case "invalid_reason":
      return "That reason cannot be recorded by hand.";
    case "invalid_delta":
      return "Enter a quantity other than zero.";
    case "note_required":
      return "A note is required for every adjustment.";
    case "variant_not_found":
      return "This variant no longer exists.";
    case "insufficient_stock":
      return "That would take stock below zero. There is not enough on hand.";
    default:
      if (message.includes("admin_adjust_stock")) {
        return "The inventory database function is missing. Apply supabase/migrations/202610200004_e1_inventory_adjust.sql first.";
      }
      return "Could not adjust the stock.";
  }
}

export async function adjustStock(
  payload: unknown,
): Promise<InventoryActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(INVENTORY_ROLES)).id;
  } catch {
    return denied();
  }
  const parsed = adjustStockSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "The adjustment is not valid.",
    };
  }
  const { variantId, delta, reason, note } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_adjust_stock", {
    p_variant_id: variantId,
    p_delta: delta,
    p_reason: reason,
    p_note: note,
  });
  if (error) return { ok: false, error: adjustError(error.message) };

  // The RPC writes the inventory movement row but not the audit trail, so record
  // the staff action here. reason + delta only (the free-text note can be long).
  await logAudit(supabase, {
    actorId,
    action: "inventory.adjust",
    tableName: "product_variants",
    recordId: variantId,
    diff: { delta, reason },
  });

  revalidatePath("/admin/inventory");
  revalidateTag(CACHE_TAGS.catalog, "max");
  revalidateTag(CACHE_TAGS.adminCounts, "max");
  return { ok: true };
}

export async function setThreshold(
  payload: unknown,
): Promise<InventoryActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(INVENTORY_ROLES)).id;
  } catch {
    return denied();
  }
  const parsed = setThresholdSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "The threshold is not valid.",
    };
  }
  const { variantId, threshold } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .update({ low_stock_threshold: threshold })
    .eq("id", variantId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "Could not save the threshold." };
  if (!data) return { ok: false, error: "This variant no longer exists." };

  await logAudit(supabase, {
    actorId,
    action: "inventory.threshold",
    tableName: "product_variants",
    recordId: variantId,
    diff: { low_stock_threshold: threshold },
  });

  revalidatePath("/admin/inventory");
  revalidateTag(CACHE_TAGS.catalog, "max");
  revalidateTag(CACHE_TAGS.adminCounts, "max");
  return { ok: true };
}

/** Read one variant's ledger for the drawer. null = the read failed. */
export async function getMovements(
  variantId: string,
): Promise<{ rows: MovementRow[] | null }> {
  try {
    await requireRole(INVENTORY_ROLES);
  } catch {
    return { rows: null };
  }
  if (!isUuid(variantId)) return { rows: null };
  return { rows: await listMovements(variantId) };
}

// Cheap guard so a malformed id never reaches a `.eq("variant_id", …)` uuid cast.
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}
