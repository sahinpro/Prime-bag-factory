import { z } from "zod";

/**
 * Inventory validation (plan §9 Inventory / 15.2 E1). The ledger itself is
 * enforced in Postgres (`admin_adjust_stock` re-checks the role, the reason and
 * the note, and clamps `stock_qty` so it can never go negative) — this schema is
 * the friendly, client-and-server-first gate. Only the manual reasons are
 * offered: `sale` and `cancel_release` are written by the order fulfilment RPCs,
 * never by hand.
 */

export const MANUAL_MOVEMENT_REASONS = [
  "opening",
  "purchase",
  "return",
  "adjustment",
  "damage",
] as const;

export type ManualMovementReason = (typeof MANUAL_MOVEMENT_REASONS)[number];

export const MOVEMENT_REASON_LABELS: Record<ManualMovementReason, string> = {
  opening: "Opening balance",
  purchase: "Purchase / restock",
  return: "Customer return",
  adjustment: "Adjustment (count correction)",
  damage: "Damage / write-off",
};

const variantId = z.guid({ error: "Invalid variant." });

export const adjustStockSchema = z.object({
  variantId,
  // A signed integer count; the RPC rejects a zero delta and any result below 0.
  delta: z.coerce
    .number("Enter a whole number.")
    .int("Enter a whole number.")
    .refine((v) => v !== 0, "Enter a quantity other than zero.")
    .refine(
      (v) => v >= -1_000_000 && v <= 1_000_000,
      "That adjustment is too large.",
    ),
  reason: z.enum(MANUAL_MOVEMENT_REASONS),
  // Required, human "why" — mirrored by the RPC's `note_required` guard.
  note: z
    .string()
    .trim()
    .min(1, "A note is required.")
    .max(500, "Keep the note under 500 characters."),
});

export const setThresholdSchema = z.object({
  variantId,
  threshold: z.coerce
    .number("Enter a whole number.")
    .int("Enter a whole number.")
    .min(0, "The threshold cannot be negative.")
    .max(1_000_000, "That threshold is too large."),
});

export type AdjustStockInput = z.input<typeof adjustStockSchema>;
export type SetThresholdInput = z.input<typeof setThresholdSchema>;
