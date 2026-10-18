import { describe, expect, it } from "vitest";

import {
  bdPhone,
  checkoutSchema,
  orderLookupSchema,
  orderNo,
} from "@/lib/validators/checkout";

const GUID_A = "6f94c8a2-4b7e-4d31-9d1a-2c8e6f0a1b23";
const GUID_B = "1b23c4d5-6e7f-4a80-9b1c-2d3e4f5a6b7c";

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    items: [{ variant_id: GUID_A, qty: 120 }],
    customer_name: "Rahim Uddin",
    customer_phone: "01712345678",
    customer_email: "",
    division: "",
    district: "Dhaka",
    area: "Mirpur",
    address_line: "House 12, Road 5, Mirpur 10",
    customer_note: "",
    shipping_zone_id: GUID_B,
    idempotency_key: "web-0f2e0a4a-0f0f-4a4a-9a9a-abcdefabcdef",
    website: "",
    ...overrides,
  };
}

describe("bdPhone", () => {
  it("accepts the formats a customer actually types", () => {
    for (const raw of [
      "01712345678",
      " 01712-345678 ",
      "+8801712345678",
      "8801712345678",
      "017 1234 5678",
    ]) {
      expect(bdPhone.parse(raw)).toMatch(/^(\+?88)?01[3-9]\d{8}$/);
    }
  });

  it("converts Bangla digits before storing (plan 8: one phone format)", () => {
    expect(bdPhone.parse("০১৭১২৩৪৫৬৭৮")).toBe("01712345678");
  });

  it("rejects landlines, short numbers and wrong operators", () => {
    for (const raw of ["012345678", "0123456789", "029567890", "0112345678", "not-a-phone"]) {
      expect(bdPhone.safeParse(raw).success).toBe(false);
    }
  });

  it("keeps 01[3-9] operators only", () => {
    expect(bdPhone.safeParse("01912345678").success).toBe(true);
    expect(bdPhone.safeParse("01212345678").success).toBe(false);
  });
});

describe("orderNo", () => {
  it("upper-cases the PBF-YYMMDD-NNNN the RPC issues", () => {
    expect(orderNo.parse("pbf-251018-0007")).toBe("PBF-251018-0007");
  });

  it("rejects anything else, including an injected LIKE", () => {
    for (const raw of ["PBF-251018-007", "ORDER-1", "%", "PBF-251018-0001--", ""]) {
      expect(orderNo.safeParse(raw).success).toBe(false);
    }
  });
});

describe("checkoutSchema", () => {
  it("accepts a clean guest order and normalizes empty optionals", () => {
    const parsed = checkoutSchema.parse(basePayload());
    expect(parsed.customer_email).toBeUndefined();
    expect(parsed.division).toBeUndefined();
    expect(parsed.customer_note).toBeUndefined();
    expect(parsed.items).toHaveLength(1);
  });

  it("refuses an empty cart and money fields a tampered tab might add", () => {
    expect(checkoutSchema.safeParse(basePayload({ items: [] })).success).toBe(
      false,
    );
    const withMoney = checkoutSchema.safeParse(
      basePayload({ total: 1, unit_price: 1, shipping_fee: 0 }),
    );
    // Strip-and-reparse: the schema owns the shape, so extra keys never reach the RPC.
    expect(withMoney.success).toBe(true);
    expect(Object.keys(withMoney.data ?? {})).not.toContain("total");
  });

  it("requires a real address line and a zone", () => {
    expect(
      checkoutSchema.safeParse(basePayload({ address_line: "abc" })).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse(basePayload({ shipping_zone_id: "nope" })).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse(basePayload({ district: "  " })).success,
    ).toBe(false);
  });

  it("needs an idempotency key (place_order rejects a missing one)", () => {
    expect(
      checkoutSchema.safeParse(basePayload({ idempotency_key: "abc" })).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse(
        basePayload({ idempotency_key: "x".repeat(129) }),
      ).success,
    ).toBe(false);
  });

  it("treats a filled honeypot as an invalid submission", () => {
    expect(
      checkoutSchema.safeParse(basePayload({ website: "http://spam.example" }))
        .success,
    ).toBe(false);
  });
});

describe("orderLookupSchema", () => {
  it("requires both halves of the lookup", () => {
    expect(
      orderLookupSchema.safeParse({
        order_no: "PBF-251018-0001",
        customer_phone: "01712345678",
      }).success,
    ).toBe(true);
    expect(
      orderLookupSchema.safeParse({
        order_no: "PBF-251018-0001",
        customer_phone: "123",
      }).success,
    ).toBe(false);
  });
});
