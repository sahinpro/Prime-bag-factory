import { describe, expect, it } from "vitest";

import {
  advanceDue,
  availableStock,
  balanceDue,
  meetsMoq,
  paidTotal,
  priceLines,
  priceTierFor,
  shippingFeeFor,
  subtotalOf,
  unitPriceFor,
  type PricingTier,
} from "@/lib/pricing";

// Tiers like the seeded products: 1–49 @ 120, 50–99 @ 100, 100+ @ 85.
const TIERS: PricingTier[] = [
  { min_qty: 1, max_qty: 49, unit_price: 120 },
  { min_qty: 50, max_qty: 99, unit_price: 100 },
  { min_qty: 100, max_qty: null, unit_price: 85 },
];

describe("priceTierFor", () => {
  it("respects tier boundaries 49/50 and 99/100 (plan: test 50/51)", () => {
    expect(priceTierFor(TIERS, 49)?.unit_price).toBe(120);
    expect(priceTierFor(TIERS, 50)?.unit_price).toBe(100);
    expect(priceTierFor(TIERS, 51)?.unit_price).toBe(100);
    expect(priceTierFor(TIERS, 99)?.unit_price).toBe(100);
    expect(priceTierFor(TIERS, 100)?.unit_price).toBe(85);
  });

  it("returns null below the first tier", () => {
    const openOnly: PricingTier[] = [
      { min_qty: 10, max_qty: null, unit_price: 50 },
    ];
    expect(priceTierFor(openOnly, 5)).toBeNull();
  });

  it("picks the highest reached min when tiers are unbounded", () => {
    const mins: PricingTier[] = [
      { min_qty: 1, max_qty: null, unit_price: 120 },
      { min_qty: 50, max_qty: null, unit_price: 100 },
    ];
    expect(priceTierFor(mins, 60)?.unit_price).toBe(100);
  });
});

describe("unitPriceFor", () => {
  it("adds the variant price delta to the tier price", () => {
    expect(unitPriceFor(TIERS, 60, 15)).toBe(115);
    expect(unitPriceFor(TIERS, 60, -5)).toBe(95);
  });

  it("is null when no tier covers the quantity", () => {
    expect(unitPriceFor([], 10, 0)).toBeNull();
  });
});

describe("MOQ and stock", () => {
  it("blocks quantities below MOQ and treats moq<1 as 1", () => {
    expect(meetsMoq(49, 50)).toBe(false);
    expect(meetsMoq(50, 50)).toBe(true);
    expect(meetsMoq(1, 0)).toBe(true);
  });

  it("computes free stock for tracked and null for made-to-order", () => {
    expect(
      availableStock({
        stockMode: "tracked",
        stockQty: 30,
        reservedQty: 12,
      }),
    ).toBe(18);
    expect(
      availableStock({ stockMode: "tracked", stockQty: 5, reservedQty: 9 }),
    ).toBe(0);
    expect(
      availableStock({
        stockMode: "made_to_order",
        stockQty: 0,
        reservedQty: 0,
      }),
    ).toBeNull();
  });
});

describe("priceLines (quantity-range pricing across the cart)", () => {
  it("prices two variants of one product at the combined quantity", () => {
    const priced = priceLines([
      { productId: "p1", qty: 30, priceDelta: 0, tiers: TIERS },
      { productId: "p1", qty: 25, priceDelta: 10, tiers: TIERS },
    ]);
    // product qty 55 → tier 100; blue 100, green 110.
    expect(priced[0]).toEqual({ unitPrice: 100, lineTotal: 3000, productQty: 55 });
    expect(priced[1]).toEqual({ unitPrice: 110, lineTotal: 2750, productQty: 55 });
    expect(subtotalOf(priced)).toBe(5750);
  });

  it("keeps products independent", () => {
    const priced = priceLines([
      { productId: "p1", qty: 60, priceDelta: 0, tiers: TIERS },
      { productId: "p2", qty: 10, priceDelta: 0, tiers: TIERS },
    ]);
    expect(priced[0]?.unitPrice).toBe(100);
    expect(priced[1]?.unitPrice).toBe(120);
  });
});

describe("shipping, advance and ledger", () => {
  it("waives the fee at or over free_over", () => {
    expect(shippingFeeFor(999, { fee: 80, freeOver: 1000 })).toBe(80);
    expect(shippingFeeFor(1000, { fee: 80, freeOver: 1000 })).toBe(0);
    expect(shippingFeeFor(10, { fee: 80, freeOver: null })).toBe(80);
  });

  it("splits COD orders 50/50 (commerce policy 2026-10-18)", () => {
    expect(advanceDue(5830)).toBe(2915);
    expect(balanceDue(5830)).toBe(2915);
    expect(advanceDue(101)).toBe(50.5);
    expect(balanceDue(101)).toBe(50.5);
  });

  it("sums the payments ledger with 2-decimal rounding", () => {
    expect(paidTotal([100.005, 200.01, 50])).toBe(350.02);
    expect(paidTotal([])).toBe(0);
  });
});
