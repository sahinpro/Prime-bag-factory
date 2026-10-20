import { describe, expect, it } from "vitest";

import {
  adjustStockSchema,
  MANUAL_MOVEMENT_REASONS,
  setThresholdSchema,
} from "./inventory";

/**
 * Inventory validators (plan 15.2 E1). These guard the three rules the adjust
 * dialog depends on: only the manual reasons are accepted (never the
 * order-driven `sale` / `cancel_release`), a delta is a non-zero whole number,
 * and the note is mandatory — the same contract `admin_adjust_stock` enforces
 * in Postgres.
 */

const UUID = "6f1f4c3a-2f1c-4f3a-9a1c-7f3b2c1d0e9a";

describe("adjustStockSchema", () => {
  it("accepts a signed adjustment and trims the note", () => {
    const parsed = adjustStockSchema.parse({
      variantId: UUID,
      delta: "-12",
      reason: "damage",
      note: "  Water damage in transit  ",
    });
    expect(parsed).toEqual({
      variantId: UUID,
      delta: -12,
      reason: "damage",
      note: "Water damage in transit",
    });
  });

  it("rejects a zero delta", () => {
    expect(
      adjustStockSchema.safeParse({
        variantId: UUID,
        delta: 0,
        reason: "adjustment",
        note: "count",
      }).success,
    ).toBe(false);
  });

  it("rejects a fractional delta", () => {
    expect(
      adjustStockSchema.safeParse({
        variantId: UUID,
        delta: 2.5,
        reason: "purchase",
        note: "restock",
      }).success,
    ).toBe(false);
  });

  it("requires a non-blank note", () => {
    expect(
      adjustStockSchema.safeParse({
        variantId: UUID,
        delta: 5,
        reason: "purchase",
        note: "   ",
      }).success,
    ).toBe(false);
  });

  it("refuses the order-driven reasons", () => {
    expect(MANUAL_MOVEMENT_REASONS).not.toContain("sale");
    expect(MANUAL_MOVEMENT_REASONS).not.toContain("cancel_release");
    for (const reason of ["sale", "cancel_release"]) {
      expect(
        adjustStockSchema.safeParse({
          variantId: UUID,
          delta: 1,
          reason,
          note: "nope",
        }).success,
      ).toBe(false);
    }
  });

  it("rejects a non-guid variant id", () => {
    expect(
      adjustStockSchema.safeParse({
        variantId: "not-a-uuid",
        delta: 1,
        reason: "purchase",
        note: "ok",
      }).success,
    ).toBe(false);
  });
});

describe("setThresholdSchema", () => {
  it("coerces a whole-number threshold", () => {
    expect(
      setThresholdSchema.parse({ variantId: UUID, threshold: "10" }).threshold,
    ).toBe(10);
  });

  it("rejects a negative threshold", () => {
    expect(
      setThresholdSchema.safeParse({
        variantId: UUID,
        threshold: -1,
      }).success,
    ).toBe(false);
  });
});
