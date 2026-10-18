import { z } from "zod";

/**
 * Content admin schemas (plan §7 Content, Phase 4 task 3). One zod object per
 * managed table; the generic content actions validate through this map so no
 * free-form object ever reaches Supabase. Values arrive as strings/numbers from
 * the client editor; `""` means "clear to null" for optional text fields.
 */

export const CONTENT_ENTITIES = [
  "sections",
  "clients",
  "gallery",
  "testimonials",
  "faqs",
  "posts",
  "legal",
  "redirects",
] as const;

export type ContentEntity = (typeof CONTENT_ENTITIES)[number];

const optText = z
  .string()
  .trim()
  .max(4000)
  .transform((v) => (v === "" ? null : v))
  .nullable();

const reqText = (max = 300) => z.string().trim().min(1).max(max);

/** jsonb editors arrive as text; validated as JSON and stored as a value. */
const jsonField = z
  .string()
  .trim()
  .max(20000)
  .transform((v) => (v === "" ? "{}" : v))
  .refine((v) => {
    try {
      const parsed: unknown = JSON.parse(v);
      return (
        typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      );
    } catch {
      return false;
    }
  }, "Content must be a JSON object, e.g. {\"title_en\": \"...\"}");

const slugField = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, digits and hyphens only")
  .max(120);

const dateOrEmpty = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}(?:$|T)/, "Use the date picker")
  .or(z.literal(""))
  .transform((v) => (v === "" ? null : v));

export const sectionSchema = z.object({
  page: reqText(60),
  key: reqText(60),
  content: jsonField,
});

export const clientSchema = z.object({
  name: reqText(120),
  logo_path: optText,
});

export const gallerySchema = z.object({
  image_path: reqText(600),
  caption: optText,
});

export const testimonialSchema = z.object({
  name: reqText(120),
  company: optText,
  rating: z.coerce.number().int().min(1).max(5),
  body_en: optText,
  body_bn: optText,
});

export const faqSchema = z.object({
  question_en: reqText(300),
  question_bn: optText,
  answer_en: reqText(4000),
  answer_bn: optText,
});

export const postSchema = z.object({
  slug: slugField,
  title_en: reqText(200),
  title_bn: optText,
  body_en: optText,
  body_bn: optText,
  cover_path: optText,
  status: z.enum(["draft", "published"]),
  published_at: dateOrEmpty,
  seo_title_en: optText,
  seo_description_en: optText,
});

export const legalSchema = z.object({
  title: reqText(200),
  number: optText,
  image_path: optText,
});

export const redirectSchema = z.object({
  from_path: reqText(300),
  to_path: reqText(300),
  status_code: z.union([
    z.literal(301),
    z.literal(302),
    z.literal(307),
    z.literal(308),
  ]),
});

export const ENTITY_SCHEMAS = {
  sections: sectionSchema,
  clients: clientSchema,
  gallery: gallerySchema,
  testimonials: testimonialSchema,
  faqs: faqSchema,
  posts: postSchema,
  legal: legalSchema,
  redirects: redirectSchema,
} as const;

export const contentIdSchema = z.object({
  entity: z.enum(CONTENT_ENTITIES),
  id: z.guid(),
});

export const contentMoveSchema = z.object({
  entity: z.enum(CONTENT_ENTITIES),
  id: z.guid(),
  dir: z.union([z.literal(-1), z.literal(1)]),
});

export const contentToggleSchema = z.object({
  entity: z.enum(CONTENT_ENTITIES),
  id: z.guid(),
});

export const contentSaveSchema = z.object({
  entity: z.enum(CONTENT_ENTITIES),
  id: z.union([z.guid(), z.literal("")]).optional(),
  values: z.record(z.string(), z.unknown()),
});

export type ContentSaveInput = z.infer<typeof contentSaveSchema>;
