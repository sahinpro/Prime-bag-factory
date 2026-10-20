import { z } from "zod";

import { toAsciiDigits } from "@/lib/format";
import { PAYMENT_METHODS } from "./order-admin";

/**
 * Admin-created-order validation (plan 15.2 E3). Guards the walk-in / phone /
 * WhatsApp order form on the client AND the `createAdminOrder` server action,
 * so nothing tampered reaches the `admin_create_order` RPC. Money the RPC
 * recomputes (prices, MOQ, tiers, stock) is intentionally NOT taken as truth
 * from here — the client only sends variant ids, quantities and the optional
 * staff overrides; `admin_create_order` re-prices every line from the database.
 *
 * Discount and per-line unit-price override exist here but the RPC is the real
 * authority on who may use them (owner/manager only) — this schema only mirrors
 * the "a reason is required whenever you change a price" rule so the form and
 * the server agree before a round-trip.
 */

function emptyToUndefined(value: unknown) {
  return value === "" || value == null ? undefined : value;
}

const optionalText = (max: number, message?: string) =>
  z.preprocess(
    emptyToUndefined,
    z.string().trim().min(1, message ?? "required").max(max).optional(),
  );

const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max);

/**
 * Staff phone: Bangla digits are folded to ASCII and separators stripped (the
 * same normalisation the public checkout uses), but staff may key any number
 * they were given — landline or portable — so this is looser than the customer
 * `bdPhone`. Stored canonical so the blocklist lookup can still match it.
 */
export const staffPhone = z
  .string()
  .trim()
  .min(1, "Enter a phone number.")
  .transform((v) => toAsciiDigits(v).replace(/[\s\-()]/g, ""))
  .refine((v) => /^\+?\d{6,20}$/.test(v), { message: "Enter a valid phone." });

/** A money field with two decimals; blank means zero (discount / advance). */
const optionalMoney = z.preprocess(
  (v) => (v === "" || v == null ? 0 : v),
  z.coerce
    .number("Enter a number.")
    .min(0, "Cannot be negative.")
    .max(9_999_999_999.99)
    .transform((v) => Math.round(v * 100) / 100),
);

export const ORDER_CHANNELS = [
  "phone",
  "whatsapp",
  "facebook",
  "walk_in",
  "other",
] as const;
export type OrderChannel = (typeof ORDER_CHANNELS)[number];

export const ORDER_CHANNEL_LABELS: Record<OrderChannel, string> = {
  phone: "Phone",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  walk_in: "Walk-in",
  other: "Other",
};

/** Staff choose the starting status; `admin_create_order` accepts only these. */
export const ADMIN_INITIAL_STATUSES = ["pending", "confirmed"] as const;
export type AdminInitialStatus = (typeof ADMIN_INITIAL_STATUSES)[number];

const orderLine = z.object({
  variant_id: z.guid({ error: "Pick a product variant." }),
  qty: z.coerce
    .number("Enter a quantity.")
    .int("Enter a whole number.")
    .min(1, "At least one.")
    .max(10_000_000),
  // Owner/manager only. `null`/blank = no override (the RPC re-checks the role).
  unit_price_override: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce
      .number("Enter a number.")
      .min(0, "Cannot be negative.")
      .max(9_999_999_999.99)
      .transform((v) => Math.round(v * 100) / 100)
      .optional(),
  ),
});

export const adminCreateOrderSchema = z
  .object({
    items: z
      .array(orderLine)
      .min(1, "Add at least one item.")
      .max(50, "Too many lines."),
    customer_name: requiredText(120, "Enter the customer name."),
    customer_phone: staffPhone,
    customer_email: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .email("Enter a valid email.")
        .max(160)
        .optional(),
    ),
    division: optionalText(80),
    district: optionalText(80),
    area: optionalText(80),
    address_line: optionalText(300),
    shipping_zone_id: z.guid({ error: "Choose a shipping zone." }),
    channel: z.enum(ORDER_CHANNELS, { message: "Choose how the order came in." }),
    status: z.enum(ADMIN_INITIAL_STATUSES).default("confirmed"),
    admin_note: optionalText(4000),
    customer_note: optionalText(1000),
    discount: optionalMoney,
    reason: optionalText(500, "A reason is required."),
    override_reason: optionalText(500, "A reason is required."),
    advance_amount: optionalMoney,
    advance_method: z.enum(PAYMENT_METHODS).default("cash"),
    advance_reference: optionalText(120),
    // One key per form session so a double click replays instead of duplicating.
    idempotency_key: z.string().min(8).max(128),
  })
  .superRefine((val, ctx) => {
    if (val.discount > 0 && !val.reason) {
      ctx.addIssue({
        code: "custom",
        path: ["reason"],
        message: "A reason is required for a discount.",
      });
    }
    const hasOverride = val.items.some((i) => i.unit_price_override != null);
    if (hasOverride && !val.override_reason) {
      ctx.addIssue({
        code: "custom",
        path: ["override_reason"],
        message: "A reason is required for a price override.",
      });
    }
  });

export type AdminCreateOrderInput = z.input<typeof adminCreateOrderSchema>;
export type AdminCreateOrderData = z.infer<typeof adminCreateOrderSchema>;
