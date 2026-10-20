import { describe, expect, it } from "vitest";

import { builderCustomizationSchema } from "@/lib/validators/customization";

/**
 * Plan 15.2 B9 — the schema must accept what the wizard really emits and
 * reject what a tampered or mangled submission looks like. The "accepts"
 * fixture below is copied shape-for-shape from `builder-wizard.tsx`'s
 * snapshot memo; if that memo changes, this test must change with it.
 */

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    category: {
      id: "2f8e0d2c-8e0a-4a1b-9d3f-6e2a1c9b5d40",
      slug: "non-woven-bags",
      name: "Non-Woven Bags",
    },
    size: { width: "12", height: "14", gusset: "4", unit: "inch" },
    material: "Non-woven 80 gsm",
    colors: {
      primary: { name: "Royal Blue", hex: "#1e3a8a" },
      handle: null,
    },
    printing: {
      method: "Screen",
      text: "SAVE THE PLANET",
      artwork: "https://res.cloudinary.com/demo/image/upload/Primebagfactory/quotes/a.png",
    },
    quantity: "5000",
    ...overrides,
  };
}

describe("builderCustomizationSchema (B9)", () => {
  it("accepts the exact snapshot the shipped wizard produces", () => {
    const parsed = builderCustomizationSchema.safeParse(snapshot());
    expect(parsed.success).toBe(true);
  });

  it("accepts the minimal wizard output (optional steps left empty)", () => {
    const parsed = builderCustomizationSchema.safeParse(
      snapshot({
        size: { width: "12", height: "14", gusset: "", unit: "inch" },
        colors: { primary: { name: "Red", hex: null }, handle: null },
        printing: { method: "", text: "", artwork: null },
        quantity: "",
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it("rejects unknown top-level keys (no junk stored)", () => {
    expect(
      builderCustomizationSchema.safeParse(snapshot({ evil: "<script>" })).success,
    ).toBe(false);
  });

  it("rejects unknown keys nested inside a part", () => {
    expect(
      builderCustomizationSchema.safeParse(
        snapshot({
          category: { id: "x", slug: "y", name: "z", extra: 1 },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects over-long bounded fields", () => {
    expect(
      builderCustomizationSchema.safeParse(snapshot({ material: "m".repeat(121) })).success,
    ).toBe(false);
    expect(
      builderCustomizationSchema.safeParse(
        snapshot({
          printing: { method: "s", text: "t".repeat(201), artwork: null },
        }),
      ).success,
    ).toBe(false);
  });

  it("rejects missing parts and wrong primitive types", () => {
    expect(
      builderCustomizationSchema.safeParse(snapshot({ quantity: undefined }))
        .success,
    ).toBe(false);
    expect(
      builderCustomizationSchema.safeParse(snapshot({ quantity: 5000 })).success,
    ).toBe(false);
    expect(
      builderCustomizationSchema.safeParse(snapshot({ material: { en: "cotton" } }))
        .success,
    ).toBe(false);
  });

  it("rejects non-object payloads outright", () => {
    for (const junk of [null, 42, "just a string", [1, 2, 3], true]) {
      expect(builderCustomizationSchema.safeParse(junk).success).toBe(false);
    }
  });

  it("trims the values it stores", () => {
    const parsed = builderCustomizationSchema.safeParse(
      snapshot({ material: "  Cotton canvas  " }),
    );
    expect(parsed.success && parsed.data.material).toBe("Cotton canvas");
  });
});
