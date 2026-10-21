import { describe, expect, it } from "vitest";

import { shippingZoneInputSchema, shippingZoneUpdateSchema } from "./shipping";

/**
 * Shipping zone validators (plan 15.2 E2). They mirror the DB contract on
 * `shipping_zones` (name_en required, fee `check (fee >= 0)`, free_over nullable)
 * so bad input is refused with prose before it reaches Postgres. The authoritative
 * fee is still recomputed server-side in `place_order`; these guard the config only.
 */

const UUID = "6f1f4c3a-2f1c-4f3a-9a1c-7f3b2c1d0e9a";

describe("shippingZoneInputSchema", () => {
  it("accepts a minimal zone and defaults is_active to true", () => {
    const parsed = shippingZoneInputSchema.safeParse({
      name_en: "Dhaka Metro",
      fee: 60,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name_en).toBe("Dhaka Metro");
      expect(parsed.data.fee).toBe(60);
      expect(parsed.data.is_active).toBe(true);
      expect(parsed.data.free_over).toBeUndefined();
    }
  });

  it("requires an English name", () => {
    expect(
      shippingZoneInputSchema.safeParse({ name_en: "   ", fee: 60 }).success,
    ).toBe(false);
  });

  it("coerces a numeric string fee and rejects a negative fee", () => {
    const ok = shippingZoneInputSchema.safeParse({
      name_en: "Outside Dhaka",
      fee: "120.5",
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.fee).toBe(120.5);

    expect(
      shippingZoneInputSchema.safeParse({ name_en: "X", fee: -1 }).success,
    ).toBe(false);
  });

  it("treats an empty or null free_over as no threshold", () => {
    for (const blank of ["", null, undefined]) {
      const parsed = shippingZoneInputSchema.safeParse({
        name_en: "Zone",
        fee: 50,
        free_over: blank,
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) expect(parsed.data.free_over).toBeUndefined();
    }
  });

  it("keeps a numeric free_over threshold", () => {
    const parsed = shippingZoneInputSchema.safeParse({
      name_en: "Zone",
      fee: 50,
      free_over: 2000,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.free_over).toBe(2000);
  });

  it("trims the optional Bangla name and drops blanks", () => {
    const parsed = shippingZoneInputSchema.safeParse({
      name_en: "Zone",
      name_bn: "  ঢাকা  ",
      fee: 50,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name_bn).toBe("ঢাকা");
  });
});

describe("shippingZoneUpdateSchema", () => {
  it("requires a valid id for updates", () => {
    expect(
      shippingZoneUpdateSchema.safeParse({ id: "nope", name_en: "Z", fee: 1 })
        .success,
    ).toBe(false);

    const ok = shippingZoneUpdateSchema.safeParse({
      id: UUID,
      name_en: "Z",
      fee: 1,
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.id).toBe(UUID);
  });
});
