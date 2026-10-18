import "server-only";

import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-only reads for the Products module. Reads ride the cookie session, so
 * `has_role()` RLS decides scope (owner/manager/inventory manage products; the
 * list and editor are gated in the page + every action re-checks the role).
 *
 * PostgREST returns `numeric` as a string on some drivers, so every money /
 * count field is coerced with `num()` before use.
 */

type ProductStatus = Database["public"]["Enums"]["product_status"];
type ProductType = Database["public"]["Enums"]["product_type"];
type StockMode = Database["public"]["Enums"]["product_stock_mode"];

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

// ------------------------------------------------------------------ list ----

export type AdminProductSummary = {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string | null;
  type: ProductType;
  status: ProductStatus;
  moq: number;
  customization_enabled: boolean;
  thumbnail: string | null;
  categories: string[];
  priceMin: number | null;
  priceMax: number | null;
  /** Available units across active variants (null for made-to-order). */
  available: number | null;
};

const LIST_SELECT = `
  id, slug, title_en, title_bn, type, status, moq, customization_enabled,
  stock_mode,
  product_images ( path, sort_order ),
  product_categories ( is_primary, categories ( name_en ) ),
  price_tiers ( unit_price ),
  product_variants ( stock_qty, reserved_qty, is_active )
`;

type ListRow = {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string | null;
  type: ProductType;
  status: ProductStatus;
  moq: number;
  customization_enabled: boolean;
  stock_mode: StockMode;
  product_images: { path: string; sort_order: number }[] | null;
  product_categories:
    | { is_primary: boolean; categories: { name_en: string } | null }[]
    | null;
  price_tiers: { unit_price: unknown }[] | null;
  product_variants:
    | { stock_qty: unknown; reserved_qty: unknown; is_active: boolean }[]
    | null;
};

function toSummary(row: ListRow): AdminProductSummary {
  const images = (row.product_images ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order);
  const prices = (row.price_tiers ?? [])
    .map((t) => num(t.unit_price))
    .filter((n) => n > 0);
  const activeVariants = (row.product_variants ?? []).filter(
    (v) => v.is_active,
  );
  const available =
    row.stock_mode === "made_to_order"
      ? null
      : activeVariants.reduce(
          (sum, v) => sum + (num(v.stock_qty) - num(v.reserved_qty)),
          0,
        );

  return {
    id: row.id,
    slug: row.slug,
    title_en: row.title_en,
    title_bn: row.title_bn,
    type: row.type,
    status: row.status,
    moq: num(row.moq),
    customization_enabled: row.customization_enabled,
    thumbnail: images[0]?.path ?? null,
    categories: (row.product_categories ?? [])
      .map((c) => c.categories?.name_en)
      .filter((n): n is string => Boolean(n)),
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    available,
  };
}

/** Products for one status tab (or all statuses when `status` is undefined). */
export async function listAdminProducts(
  status?: ProductStatus,
): Promise<AdminProductSummary[]> {
  const supabase = await createClient();
  let query = supabase.from("products").select(LIST_SELECT);
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) throw new Error("Failed to load products.", { cause: error });
  return (data ?? ([] as unknown as ListRow[])).map(toSummary);
}

/** Counts for the status tabs, always over the full set. */
export async function countProductsByStatus(): Promise<
  Record<ProductStatus | "all", number>
> {
  const supabase = await createClient();
  const statuses: ProductStatus[] = ["published", "draft", "archived"];
  const results = await Promise.all(
    statuses.map(async (s) => {
      const { count } = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("status", s);
      return [s, count ?? 0] as const;
    }),
  );
  const map: Record<ProductStatus | "all", number> = {
    all: 0,
    published: 0,
    draft: 0,
    archived: 0,
  };
  for (const [status, count] of results) {
    map[status] = count;
    map.all += count;
  }
  return map;
}

// ----------------------------------------------------------------- editor ---

export type AdminVariant = {
  id: string;
  sku: string;
  swatch_id: string | null;
  color_name: string | null;
  color_hex: string | null;
  size: string | null;
  price_delta: number;
  stock_qty: number;
  reserved_qty: number;
  low_stock_threshold: number;
  is_active: boolean;
};

export type AdminPriceTier = {
  id: string;
  min_qty: number;
  max_qty: number | null;
  unit_price: number;
};

export type AdminImage = {
  id: string;
  path: string;
  alt_en: string | null;
  alt_bn: string | null;
  sort_order: number;
  variant_id: string | null;
};

export type AdminPartSwatch = {
  swatch_id: string;
  is_default: boolean;
  price_delta: number | null;
};

export type AdminCustomPart = {
  id: string;
  key: string;
  label_en: string;
  label_bn: string | null;
  input_type: Database["public"]["Enums"]["product_custom_input_type"];
  swatch_group_id: string | null;
  is_required: boolean;
  price_delta: number;
  config: unknown;
  help_text_en: string | null;
  help_text_bn: string | null;
  sort_order: number;
  allowed_swatches: AdminPartSwatch[];
};

export type AdminProduct = {
  id: string;
  slug: string;
  type: ProductType;
  title_en: string;
  title_bn: string | null;
  short_description_en: string | null;
  short_description_bn: string | null;
  description_en: string | null;
  description_bn: string | null;
  specs: unknown;
  material: string | null;
  moq: number;
  lead_time_days: number | null;
  stock_mode: StockMode;
  customization_enabled: boolean;
  status: ProductStatus;
  is_featured: boolean;
  seo_title_en: string | null;
  seo_title_bn: string | null;
  seo_description_en: string | null;
  seo_description_bn: string | null;
  variants: AdminVariant[];
  price_tiers: AdminPriceTier[];
  images: AdminImage[];
  category_ids: { category_id: string; is_primary: boolean }[];
  collection_ids: string[];
  custom_parts: AdminCustomPart[];
};

const EDITOR_SELECT = `
  id, slug, type, title_en, title_bn, short_description_en, short_description_bn,
  description_en, description_bn, specs, material, moq, lead_time_days, stock_mode,
  customization_enabled, status, is_featured,
  seo_title_en, seo_title_bn, seo_description_en, seo_description_bn,
  product_variants ( id, sku, swatch_id, color_name, color_hex, size, price_delta, stock_qty, reserved_qty, low_stock_threshold, is_active ),
  price_tiers ( id, min_qty, max_qty, unit_price ),
  product_images ( id, path, alt_en, alt_bn, sort_order, variant_id ),
  product_categories ( category_id, is_primary ),
  product_collections ( collection_id ),
  product_custom_parts ( id, key, label_en, label_bn, input_type, swatch_group_id, is_required, price_delta, config, help_text_en, help_text_bn, sort_order, product_part_swatches ( swatch_id, is_default, price_delta ) )
`;

export async function getAdminProduct(
  id: string,
): Promise<AdminProduct | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(EDITOR_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Failed to load the product.", { cause: error });
  if (!data) return null;
  return normalizeProduct(data as unknown as RawProduct);
}

type RawVariant = {
  id: string;
  sku: string;
  swatch_id: string | null;
  color_name: string | null;
  color_hex: string | null;
  size: string | null;
  price_delta: unknown;
  stock_qty: unknown;
  reserved_qty: unknown;
  low_stock_threshold: unknown;
  is_active: boolean;
};
type RawTier = {
  id: string;
  min_qty: unknown;
  max_qty: unknown;
  unit_price: unknown;
};
type RawImage = {
  id: string;
  path: string;
  alt_en: string | null;
  alt_bn: string | null;
  sort_order: unknown;
  variant_id: string | null;
};
type RawPart = {
  id: string;
  key: string;
  label_en: string;
  label_bn: string | null;
  input_type: AdminCustomPart["input_type"];
  swatch_group_id: string | null;
  is_required: boolean;
  price_delta: unknown;
  config: unknown;
  help_text_en: string | null;
  help_text_bn: string | null;
  sort_order: unknown;
  product_part_swatches:
    | {
        swatch_id: string;
        is_default: boolean;
        price_delta: unknown;
      }[]
    | null;
};

// PostgREST returns each embed keyed by its table name, never a friendly alias.
type RawProduct = {
  id: string;
  slug: string;
  type: ProductType;
  title_en: string;
  title_bn: string | null;
  short_description_en: string | null;
  short_description_bn: string | null;
  description_en: string | null;
  description_bn: string | null;
  specs: unknown;
  material: string | null;
  moq: unknown;
  lead_time_days: unknown;
  stock_mode: StockMode;
  customization_enabled: boolean;
  status: ProductStatus;
  is_featured: boolean;
  seo_title_en: string | null;
  seo_title_bn: string | null;
  seo_description_en: string | null;
  seo_description_bn: string | null;
  product_variants: RawVariant[] | null;
  price_tiers: RawTier[] | null;
  product_images: RawImage[] | null;
  product_categories: { category_id: string; is_primary: boolean }[] | null;
  product_collections: { collection_id: string }[] | null;
  product_custom_parts: RawPart[] | null;
};

function normalizeProduct(raw: RawProduct): AdminProduct {
  return {
    id: raw.id,
    slug: raw.slug,
    type: raw.type,
    title_en: raw.title_en,
    title_bn: raw.title_bn,
    short_description_en: raw.short_description_en,
    short_description_bn: raw.short_description_bn,
    description_en: raw.description_en,
    description_bn: raw.description_bn,
    specs: raw.specs ?? null,
    material: raw.material,
    moq: num(raw.moq),
    lead_time_days: raw.lead_time_days == null ? null : num(raw.lead_time_days),
    stock_mode: raw.stock_mode,
    customization_enabled: raw.customization_enabled,
    status: raw.status,
    is_featured: raw.is_featured,
    seo_title_en: raw.seo_title_en,
    seo_title_bn: raw.seo_title_bn,
    seo_description_en: raw.seo_description_en,
    seo_description_bn: raw.seo_description_bn,
    variants: (raw.product_variants ?? [])
      .slice()
      .sort((a, b) => a.sku.localeCompare(b.sku))
      .map((v) => ({
        id: v.id,
        sku: v.sku,
        swatch_id: v.swatch_id,
        color_name: v.color_name,
        color_hex: v.color_hex,
        size: v.size,
        price_delta: num(v.price_delta),
        stock_qty: num(v.stock_qty),
        reserved_qty: num(v.reserved_qty),
        low_stock_threshold: num(v.low_stock_threshold),
        is_active: v.is_active,
      })),
    price_tiers: (raw.price_tiers ?? [])
      .slice()
      .sort((a, b) => num(a.min_qty) - num(b.min_qty))
      .map((t) => ({
        id: t.id,
        min_qty: num(t.min_qty),
        max_qty: t.max_qty == null ? null : num(t.max_qty),
        unit_price: num(t.unit_price),
      })),
    images: (raw.product_images ?? [])
      .slice()
      .sort((a, b) => num(a.sort_order) - num(b.sort_order))
      .map((im) => ({
        id: im.id,
        path: im.path,
        alt_en: im.alt_en,
        alt_bn: im.alt_bn,
        sort_order: num(im.sort_order),
        variant_id: im.variant_id,
      })),
    category_ids: (raw.product_categories ?? []).map((c) => ({
      category_id: c.category_id,
      is_primary: c.is_primary,
    })),
    collection_ids: (raw.product_collections ?? []).map((c) => c.collection_id),
    custom_parts: (raw.product_custom_parts ?? [])
      .slice()
      .sort((a, b) => num(a.sort_order) - num(b.sort_order))
      .map((p) => ({
        id: p.id,
        key: p.key,
        label_en: p.label_en,
        label_bn: p.label_bn,
        input_type: p.input_type,
        swatch_group_id: p.swatch_group_id,
        is_required: p.is_required,
        price_delta: num(p.price_delta),
        config: p.config ?? {},
        help_text_en: p.help_text_en,
        help_text_bn: p.help_text_bn,
        sort_order: num(p.sort_order),
        allowed_swatches: (p.product_part_swatches ?? []).map((s) => ({
          swatch_id: s.swatch_id,
          is_default: s.is_default,
          price_delta: s.price_delta == null ? null : num(s.price_delta),
        })),
      })),
  };
}

/** Lightweight id+name lists for the relation pickers (categories, collections). */
export async function listRelationOptions() {
  const supabase = await createClient();
  const [categories, collections] = await Promise.all([
    supabase.from("categories").select("id, name_en").order("name_en"),
    supabase.from("collections").select("id, name_en").order("name_en"),
  ]);
  return {
    categories: (categories.data ?? []) as { id: string; name_en: string }[],
    collections: (collections.data ?? []) as { id: string; name_en: string }[],
  };
}
