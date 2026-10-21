import { z } from "zod";

/**
 * Shipping zone create/update validation (AGENTS: validate every action with zod,
 * on both the client and the server). The `shipping_zones` table (plan §6) carries
 * a bilingual name, a flat `fee`, an optional `free_over` subtotal threshold that
 * waives the fee, and an active flag. Money is BDT with 2 decimals; the DB caps at
 * numeric(12,2) and has `check (fee >= 0)`, mirrored here so bad input fails with a
 * friendly message before it reaches Postgres. `free_over` is independent of `fee`
 * (it is a subtotal threshold, not a discount), so we only bound it to >= 0. The
 * authoritative fee is always recomputed server-side in `place_order` — these values
 * configure it, never trust them from the browser.
 */

const money = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .min(0, `${label} cannot be negative.`)
    .max(9_999_999.99, `${label} is too large.`);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

export const shippingZoneInputSchema = z.object({
  name_en: z.string().trim().min(1, "English name is required.").max(80),
  name_bn: optionalText(80),
  fee: money("Shipping fee"),
  // Empty clears the threshold (fee always applies); a number sets it.
  free_over: z
    .union([z.literal(""), z.literal(null), money("Free-over amount")])
    .optional()
    .transform((v) => (v === "" || v == null ? undefined : v)),
  is_active: z.boolean().default(true),
});

export const shippingZoneUpdateSchema = shippingZoneInputSchema.extend({
  id: z.guid(),
});

export type ShippingZoneInput = z.infer<typeof shippingZoneInputSchema>;
export type ShippingZoneUpdate = z.infer<typeof shippingZoneUpdateSchema>;
