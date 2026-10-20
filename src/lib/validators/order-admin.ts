import { z } from "zod";

/**
 * Admin order-fulfilment validation (plan §9 Orders / Phase 5 task 3). The
 * customer-side schema lives in `validators/checkout.ts`; this file covers the
 * staff mutations only: status moves, payments ledger entries, courier details
 * and the internal note. Amounts are still re-derived in Postgres
 * (`admin_record_payment` reads `total` from the row), so a tampered payload can
 * at worst over-state an entry the ledger then rejects (AGENTS rule 5/6).
 */

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
] as const;

export const PAYMENT_METHODS = [
  "cod",
  "bkash_manual",
  "nagad_manual",
  "bank_transfer",
  "cash",
] as const;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cod: "COD",
  bkash_manual: "bKash",
  nagad_manual: "Nagad",
  bank_transfer: "Bank transfer",
  cash: "Cash",
};

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const id = z.guid({ error: "Invalid order." });

/** Blank (or whitespace-only) input means "clear the column", not "" in the DB. */
function nullableText(max: number) {
  return z.preprocess((v) => {
    const trimmed = typeof v === "string" ? v.trim() : v;
    return trimmed === "" || trimmed == null ? null : trimmed;
  }, z.string().trim().max(max).nullable().default(null));
}

export const setOrderStatusSchema = z.object({
  id,
  status: z.enum(ORDER_STATUSES),
  note: nullableText(1000),
});

export const recordPaymentSchema = z.object({
  id,
  // numeric(12,2); the RPC refuses anything past the outstanding balance.
  amount: z.coerce
    .number("Enter a number.")
    .positive("Enter an amount greater than zero.")
    .max(9_999_999_999.99)
    .transform((v) => Math.round(v * 100) / 100),
  method: z.enum(PAYMENT_METHODS),
  reference: nullableText(120),
  note: nullableText(500),
});

export const orderShippingSchema = z.object({
  id,
  courier_name: nullableText(80),
  tracking_code: nullableText(80),
});

export const orderNoteSchema = z.object({
  id,
  admin_note: nullableText(4000),
});

// Plan 15.2 B4 — "Block this phone" from the order detail. Only the order id
// travels; the phone is read server-side so the client cannot poison the
// blocklist with an arbitrary value.
export const orderBlockSchema = z.object({
  id,
  reason: nullableText(500),
});

export type SetOrderStatusInput = z.input<typeof setOrderStatusSchema>;
export type RecordPaymentInput = z.input<typeof recordPaymentSchema>;
export type OrderShippingInput = z.input<typeof orderShippingSchema>;
export type OrderNoteInput = z.input<typeof orderNoteSchema>;
