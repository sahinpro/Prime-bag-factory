import { z } from "zod";

import { isValidSlug } from "@/lib/slug";

/**
 * Category create/update validation (AGENTS: validate every action with zod, on
 * both the client and the server). Optional text fields are stored as `null` when
 * empty; the server normalizes after parsing. Money/`sort_order` are integers.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

const slugField = z
  .string()
  .trim()
  .refine(isValidSlug, {
    message: "Slug must be lowercase, hyphenated English.",
  })
  .optional()
  .or(z.literal(""));

const parentField = z.string().trim().optional().or(z.literal(""));

export const categoryInputSchema = z.object({
  name_en: z.string().trim().min(1, "English name is required.").max(80),
  name_bn: optionalText(80),
  description_en: optionalText(500),
  description_bn: optionalText(500),
  seo_title_en: optionalText(70),
  seo_title_bn: optionalText(70),
  seo_description_en: optionalText(160),
  seo_description_bn: optionalText(160),
  slug: slugField,
  parent_id: parentField,
  image_path: optionalText(300),
  sort_order: z.coerce.number().int().min(0).max(100000).default(0),
  is_active: z.boolean().default(true),
});

export const categoryUpdateSchema = categoryInputSchema.extend({
  id: z.guid(),
});

export const categoryReorderSchema = z.object({
  // Ordered list of ids; the index becomes `sort_order`.
  orderedIds: z.array(z.guid()).min(1),
});

export type CategoryInput = z.infer<typeof categoryInputSchema>;
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>;
