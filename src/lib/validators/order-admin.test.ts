import { describe, expect, it } from "vitest";

import {
  ORDER_STATUSES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  orderNoteSchema,
  orderShippingSchema,
  recordPaymentSchema,
  setOrderStatusSchema,
} from "./order-admin";

/**
 * Admin order-fulfilment validators (plan Phase 5 task 3). The tests below
 * guard the three rules the fulfilment screen depends on: only a known status
 * reaches the RPC, a payment amount survives coercion as a positive 2-decimal
 * number, and an empty text field means "clear the column" rather than "".
 */

const UUID = "6f1f4c3a-2f1c-4f3a-9a1c-7f3b2c1d0e9a";

describe("setOrderStatusSchema", () => {
  it("accepts a real move and trims the history note", () => {
    const parsed = setOrderStatusSchema.parse({
      id: UUID,
      status: "confirmed",
      note: "  Called the customer.  ",
    });
    expect(parsed).toEqual({
      id: UUID,
      status: "confirmed",
      note: "Called the customer.",
    });
  });

  it("treats a blank note as no note", () => {
    expect(
      setOrderStatusSchema.parse({ id: UUID, status: "shipped", note: "   " })
        .note,
    ).toBeNull();
  });

  it("refuses an unknown status and a non-uuid id", () => {
    expect(
      setOrderStatusSchema.safeParse({ id: UUID, status: "refunded" }).success,
    ).toBe(false);
    expect(
      setOrderStatusSchema.safeParse({ id: "1", status: "paid" }).success,
    ).toBe(false);
  });

  it("covers every order_status enum value in the pipeline list", () => {
    expect([...ORDER_STATUSES].sort()).toEqual(
      [
        "cancelled",
        "confirmed",
        "delivered",
        "pending",
        "processing",
        "returned",
        "shipped",
      ].sort(),
    );
  });
});

describe("recordPaymentSchema", () => {
  it("coerces the form string and rounds to paisa", () => {
    expect(recordPaymentSchema.parse({ id: UUID, amount: "9945", method: "cod" }).amount).toBe(
      9945,
    );
    expect(
      recordPaymentSchema.parse({
        id: UUID,
        amount: "1000.567",
        method: "bkash_manual",
      }).amount,
    ).toBe(1000.57);
  });

  it("refuses zero, negative and non-numeric amounts", () => {
    for (const amount of ["0", "-500", "", "abc"]) {
      expect(
        recordPaymentSchema.safeParse({ id: UUID, amount, method: "cash" })
          .success,
      ).toBe(false);
    }
  });

  it("refuses a method outside the payment_method enum", () => {
    expect(
      recordPaymentSchema.safeParse({
        id: UUID,
        amount: "500",
        method: "western_union",
      }).success,
    ).toBe(false);
  });

  it("clears an empty reference and note", () => {
    const parsed = recordPaymentSchema.parse({
      id: UUID,
      amount: "500",
      method: "bank_transfer",
      reference: "",
      note: "  ",
    });
    expect(parsed.reference).toBeNull();
    expect(parsed.note).toBeNull();
  });

  it("labels every method the ledger can store", () => {
    for (const method of PAYMENT_METHODS) {
      expect(PAYMENT_METHOD_LABELS[method]).toBeTruthy();
    }
  });
});

describe("orderShippingSchema and orderNoteSchema", () => {
  it("trims courier details and nulls blanks", () => {
    const parsed = orderShippingSchema.parse({
      id: UUID,
      courier_name: "  SAFExpress ",
      tracking_code: "",
    });
    expect(parsed.courier_name).toBe("SAFExpress");
    expect(parsed.tracking_code).toBeNull();
  });

  it("keeps the note inside the column width", () => {
    expect(
      orderNoteSchema.safeParse({ id: UUID, admin_note: "x".repeat(4001) })
        .success,
    ).toBe(false);
    expect(orderNoteSchema.parse({ id: UUID, admin_note: "" }).admin_note).toBeNull();
  });
});
