import { z } from "zod";

/**
 * Swatch Library validation (plan section 6, AGENTS: zod on client + server).
 * Two flat tables: `swatch_groups` (a `key` slug-like identifier, bilingual name,
 * order) and `swatches` (belongs to a group, bilingual name, an optional fabric
 * `code`, an optional `#rrggbb` hex and an optional texture image path). Empty
 * optional text is stored as `null`; the server normalizes after parsing.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

// Group keys are lowercase machine identifiers (e.g. body_fabric, handle).
const keyField = z
  .string()
  .trim()
  .min(1, "Key is required.")
  .max(40)
  .regex(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/, {
    message: "Key is lowercase letters, numbers, underscore or hyphen.",
  });

const hexField = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || /^#[0-9a-fA-F]{6}$/.test(v), {
    message: "Hex must be #rrggbb.",
  })
  .transform((v) => (v ? v.toLowerCase() : undefined));

export const swatchGroupInputSchema = z.object({
  key: keyField,
  name_en: z.string().trim().min(1, "English name is required.").max(60),
  name_bn: optionalText(60),
  sort_order: z.coerce.number().int().min(0).max(100000).default(0),
});

export const swatchGroupUpdateSchema = swatchGroupInputSchema.extend({
  id: z.guid(),
});

export const swatchInputSchema = z.object({
  group_id: z.guid({ error: "Choose a swatch group." }),
  name_en: z.string().trim().min(1, "English name is required.").max(60),
  name_bn: optionalText(60),
  code: optionalText(20),
  color_hex: hexField,
  texture_image_path: optionalText(300),
  sort_order: z.coerce.number().int().min(0).max(100000).default(0),
  is_active: z.boolean().default(true),
});

export const swatchUpdateSchema = swatchInputSchema.extend({
  id: z.guid(),
});

export type SwatchGroupInput = z.infer<typeof swatchGroupInputSchema>;
export type SwatchInput = z.infer<typeof swatchInputSchema>;
