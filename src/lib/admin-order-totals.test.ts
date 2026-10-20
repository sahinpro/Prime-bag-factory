import { describe, expect, it } from "vitest";

import {
  computeAdminOrderTotals,
  priceAdminOrderLines,
  type AdminOrderLineInput,
} from "@/lib/admin-order-totals";
import type { PricingTier } from "@/lib/pricing";

// Tiers like the seeded products: 1–49 @ 120, 50–99 @ 100, 100+ @ 85.
const TIERS: PricingTier[] = [
  { min_qty: 1, max_qty: 49, unit_price: 120 },
  { min_qty: 50, max_qty: 99, unit_price: 100 },
  { min_qty: 100, max_qty: null, unit_price: 85 },
];

const P = "11111111-1111-4111-8111-111111111111";
const V1 = "aaaaaaaa-0000-4000-8000-000000000001";
const V2 = "aaaaaaaa-0000-4000-8000-000000000002";

function line(
  overrides: Partial<AdminOrderLineInput> & { variantId: string },
): AdminOrderLineInput {
  return {
    productId: P,
    qty: 10,
    priceDelta: 0,
    tiers: TIERS,
    ...overrides,
  };
}

describe("priceAdminOrderLines", () => {
  it("prices by the product-level quantity, not per line", () => {
    // Two variants of one product: 30 + 25 = 55 reaches the 50+ tier.
    const priced = priceAdminOrderLines([
      line({ variantId: V1, qty: 30 }),
      line({ variantId: V2, qty: 25 }),
    ]);
    expect(priced[0].productQty).toBe(55);
    expect(priced[0].tierUnitPrice).toBe(100);
    expect(priced[0].lineTotal).toBe(3000);
    expect(priced[1].lineTotal).toBe(2500);
  });

  it("adds the variant price delta per unit", () => {
    const priced = priceAdminOrderLines([
      line({ variantId: V1, qty: 10, priceDelta: 15 }),
    ]);
    expect(priced[0].tierUnitPrice).toBe(135); // 120 + 15 (tier 1–49)
  });

  it("a unit-price override wins over the tier price and the delta", () => {
    const priced = priceAdminOrderLines([
      line({ variantId: V1, qty: 10, priceDelta: 15, unitPriceOverride: 90 }),
    ]);
    expect(priced[0].tierUnitPrice).toBe(135);
    expect(priced[0].unitPrice).toBe(90);
    expect(priced[0].overridden).toBe(true);
    expect(priced[0].lineTotal).toBe(900);
  });

  it("prices a line with no covering tier to zero", () => {
    const priced = priceAdminOrderLines([
      { productId: P, variantId: V1, qty: 5, priceDelta: 0, tiers: [] },
    ]);
    expect(priced[0].unitPrice).toBeNull();
    expect(priced[0].lineTotal).toBe(0);
  });
});

describe("computeAdminOrderTotals", () => {
  it("sums subtotal, applies the flat zone fee and the discount", () => {
    const totals = computeAdminOrderTotals({
      lines: [line({ variantId: V1, qty: 10 })], // 10 × 120 = 1200
      zone: { fee: 50, freeOver: 5000 },
      discount: 200,
    });
    expect(totals.subtotal).toBe(1200);
    expect(totals.shippingFee).toBe(50);
    expect(totals.discount).toBe(200);
    expect(totals.total).toBe(1050); // 1200 - 200 + 50
  });

  it("drops the fee at or over freeOver", () => {
    const totals = computeAdminOrderTotals({
      lines: [line({ variantId: V1, qty: 50 })], // 50 × 100 = 5000
      zone: { fee: 50, freeOver: 5000 },
      discount: 0,
    });
    expect(totals.subtotal).toBe(5000);
    expect(totals.shippingFee).toBe(0);
  });

  it("ignores a negative or blank discount and a missing zone", () => {
    const totals = computeAdminOrderTotals({
      lines: [line({ variantId: V1, qty: 10 })],
      zone: null,
      discount: -5,
    });
    expect(totals.discount).toBe(0);
    expect(totals.shippingFee).toBe(0);
    expect(totals.total).toBe(1200);
  });
});
