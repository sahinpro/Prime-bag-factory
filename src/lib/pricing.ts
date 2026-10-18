/**
 * Pricing helpers (plan 2a + 3b): the single client/shared source of truth for
 * quantity-range prices, MOQ checks and order totals. `place_order` re-implements
 * the same rules server-side in Postgres — this module must mirror it exactly:
 * the tier is the highest `min_qty` that the *product-level* quantity reaches,
 * variant price deltas are added per unit, and totals are plain sums (BDT,
 * 2 decimals). Never trust these numbers for money — the RPC recomputes.
 */

export type PricingTier = {
  min_qty: number;
  max_qty: number | null;
  unit_price: number;
};

/**
 * The tier that applies to `qty` (mirrors the RPC's
 * `min_qty <= q and (max_qty is null or max_qty >= q) order by min_qty desc`).
 * Null when no tier covers the quantity (e.g. below the first tier's min).
 */
export function priceTierFor(
  tiers: readonly PricingTier[],
  qty: number,
): PricingTier | null {
  let best: PricingTier | null = null;
  for (const tier of tiers) {
    if (
      qty >= tier.min_qty &&
      (tier.max_qty === null || qty <= tier.max_qty) &&
      (best === null || tier.min_qty > best.min_qty)
    ) {
      best = tier;
    }
  }
  return best;
}

/** Per-unit price for one variant at the product-level quantity (delta included). */
export function unitPriceFor(
  tiers: readonly PricingTier[],
  qty: number,
  priceDelta: number,
): number | null {
  const tier = priceTierFor(tiers, qty);
  if (!tier) return null;
  return round2(tier.unit_price + priceDelta);
}

export function meetsMoq(qty: number, moq: number): boolean {
  return qty >= (moq > 0 ? moq : 1);
}

/** Free stock for a tracked variant; made-to-order is never stock-blocked. */
export function availableStock(input: {
  stockMode: "tracked" | "made_to_order";
  stockQty: number;
  reservedQty: number;
}): number | null {
  if (input.stockMode !== "tracked") return null;
  return Math.max(0, input.stockQty - input.reservedQty);
}

/** One cart or order line; quantity is priced at the product level (plan 2a). */
export type PricingLine = {
  productId: string;
  qty: number;
  priceDelta: number;
  tiers: readonly PricingTier[];
};

export type LinePricing = {
  /** Unit price after the product-level tier and the variant delta. */
  unitPrice: number | null;
  lineTotal: number;
  /** Total quantity of the same product across all lines (tier basis). */
  productQty: number;
};

/**
 * Price every line with quantity-range pricing *across the cart*: the tier for
 * a product is chosen by the sum of that product's quantities, exactly like
 * `place_order` groups items by product_id.
 */
export function priceLines(lines: readonly PricingLine[]): LinePricing[] {
  const productQty = new Map<string, number>();
  for (const line of lines) {
    productQty.set(
      line.productId,
      (productQty.get(line.productId) ?? 0) + line.qty,
    );
  }
  return lines.map((line) => {
    const total = productQty.get(line.productId) ?? line.qty;
    const unitPrice = unitPriceFor(line.tiers, total, line.priceDelta);
    return {
      unitPrice,
      lineTotal: unitPrice === null ? 0 : round2(unitPrice * line.qty),
      productQty: total,
    };
  });
}

export function subtotalOf(priced: readonly LinePricing[]): number {
  return round2(priced.reduce((sum, line) => sum + line.lineTotal, 0));
}

/** Shipping per zone rules: free at/over `freeOver`, otherwise the fee. */
export function shippingFeeFor(
  subtotal: number,
  zone: { fee: number; freeOver: number | null },
): number {
  if (zone.freeOver !== null && subtotal >= zone.freeOver) return 0;
  return round2(zone.fee);
}

/** Commerce policy 2026-10-18: 50% advance, COD balance. */
export function advanceDue(total: number): number {
  return round2(total / 2);
}

export function balanceDue(total: number): number {
  return round2(total - advanceDue(total));
}

/** Paid amount + payment status derived from the payments ledger (plan §7). */
export function paidTotal(payments: readonly number[]): number {
  return round2(payments.reduce((sum, p) => sum + p, 0));
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
