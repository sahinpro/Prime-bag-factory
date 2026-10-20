import { describe, expect, it } from "vitest";

import { adminCreateOrderSchema } from "@/lib/validators/admin-order";

const ZONE = "22222222-2222-4222-8222-222222222222";
const VAR = "33333333-3333-4333-8333-333333333333";

function base(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ variant_id: VAR, qty: 10 }],
    customer_name: "Rahim Uddin",
    customer_phone: "01712345678",
    shipping_zone_id: ZONE,
    channel: "phone",
    idempotency_key: "idem-12345678",
    ...overrides,
  };
}

describe("adminCreateOrderSchema", () => {
  it("applies staff defaults (confirmed, zero discount/advance, cash)", () => {
    const parsed = adminCreateOrderSchema.parse(base());
    expect(parsed.status).toBe("confirmed");
    expect(parsed.discount).toBe(0);
    expect(parsed.advance_amount).toBe(0);
    expect(parsed.advance_method).toBe("cash");
    expect(parsed.channel).toBe("phone");
  });

  it("normalises a Bangla / separated phone to canonical digits", () => {
    expect(adminCreateOrderSchema.parse(base({ customer_phone: "০১৭১২ ৩৪৫ ৬৭৮" })).customer_phone).toBe("01712345678");
    expect(adminCreateOrderSchema.parse(base({ customer_phone: "+880 1712-345678" })).customer_phone).toBe("+8801712345678");
  });

  it("rejects a phone with no usable number", () => {
    expect(
      adminCreateOrderSchema.safeParse(base({ customer_phone: "abc" })).success,
    ).toBe(false);
  });

  it("treats a blank email as absent", () => {
    expect(adminCreateOrderSchema.parse(base({ customer_email: "" })).customer_email).toBeUndefined();
  });

  it("requires at least one item", () => {
    expect(
      adminCreateOrderSchema.safeParse(base({ items: [] })).success,
    ).toBe(false);
  });

  it("requires a reason for a discount", () => {
    const missing = adminCreateOrderSchema.safeParse(base({ discount: "200" }));
    expect(missing.success).toBe(false);
    expect(missing.error?.issues.some((i) => i.path[0] === "reason")).toBe(true);

    expect(
      adminCreateOrderSchema.safeParse(
        base({ discount: "200", reason: "Loyal customer" }),
      ).success,
    ).toBe(true);
  });

  it("requires a reason for a unit-price override", () => {
    const withOverride = base({
      items: [{ variant_id: VAR, qty: 10, unit_price_override: "90" }],
    });
    expect(adminCreateOrderSchema.safeParse(withOverride).success).toBe(false);
    expect(
      adminCreateOrderSchema.safeParse({
        ...withOverride,
        override_reason: "Matched a competitor quote",
      }).success,
    ).toBe(true);
  });

  it("rejects an unknown channel, a bad zone id and a short key", () => {
    expect(
      adminCreateOrderSchema.safeParse(base({ channel: "carrier_pigeon" }))
        .success,
    ).toBe(false);
    expect(
      adminCreateOrderSchema.safeParse(base({ shipping_zone_id: "nope" }))
        .success,
    ).toBe(false);
    expect(
      adminCreateOrderSchema.safeParse(base({ idempotency_key: "x" })).success,
    ).toBe(false);
  });
});
