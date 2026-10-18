import { z } from "zod";

import { toAsciiDigits } from "@/lib/format";

/**
 * Public checkout validation (plan 8 "Cart and checkout (COD)"): guest order
 * with a Bangladeshi mobile number. The identical schema guards the client form
 * and the server action, so nothing tampered reaches `place_order`.
 *
 * Money is deliberately absent: prices, shipping and totals are computed by the
 * RPC from the database (AGENTS: never trust prices or totals from the client).
 * `website` is the honeypot — a real human never fills it (plan 8 spam guard).
 */

function emptyToUndefined(value: unknown) {
  return value === "" || value == null ? undefined : value;
}

const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().min(1).max(max).optional());

const requiredText = (max: number) =>
  z.string().trim().min(1, "required").max(max);

/**
 * Canonical BD mobile: optional +88 country code, then 01[3-9] and 8 more
 * digits (plan 8 regex). Spaces and dashes are stripped first and the cleaned
 * value is what we store, so staff search orders by one phone format.
 */
export const bdPhone = z
  .string()
  .trim()
  .min(1, "required")
  .transform((v) => toAsciiDigits(v).replace(/[\s\-()]/g, ""))
  .refine((v) => /^(?:\+?88)?01[3-9]\d{8}$/.test(v), {
    message: "errBdPhone",
  });

/** `place_order` issues PBF-YYMMDD-NNNN; accept it case-insensitively. */
export const orderNo = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^PBF-\d{6}-\d{4}$/.test(v), { message: "errOrderNo" });

export const checkoutSchema = z.object({
  items: z
    .array(
      z.object({
        variant_id: z.guid(),
        qty: z.coerce.number().int().min(1).max(10_000_000),
      }),
    )
    .min(1, "errEmptyCart")
    .max(50),
  customer_name: requiredText(120),
  customer_phone: bdPhone,
  customer_email: z.preprocess(
    emptyToUndefined,
    z.string().trim().email().max(160).optional(),
  ),
  // Division is optional (customers rarely know it); district, area and the
  // street line are what the courier actually needs.
  division: optionalText(80),
  district: requiredText(80),
  area: requiredText(80),
  address_line: z.string().trim().min(5).max(300),
  customer_note: optionalText(1000),
  shipping_zone_id: z.guid(),
  // Generated once per browser submission attempt (uuid + timestamp) and stored
  // by `place_order` in `orders.idempotency_key` — a double click or a retry
  // after a network failure replays the same order instead of creating two.
  idempotency_key: z.string().min(8).max(128),
  website: z
    .string()
    .max(0, "spam")
    .optional()
    .transform((v) => v ?? ""),
});

export const orderLookupSchema = z.object({
  order_no: orderNo,
  customer_phone: bdPhone,
});

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.infer<typeof checkoutSchema>;
export type OrderLookupData = z.infer<typeof orderLookupSchema>;
