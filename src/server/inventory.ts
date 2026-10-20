import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Plan §9 "Inventory" / 15.2 E1 — the variant stock ledger.
 *
 * Reads go through the staff cookie client so Phase 1 RLS decides visibility
 * (owner / manager / inventory can read variants and movements; the page shell
 * re-checks the role only to render the header). `available` is always derived
 * as `stock_qty - reserved_qty`, never stored. `stock_qty` itself is only ever
 * changed through `admin_adjust_stock` (a movement + the delta in one
 * transaction) — this module never writes stock.
 */

export type StockStatus = "ok" | "low" | "out" | "untracked";

export type InventoryRow = {
  variant_id: string;
  product_id: string;
  sku: string;
  product_title: string;
  stock_mode: string;
  color_name: string | null;
  color_hex: string | null;
  size: string | null;
  is_active: boolean;
  stock_qty: number;
  reserved_qty: number;
  available: number;
  low_stock_threshold: number;
  status: StockStatus;
};

export type MovementRow = {
  id: string;
  delta: number;
  reason: string;
  ref_type: string | null;
  ref_id: string | null;
  note: string | null;
  created_at: string;
  actor: string | null;
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function statusFor(
  stockMode: string,
  available: number,
  threshold: number,
): StockStatus {
  if (stockMode !== "tracked") return "untracked";
  if (available <= 0) return "out";
  if (threshold > 0 && available <= threshold) return "low";
  return "ok";
}

/**
 * Every variant with its derived stock position, newest product title first.
 * Returns null when the read fails so the page shows the kit error state.
 */
export async function listInventory(): Promise<InventoryRow[] | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, product_id, sku, color_name, color_hex, size, stock_qty, reserved_qty, low_stock_threshold, is_active, product:products(title_en, stock_mode)",
    )
    .order("sku", { ascending: true });

  if (error) return null;

  const rows: InventoryRow[] = (data ?? []).map((raw) => {
    const row = raw as unknown as Record<string, unknown>;
    const product = row.product as
      | { title_en?: string; stock_mode?: string }
      | { title_en?: string; stock_mode?: string }[]
      | undefined;
    const joined = Array.isArray(product) ? product[0] : product;
    const stockMode = String(joined?.stock_mode ?? "tracked");
    const stockQty = num(row.stock_qty);
    const reservedQty = num(row.reserved_qty);
    const threshold = num(row.low_stock_threshold);
    const available = stockQty - reservedQty;
    return {
      variant_id: String(row.id),
      product_id: String(row.product_id),
      sku: String(row.sku ?? ""),
      product_title: String(joined?.title_en ?? ""),
      stock_mode: stockMode,
      color_name: row.color_name == null ? null : String(row.color_name),
      color_hex: row.color_hex == null ? null : String(row.color_hex),
      size: row.size == null ? null : String(row.size),
      is_active: Boolean(row.is_active),
      stock_qty: stockQty,
      reserved_qty: reservedQty,
      available,
      low_stock_threshold: threshold,
      status: statusFor(stockMode, available, threshold),
    };
  });

  return rows;
}

/**
 * The movement ledger for one variant, newest first. The drawer fetches this on
 * demand rather than loading every variant's history with the list — movements
 * accumulate over time and only the selected variant's trail is shown.
 */
export async function listMovements(
  variantId: string,
): Promise<MovementRow[] | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("inventory_movements")
    .select(
      "id, delta, reason, ref_type, ref_id, note, created_at, actor:profiles(full_name)",
    )
    .eq("variant_id", variantId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) return null;

  return (data ?? []).map((raw) => {
    const row = raw as unknown as Record<string, unknown>;
    const actor = row.actor as
      | { full_name?: string | null }
      | { full_name?: string | null }[]
      | null
      | undefined;
    const joined = Array.isArray(actor) ? actor[0] : actor;
    return {
      id: String(row.id),
      delta: num(row.delta),
      reason: String(row.reason ?? ""),
      ref_type: row.ref_type == null ? null : String(row.ref_type),
      ref_id: row.ref_id == null ? null : String(row.ref_id),
      note: row.note == null ? null : String(row.note),
      created_at: String(row.created_at ?? ""),
      actor: joined?.full_name ? String(joined.full_name) : null,
    };
  });
}
