import "server-only";

import type { PricingTier } from "@/lib/pricing";
import { createClient } from "@/lib/supabase/server";
import { isBlocked, normalizePhone } from "@/server/abuse";
import { listShippingZones, type ShippingZone } from "@/server/checkout";

/**
 * Support reads for the admin-created-order form (plan 15.2 E3). These feed the
 * searchable variant picker and the live price preview. They are READS only —
 * `admin_create_order` re-checks MOQ, stock, tiers and the buy-now rule in
 * Postgres, so a stale or tampered picker never sets money (AGENTS: never trust
 * prices/stock from the client).
 */

export type OrderableVariant = {
  variantId: string;
  productId: string;
  productTitle: string;
  moq: number;
  stockMode: "tracked" | "made_to_order";
  sku: string;
  colorName: string | null;
  size: string | null;
  priceDelta: number;
  stockQty: number;
  reservedQty: number;
  /** stock_qty - reserved_qty for tracked variants; null for made-to-order. */
  available: number | null;
  tiers: PricingTier[];
};

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Every orderable variant: a published `buy_now` product with an active
 * variant, ordered by product title then sku. Builder/custom products are
 * excluded here exactly as `create_order_core` rejects them (`Only buy-now
 * products can be checked out`) — those come through quotes (F1), not this form.
 * Returns null on a read failure so the page shows the kit error state.
 */
export async function listOrderableVariants(): Promise<
  OrderableVariant[] | null
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, title_en, moq, stock_mode, type, status, product_variants ( id, sku, color_name, size, price_delta, stock_qty, reserved_qty, is_active ), price_tiers ( min_qty, max_qty, unit_price )",
    )
    .eq("status", "published")
    .eq("type", "buy_now")
    .order("title_en", { ascending: true });
  if (error) return null;

  const variants: OrderableVariant[] = [];
  for (const raw of (data ?? []) as unknown as Record<string, unknown>[]) {
    const productId = String(raw.id);
    const productTitle = String(raw.title_en ?? "");
    const moq = num(raw.moq);
    const stockMode = String(raw.stock_mode ?? "tracked") as
      | "tracked"
      | "made_to_order";
    const tiers: PricingTier[] = (
      (raw.price_tiers as Record<string, unknown>[]) ?? []
    )
      .map((t) => ({
        min_qty: num(t.min_qty),
        max_qty: t.max_qty == null ? null : num(t.max_qty),
        unit_price: num(t.unit_price),
      }))
      .sort((a, b) => a.min_qty - b.min_qty);

    for (const v of (raw.product_variants as Record<string, unknown>[]) ?? []) {
      if (!v.is_active) continue;
      const stockQty = num(v.stock_qty);
      const reservedQty = num(v.reserved_qty);
      variants.push({
        variantId: String(v.id),
        productId,
        productTitle,
        moq,
        stockMode,
        sku: String(v.sku ?? ""),
        colorName: str(v.color_name),
        size: str(v.size),
        priceDelta: num(v.price_delta),
        stockQty,
        reservedQty,
        available:
          stockMode === "tracked" ? Math.max(0, stockQty - reservedQty) : null,
        tiers,
      });
    }
  }

  return variants.sort(
    (a, b) =>
      a.productTitle.localeCompare(b.productTitle) ||
      a.sku.localeCompare(b.sku),
  );
}

/** Active shipping zones for the fee preview — the same list the customer sees. */
export function listAdminOrderZones(): Promise<ShippingZone[]> {
  return listShippingZones();
}

/**
 * Warn-only helper for the form: is this phone on the staff blocklist? An
 * admin order is always creatable for any phone (a walk-in must not be turned
 * away), so this never blocks the RPC — it only surfaces the amber notice the
 * task calls for. Fails open (false) like the rest of `abuse.ts`.
 */
export async function phoneIsBlocked(raw: string): Promise<boolean> {
  const value = normalizePhone(raw);
  if (value === "") return false;
  return isBlocked("phone", value);
}
