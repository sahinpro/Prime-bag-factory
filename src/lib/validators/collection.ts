import { z } from "zod";

import { isValidSlug } from "@/lib/slug";

/**
 * Collection create/update validation (AGENTS: validate every action with zod, on
 * both the client and the server). The `collections` table (plan section 6) carries
 * bilingual name/description, a unique slug, an image path, sort order and an
 * active flag — there are no SEO columns, so none are validated here. Optional text
 * fields are stored as `null` when empty; the server normalizes after parsing.
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

export const collectionInputSchema = z.object({
  name_en: z.string().trim().min(1, "English name is required.").max(80),
  name_bn: optionalText(80),
  description_en: optionalText(500),
  description_bn: optionalText(500),
  slug: slugField,
  image_path: optionalText(300),
  sort_order: z.coerce.number().int().min(0).max(100000).default(0),
  is_active: z.boolean().default(true),
});

export const collectionUpdateSchema = collectionInputSchema.extend({
  id: z.guid(),
});

export type CollectionInput = z.infer<typeof collectionInputSchema>;
export type CollectionUpdate = z.infer<typeof collectionUpdateSchema>;
