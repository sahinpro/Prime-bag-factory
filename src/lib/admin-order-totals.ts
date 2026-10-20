import { priceTierFor, round2, type PricingTier } from "@/lib/pricing";

/**
 * Live totals for the admin-created-order form (plan 15.2 E3). This mirrors the
 * pricing rules in `lib/pricing.ts` (and, behind them, `create_order_core`) so
 * staff see the same numbers the RPC will recompute — but it is a PREVIEW only.
 * `admin_create_order` re-prices every line from the database and is the sole
 * authority on money; nothing here is trusted (AGENTS rule: never trust prices
 * or totals from the client).
 *
 * The one addition over the retail cart is the staff `unit_price_override`: an
 * owner/manager may force a per-line unit price, which wins over the tier price
 * and the variant delta, exactly as the RPC does.
 */

export type AdminOrderLineInput = {
  productId: string;
  variantId: string;
  qty: number;
  /** Variant-level per-unit add-on (`product_variants.price_delta`). */
  priceDelta: number;
  /** The product's quantity-range tiers (`price_tiers`). */
  tiers: readonly PricingTier[];
  /** Owner/manager forced unit price; null/undefined = use the tier price. */
  unitPriceOverride?: number | null;
};

export type AdminOrderZone = { fee: number; freeOver: number | null };

export type AdminOrderPricedLine = {
  variantId: string;
  /** Total quantity of the same product across lines (the tier basis). */
  productQty: number;
  /** Tier unit price + delta, before any override (null when no tier covers qty). */
  tierUnitPrice: number | null;
  /** Unit price actually used: the override when present, else the tier price. */
  unitPrice: number | null;
  lineTotal: number;
  overridden: boolean;
};

export type AdminOrderTotals = {
  lines: AdminOrderPricedLine[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
};

/**
 * Price each line the way `create_order_core` does: the tier is chosen by the
 * product-level quantity (all lines of one product share the tier), the variant
 * delta is added per unit, and an override replaces the whole per-unit figure.
 */
export function priceAdminOrderLines(
  lines: readonly AdminOrderLineInput[],
): AdminOrderPricedLine[] {
  const productQty = new Map<string, number>();
  for (const line of lines) {
    productQty.set(
      line.productId,
      (productQty.get(line.productId) ?? 0) + line.qty,
    );
  }

  return lines.map((line) => {
    const total = productQty.get(line.productId) ?? line.qty;
    const tier = priceTierFor(line.tiers, total);
    const tierUnitPrice =
      tier === null ? null : round2(tier.unit_price + line.priceDelta);
    const hasOverride =
      line.unitPriceOverride != null && Number.isFinite(line.unitPriceOverride);
    const unitPrice = hasOverride
      ? round2(line.unitPriceOverride as number)
      : tierUnitPrice;
    return {
      variantId: line.variantId,
      productQty: total,
      tierUnitPrice,
      unitPrice,
      lineTotal: unitPrice === null ? 0 : round2(unitPrice * line.qty),
      overridden: hasOverride,
    };
  });
}

/**
 * Full preview totals. `discount` is applied to the subtotal and the zone fee
 * follows the subtotal (free at/over `freeOver`, else the flat fee) — the same
 * order `create_order_core` uses. A line with no covering tier prices to 0 so
 * the form can flag "no price tier" instead of showing a bogus total.
 */
export function computeAdminOrderTotals(input: {
  lines: readonly AdminOrderLineInput[];
  zone: AdminOrderZone | null;
  discount: number;
}): AdminOrderTotals {
  const lines = priceAdminOrderLines(input.lines);
  const subtotal = round2(lines.reduce((sum, line) => sum + line.lineTotal, 0));

  const discount = round2(Math.max(0, input.discount || 0));
  const zone = input.zone;
  const shippingFee = zone
    ? zone.freeOver !== null && subtotal >= zone.freeOver
      ? 0
      : round2(zone.fee)
    : 0;

  return {
    lines,
    subtotal,
    shippingFee,
    discount,
    total: round2(subtotal - discount + shippingFee),
  };
}
