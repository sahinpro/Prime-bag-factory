import { z } from "zod";

import { isValidSlug } from "@/lib/slug";

/**
 * Products create/update validation (AGENTS: validate every action with zod, on
 * both the client and the server; never trust money/stock from the browser — these
 * are the authoritative server-side shapes the actions re-parse).
 *
 * `products` (plan section 6) carries the base + SEO + settings columns; its
 * children (`price_tiers`, `product_variants`, `product_images`,
 * `product_custom_parts` and the part swatch join) are saved through dedicated
 * "replace" actions, each validated here. Money is `numeric(12,2)` BDT. Empty
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

const slugField = z
  .string()
  .trim()
  .refine(isValidSlug, {
    message: "Slug must be lowercase, hyphenated English.",
  })
  .optional()
  .or(z.literal(""));

// Optional `#rrggbb`, lower-cased — same rule as the Swatch Library.
const hexField = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .refine((v) => !v || /^#[0-9a-fA-F]{6}$/.test(v), {
    message: "Hex must be #rrggbb.",
  })
  .transform((v) => (v ? v.toLowerCase() : undefined));

// Optional uuid — empty string means "unset" coming from a cleared select.
const optionalGuid = z
  .string()
  .uuid()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

const money = z.coerce.number().min(0).max(9999999999.99);
const signedMoney = z.coerce.number().min(-9999999999.99).max(9999999999.99);
const intQty = z.coerce.number().int().min(0).max(100000000);

const productTypeEnum = z.enum(["buy_now", "quote_only"]);
const stockModeEnum = z.enum(["tracked", "made_to_order"]);
const productStatusEnum = z.enum(["draft", "published", "archived"]);
const customInputTypeEnum = z.enum([
  "swatch",
  "select",
  "dimensions",
  "file",
  "text",
]);

// -------------------------------------------------------------- base row ----

/** Fields on the General tab: identity, copy, commerce settings and status. */
export const productGeneralSchema = z.object({
  title_en: z.string().trim().min(1, "English title is required.").max(120),
  title_bn: optionalText(120),
  short_description_en: optionalText(160),
  short_description_bn: optionalText(160),
  description_en: optionalText(5000),
  description_bn: optionalText(5000),
  material: optionalText(120),
  type: productTypeEnum.default("quote_only"),
  stock_mode: stockModeEnum.default("made_to_order"),
  moq: z.coerce.number().int().min(1).max(1000000).default(1),
  lead_time_days: z.coerce.number().int().min(0).max(3650).optional(),
  customization_enabled: z.boolean().default(false),
  is_featured: z.boolean().default(false),
  status: productStatusEnum.default("draft"),
  slug: slugField,
});

/** Fields on the SEO tab. */
export const productSeoSchema = z.object({
  seo_title_en: optionalText(70),
  seo_title_bn: optionalText(70),
  seo_description_en: optionalText(160),
  seo_description_bn: optionalText(160),
});

/** Minimum needed to create a draft so the editor can attach children. */
export const productCreateSchema = z.object({
  title_en: z.string().trim().min(1, "English title is required.").max(120),
  title_bn: optionalText(120),
  type: productTypeEnum.default("quote_only"),
  status: productStatusEnum.default("draft"),
});

export const productStatusSchema = z.object({
  id: z.guid(),
  status: productStatusEnum,
});

export const bulkStatusSchema = z.object({
  ids: z.array(z.guid()).min(1, "Select at least one product.").max(200),
  status: productStatusEnum,
});

// -------------------------------------------------------------- children ----

/** One quantity-range price row (plan "quantity-range editor"). */
export const priceTierSchema = z
  .object({
    min_qty: z.coerce.number().int().min(1).max(1000000),
    max_qty: z.coerce.number().int().min(1).max(1000000).optional(),
    unit_price: money,
  })
  .superRefine((tier, ctx) => {
    if (tier.max_qty != null && tier.max_qty < tier.min_qty) {
      ctx.addIssue({
        code: "custom",
        path: ["max_qty"],
        message: "Max quantity must be at least the min quantity.",
      });
    }
  });

export const variantSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required.")
    .max(60)
    .regex(/^[A-Za-z0-9._/-]+$/, {
      message:
        "SKU may use letters, numbers, dot, slash, underscore or hyphen.",
    })
    .transform((v) => v.toUpperCase()),
  swatch_id: optionalGuid,
  color_name: optionalText(60),
  color_hex: hexField,
  size: optionalText(40),
  price_delta: signedMoney.default(0),
  stock_qty: intQty.default(0),
  reserved_qty: intQty.default(0),
  low_stock_threshold: intQty.default(0),
  is_active: z.boolean().default(true),
});

export const productImageSchema = z.object({
  path: z.string().trim().min(1, "Image is required.").max(500),
  alt_en: optionalText(150),
  alt_bn: optionalText(150),
  sort_order: z.coerce.number().int().min(0).max(100000).default(0),
  variant_id: optionalGuid,
});

export const categoryRefSchema = z.object({
  category_id: z.guid(),
  is_primary: z.boolean().default(false),
});

/** The swatches a builder part allows, with an optional per-swatch upcharge. */
export const partSwatchSchema = z.object({
  swatch_id: z.guid(),
  is_default: z.boolean().default(false),
  price_delta: signedMoney.optional(),
});

export const customPartSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Key is required.")
    .max(40)
    .regex(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/, {
      message: "Key is lowercase letters, numbers, underscore or hyphen.",
    }),
  label_en: z.string().trim().min(1, "English label is required.").max(60),
  label_bn: optionalText(60),
  input_type: customInputTypeEnum,
  swatch_group_id: optionalGuid,
  is_required: z.boolean().default(false),
  price_delta: signedMoney.default(0),
  // Free-form JSON per input type (e.g. size limits for `dimensions`).
  config: z.record(z.string(), z.unknown()).default({}),
  help_text_en: optionalText(160),
  help_text_bn: optionalText(160),
  sort_order: z.coerce.number().int().min(0).max(100000).default(0),
  allowed_swatches: z.array(partSwatchSchema).default([]),
});

// ----------------------------------------------------------- replace sets ---

const productIdField = z.guid({ error: "Invalid product." });

export const savePriceTiersSchema = z.object({
  product_id: productIdField,
  tiers: z.array(priceTierSchema).max(50),
});

export const saveVariantsSchema = z.object({
  product_id: productIdField,
  variants: z.array(variantSchema).max(200),
});

export const saveImagesSchema = z.object({
  product_id: productIdField,
  images: z.array(productImageSchema).max(30),
});

export const setCategoriesSchema = z.object({
  product_id: productIdField,
  categories: z.array(categoryRefSchema).max(20),
});

export const setCollectionsSchema = z.object({
  product_id: productIdField,
  collection_ids: z.array(z.guid()).max(30),
});

export const saveCustomPartsSchema = z.object({
  product_id: productIdField,
  parts: z.array(customPartSchema).max(30),
});

// -------------------------------------------------------------- exported ----

export type ProductGeneralInput = z.infer<typeof productGeneralSchema>;
export type ProductSeoInput = z.infer<typeof productSeoSchema>;
export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type PriceTierInput = z.infer<typeof priceTierSchema>;
export type VariantInput = z.infer<typeof variantSchema>;
export type ProductImageInput = z.infer<typeof productImageSchema>;
export type CategoryRefInput = z.infer<typeof categoryRefSchema>;
export type PartSwatchInput = z.infer<typeof partSwatchSchema>;
export type CustomPartInput = z.infer<typeof customPartSchema>;
