import { z } from "zod";

/**
 * Plan 15.2 B9 — the Custom Bag Builder snapshot (finding R10).
 *
 * `/builder` ends as a `builder` quote request whose `customization` column
 * holds the JSON the wizard captured (see `builder-wizard.tsx` snapshot).
 * Until now the action only did `JSON.parse` with a 20 KB cap and stored
 * `null` on failure — a tampered or mangled blob silently lost the customer's
 * configuration, and any JSON shape was storable. This schema mirrors exactly
 * what the shipped wizard emits, bounds every string, and forbids unknown
 * keys, so the action can REJECT instead of storing null.
 *
 * Shape notes (kept in sync with the wizard's Draft):
 * - sizes and quantity arrive as form strings ("12", ""), not numbers;
 * - a swatch may legitimately have no hex yet (`color_hex: string | null`),
 *   and the handle color / artwork / print fields may be empty;
 * - trimming is applied — that normalized object is what the DB stores.
 */

const bounded = (max: number) => z.string().trim().max(max);

const colorSnapshot = z.strictObject({
  name: bounded(80),
  hex: bounded(9).nullable(),
});

export const builderCustomizationSchema = z.strictObject({
  category: z.strictObject({
    id: bounded(64),
    slug: bounded(80),
    name: bounded(120),
  }),
  size: z.strictObject({
    width: bounded(12),
    height: bounded(12),
    gusset: bounded(12),
    unit: bounded(12),
  }),
  material: bounded(120),
  colors: z.strictObject({
    primary: colorSnapshot.nullable(),
    handle: colorSnapshot.nullable(),
  }),
  printing: z.strictObject({
    method: bounded(80),
    text: bounded(200),
    artwork: bounded(400).nullable(),
  }),
  quantity: bounded(12),
});

export type BuilderCustomization = z.infer<typeof builderCustomizationSchema>;
