import "server-only";

import type { PricingTier } from "@/lib/pricing";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * Cart line hydration (plan Phase 5 task 1): the client store keeps only
 * {variantId, qty}; the cart and checkout screens re-read every commercial
 * number (price tiers, MOQ, stock, publish state) from the DB here, so a
 * stale localStorage cart can never show or submit old prices. Deliberately
 * NOT unstable_cached — cart reads are per-visitor and dynamic (plan 3b).
 */

export type CartLine = {
  variantId: string;
  productId: string;
  slug: string;
  titleEn: string;
  titleBn: string | null;
  sku: string;
  color: string | null;
  hex: string | null;
  size: string | null;
  priceDelta: number;
  stockMode: "tracked" | "made_to_order";
  productType: "buy_now" | "quote_only";
  moq: number;
  /** stock_qty - reserved_qty for tracked products, null for made-to-order. */
  available: number | null;
  image: string | null;
  tiers: PricingTier[];
};

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

type VariantNode = {
  id: string;
  sku: string;
  color_name: string | null;
  color_hex: string | null;
  size: string | null;
  price_delta: unknown;
  stock_qty: unknown;
  reserved_qty: unknown;
  is_active: boolean;
  products: {
    id: string;
    slug: string;
    title_en: string;
    title_bn: string | null;
    type: "buy_now" | "quote_only";
    moq: unknown;
    stock_mode: "tracked" | "made_to_order";
    status: string;
    product_images: { path: string; sort_order: unknown }[] | null;
    price_tiers:
      | {
          min_qty: unknown;
          max_qty: unknown;
          unit_price: unknown;
        }[]
      | null;
  } | null;
};

/**
 * Resolve variant ids to lines. Ids that are unknown, inactive, or belong to
 * an unpublished product are reported back in `missing` so the cart UI can
 * offer to drop them.
 */
export async function loadCartLines(
  variantIds: string[],
): Promise<{ lines: CartLine[]; missing: string[] }> {
  const unique = [...new Set(variantIds)].slice(0, 50);
  if (unique.length === 0) return { lines: [], missing: [] };

  const supabase = createPublicClient();
  // Non-literal select string → rows degrade to unknown; normalized by hand.
  const { data, error } = await supabase
    .from("product_variants")
    .select(
      "id, sku, color_name, color_hex, size, price_delta, stock_qty, reserved_qty, is_active, products ( id, slug, title_en, title_bn, type, moq, stock_mode, status, product_images ( path, sort_order ), price_tiers ( min_qty, max_qty, unit_price ) )",
    )
    .in("id", unique);
  if (error) {
    throw new Error("Failed to load the cart.", { cause: error });
  }

  const rows = (data ?? []) as unknown as VariantNode[];
  const byId = new Map(rows.map((r) => [r.id, r]));

  const lines: CartLine[] = [];
  const missing: string[] = [];
  for (const id of unique) {
    const row = byId.get(id);
    const product = row?.products ?? null;
    if (!row || !row.is_active || !product || product.status !== "published") {
      missing.push(id);
      continue;
    }
    const stockQty = num(row.stock_qty);
    const reservedQty = num(row.reserved_qty);
    const images = (product.product_images ?? [])
      .slice()
      .sort((a, b) => num(a.sort_order) - num(b.sort_order));
    lines.push({
      variantId: row.id,
      productId: product.id,
      slug: product.slug,
      titleEn: product.title_en,
      titleBn: product.title_bn,
      sku: row.sku,
      color: row.color_name,
      hex: row.color_hex,
      size: row.size,
      priceDelta: num(row.price_delta),
      stockMode: product.stock_mode,
      productType: product.type,
      moq: num(product.moq),
      available:
        product.stock_mode === "tracked"
          ? Math.max(0, stockQty - reservedQty)
          : null,
      image: images[0]?.path ?? null,
      tiers: (product.price_tiers ?? [])
        .map((t) => ({
          min_qty: num(t.min_qty),
          max_qty: t.max_qty == null ? null : num(t.max_qty),
          unit_price: num(t.unit_price),
        }))
        .sort((a, b) => a.min_qty - b.min_qty),
    });
  }

  return { lines, missing };
}
