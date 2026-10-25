import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Database } from "@/lib/database.types";
import { createPublicClient } from "@/lib/supabase/server";

/**
 * Public catalog reads (plan 3b). These run on the cookie-free anon client so a
 * Server Component using them can stay Static / ISR; each read is memoized with
 * the `"use cache"` directive under a shared `catalog` cache tag (plan 3b cache
 * tags). Cache Components is on (`next.config.ts`), so uncached reads already run
 * per request and only these tagged scopes are stored. RLS enforces visibility
 * (only published products, active categories/collections/variants/swatches,
 * published content — verified in the Phase 1 policies); the explicit `.eq(
 * "status", "published")` / `.eq("is_active", true)` filters below are
 * belt-and-braces. An admin catalog save calls `revalidateTag(CATALOG_TAG)` so
 * the whole public site refreshes on demand; the `catalog` cacheLife profile is
 * only a backstop.
 */

/** Shared tag so one admin catalog save can refresh every public page at once. */
export const CATALOG_TAG = CACHE_TAGS.catalog;

type ProductType = Database["public"]["Enums"]["product_type"];
type StockMode = Database["public"]["Enums"]["product_stock_mode"];
type InputType = Database["public"]["Enums"]["product_custom_input_type"];

/** Postgres numeric arrives as a string on some drivers — coerce defensively. */
function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

/** Pick the Bangla value when present, else fall back to English (plan 3c). */
export function localize(
  locale: string,
  en: string | null | undefined,
  bn: string | null | undefined,
): string {
  if (locale === "bn" && bn && bn.trim() !== "") return bn;
  return en ?? "";
}

// ------------------------------------------------------------------- nav ----

export type NavCategory = {
  slug: string;
  name_en: string;
  name_bn: string | null;
  children: NavCategory[];
};

type CategoryRow = {
  id: string;
  parent_id: string | null;
  slug: string;
  name_en: string;
  name_bn: string | null;
  sort_order: number;
};

async function fetchNavCategories(): Promise<NavCategory[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, parent_id, slug, name_en, name_bn, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name_en", { ascending: true });

  if (error) throw new Error("Failed to load categories.", { cause: error });

  const rows = (data ?? []) as CategoryRow[];
  const topLevel = rows.filter((r) => r.parent_id === null);
  const childrenByParent = new Map<string, CategoryRow[]>();
  for (const r of rows) {
    if (r.parent_id) {
      const list = childrenByParent.get(r.parent_id) ?? [];
      list.push(r);
      childrenByParent.set(r.parent_id, list);
    }
  }

  return topLevel.map((parent) => ({
    slug: parent.slug,
    name_en: parent.name_en,
    name_bn: parent.name_bn,
    children: (childrenByParent.get(parent.id) ?? []).map((child) => ({
      slug: child.slug,
      name_en: child.name_en,
      name_bn: child.name_bn,
      children: [],
    })),
  }));
}

export async function getNavCategories(): Promise<NavCategory[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  return fetchNavCategories();
}

// ------------------------------------------------------------- summaries ----

export type ProductSummary = {
  slug: string;
  title_en: string;
  title_bn: string | null;
  short_description_en: string | null;
  short_description_bn: string | null;
  type: ProductType;
  moq: number;
  customization_enabled: boolean;
  is_featured: boolean;
  thumbnail: string | null;
  priceMin: number | null;
  priceMax: number | null;
};

const SUMMARY_SELECT = `
  slug, title_en, title_bn, short_description_en, short_description_bn,
  type, moq, customization_enabled, is_featured,
  product_images ( path, sort_order ),
  price_tiers ( unit_price )
`;

type SummaryRow = {
  slug: string;
  title_en: string;
  title_bn: string | null;
  short_description_en: string | null;
  short_description_bn: string | null;
  type: ProductType;
  moq: unknown;
  customization_enabled: boolean;
  is_featured: boolean;
  product_images: { path: string; sort_order: unknown }[] | null;
  price_tiers: { unit_price: unknown }[] | null;
};

function toSummary(row: SummaryRow): ProductSummary {
  const images = (row.product_images ?? [])
    .slice()
    .sort((a, b) => num(a.sort_order) - num(b.sort_order));
  const prices = (row.price_tiers ?? [])
    .map((t) => num(t.unit_price))
    .filter((n) => n > 0);
  return {
    slug: row.slug,
    title_en: row.title_en,
    title_bn: row.title_bn,
    short_description_en: row.short_description_en,
    short_description_bn: row.short_description_bn,
    type: row.type,
    moq: num(row.moq),
    customization_enabled: row.customization_enabled,
    is_featured: row.is_featured,
    thumbnail: images[0]?.path ?? null,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
  };
}

async function fetchProductsByIds(
  ids: string[],
  limit: number,
): Promise<ProductSummary[]> {
  if (ids.length === 0) return [];
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(SUMMARY_SELECT)
    .eq("status", "published")
    .in("id", ids)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Failed to load products.", { cause: error });
  return ((data ?? []) as unknown as SummaryRow[]).map(toSummary);
}

/** Featured published products (home rail). */
async function fetchFeatured(limit: number): Promise<ProductSummary[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(SUMMARY_SELECT)
    .eq("status", "published")
    .eq("is_featured", true)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error)
    throw new Error("Failed to load featured products.", { cause: error });
  return ((data ?? []) as unknown as SummaryRow[]).map(toSummary);
}

/** Newest published products (home fallback / search default). */
async function fetchRecent(limit: number): Promise<ProductSummary[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(SUMMARY_SELECT)
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Failed to load products.", { cause: error });
  return ((data ?? []) as unknown as SummaryRow[]).map(toSummary);
}

export async function listFeaturedProducts(
  limit = 8,
): Promise<ProductSummary[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  return fetchFeatured(limit);
}

export async function listRecentProducts(limit = 8): Promise<ProductSummary[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  return fetchRecent(limit);
}

/** Featured `buy_now` products for the ready-stock strip. Newest first. */
export async function listFeaturedBuyNow(limit = 8): Promise<ProductSummary[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  return fetchFeatured(limit, "buy_now");
}

export type FabricSwatch = {
  code: string;
  name_en: string;
  name_bn: string | null;
  color_hex: string | null;
  texture_image_path: string | null;
};

/** Active swatches in the fabric group that have a builder code. Up to `limit`. */
export async function listFabricSwatches(limit = 4): Promise<FabricSwatch[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  const supabase = createPublicClient();
  const { data: group, error: groupError } = await supabase
    .from("swatch_groups")
    .select("id")
    .eq("key", "fabric")
    .maybeSingle();
  if (groupError) {
    throw new Error("Failed to load fabric swatches.", { cause: groupError });
  }
  if (!group) return [];

  const { data, error } = await supabase
    .from("swatches")
    .select("code, name_en, name_bn, color_hex, texture_image_path")
    .eq("group_id", group.id)
    .eq("is_active", true)
    .order("sort_order")
    .limit(limit);
  if (error) throw new Error("Failed to load fabric swatches.", { cause: error });

  const rows = (data ?? []) as {
    code: string | null;
    name_en: string;
    name_bn: string | null;
    color_hex: string | null;
    texture_image_path: string | null;
  }[];

  return rows.flatMap((row) => {
    const code = row.code?.trim();
    if (!code) return [];
    return [
      {
        code,
        name_en: row.name_en,
        name_bn: row.name_bn,
        color_hex: row.color_hex,
        texture_image_path: row.texture_image_path,
      },
    ];
  });
}

// ------------------------------------------------------ category / collection ----

export type CategoryCard = {
  slug: string;
  name_en: string;
  name_bn: string | null;
  image_path: string | null;
};

export type CategoryPage = CategoryCard & {
  description_en: string | null;
  description_bn: string | null;
  products: ProductSummary[];
  siblings: { slug: string; name_en: string; name_bn: string | null }[];
};

export async function getCategoryBySlug(
  slug: string,
): Promise<CategoryPage | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog, CACHE_TAGS.category(slug));
  const supabase = createPublicClient();
  const { data: cat, error } = await supabase
    .from("categories")
    .select(
      "id, parent_id, slug, name_en, name_bn, description_en, description_bn, image_path",
    )
    .eq("is_active", true)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Failed to load category.", { cause: error });
  if (!cat) return null;

  const { data: links } = await supabase
    .from("product_categories")
    .select("product_id")
    .eq("category_id", cat.id);
  const productIds = (links ?? []).map(
    (l: { product_id: string }) => l.product_id,
  );
  const products = await fetchProductsByIds(productIds, 48);

  const siblingsQuery = cat.parent_id ?? cat.id;
  const { data: sib } = await supabase
    .from("categories")
    .select("slug, name_en, name_bn")
    .eq("is_active", true)
    .eq("parent_id", siblingsQuery)
    .neq("slug", slug)
    .order("sort_order");

  return {
    slug: cat.slug,
    name_en: cat.name_en,
    name_bn: cat.name_bn,
    image_path: cat.image_path,
    description_en: cat.description_en,
    description_bn: cat.description_bn,
    products,
    siblings: (sib ?? []) as {
      slug: string;
      name_en: string;
      name_bn: string | null;
    }[],
  } satisfies CategoryPage;
}

export type CollectionPage = CategoryCard & {
  description_en: string | null;
  description_bn: string | null;
  products: ProductSummary[];
};

export async function getCollectionBySlug(
  slug: string,
): Promise<CollectionPage | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  const supabase = createPublicClient();
  const { data: col, error } = await supabase
    .from("collections")
    .select(
      "id, slug, name_en, name_bn, description_en, description_bn, image_path",
    )
    .eq("is_active", true)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Failed to load collection.", { cause: error });
  if (!col) return null;

  const { data: links } = await supabase
    .from("product_collections")
    .select("product_id")
    .eq("collection_id", col.id);
  const productIds = (links ?? []).map(
    (l: { product_id: string }) => l.product_id,
  );
  const products = await fetchProductsByIds(productIds, 48);

  return {
    slug: col.slug,
    name_en: col.name_en,
    name_bn: col.name_bn,
    image_path: col.image_path,
    description_en: col.description_en,
    description_bn: col.description_bn,
    products,
  } satisfies CollectionPage;
}

export async function listPublicCollections(): Promise<CategoryCard[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("collections")
    .select("slug, name_en, name_bn, image_path")
    .eq("is_active", true)
    .order("sort_order")
    .order("name_en");
  if (error) throw new Error("Failed to load collections.", { cause: error });
  return (data ?? []) as CategoryCard[];
}

export async function listTopLevelCategoryCards(): Promise<CategoryCard[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("slug, name_en, name_bn, image_path")
    .eq("is_active", true)
    .is("parent_id", null)
    .order("sort_order")
    .order("name_en")
    .limit(8);
  if (error) throw new Error("Failed to load categories.", { cause: error });
  return (data ?? []) as CategoryCard[];
}

// ----------------------------------------------------------------- search ----

/**
 * Search published products across both language titles with case-insensitive
 * `ilike` (Postgres has no Bangla stemmer; plan 3c accepts `ilike` for public
 * search). Empty query falls back to the recent set.
 */
export function searchProducts(q: string): Promise<ProductSummary[]> {
  const term = q.trim();
  if (term.length === 0) return listRecentProducts(24);
  const escaped = term.replace(/[%_,()]/g, " ").trim();
  if (escaped.length === 0) return listRecentProducts(24);
  return searchPublished(escaped.toLowerCase());
}

/** Cached search body — the normalized term is the cache key (ilike is CI). */
async function searchPublished(term: string): Promise<ProductSummary[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  const like = `%${term}%`;
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(SUMMARY_SELECT)
    .eq("status", "published")
    .or(`title_en.ilike.${like},title_bn.ilike.${like}`)
    .order("updated_at", { ascending: false })
    .limit(48);
  if (error) throw new Error("Search failed.", { cause: error });
  return ((data ?? []) as unknown as SummaryRow[]).map(toSummary);
}

// ------------------------------------------------------------ full product ----

export type PublicVariant = {
  id: string;
  sku: string;
  color_name: string | null;
  color_hex: string | null;
  texture_path: string | null;
  size: string | null;
  price_delta: number;
  stock_qty: number;
  reserved_qty: number;
};

export type PublicTier = {
  min_qty: number;
  max_qty: number | null;
  unit_price: number;
};

export type PublicImage = {
  path: string;
  alt_en: string | null;
  alt_bn: string | null;
  variant_id: string | null;
};

export type PublicPartSwatch = {
  swatch_id: string;
  is_default: boolean;
  price_delta: number | null;
  name_en: string | null;
  name_bn: string | null;
  color_hex: string | null;
  texture_path: string | null;
};

export type PublicCustomPart = {
  id: string;
  key: string;
  label_en: string;
  label_bn: string | null;
  input_type: InputType;
  is_required: boolean;
  price_delta: number;
  config: unknown;
  help_text_en: string | null;
  help_text_bn: string | null;
  sort_order: number;
  allowed_swatches: PublicPartSwatch[];
};

export type PublicProduct = {
  slug: string;
  type: ProductType;
  title_en: string;
  title_bn: string | null;
  short_description_en: string | null;
  short_description_bn: string | null;
  description_en: string | null;
  description_bn: string | null;
  material: string | null;
  specs: unknown;
  moq: number;
  lead_time_days: number | null;
  stock_mode: StockMode;
  customization_enabled: boolean;
  is_featured: boolean;
  seo_title_en: string | null;
  seo_title_bn: string | null;
  seo_description_en: string | null;
  seo_description_bn: string | null;
  images: PublicImage[];
  variants: PublicVariant[];
  tiers: PublicTier[];
  categories: {
    id: string;
    slug: string;
    name_en: string;
    name_bn: string | null;
  }[];
  customParts: PublicCustomPart[];
};

const PRODUCT_SELECT = `
  id, slug, type, title_en, title_bn, short_description_en, short_description_bn,
  description_en, description_bn, material, specs, moq, lead_time_days, stock_mode,
  customization_enabled, is_featured,
  seo_title_en, seo_title_bn, seo_description_en, seo_description_bn,
  product_images ( path, alt_en, alt_bn, sort_order, variant_id ),
  product_variants ( id, sku, swatch_id, color_name, color_hex, size, price_delta, stock_qty, reserved_qty, is_active ),
  price_tiers ( min_qty, max_qty, unit_price ),
  product_categories ( is_primary, categories ( id, slug, name_en, name_bn ) ),
  product_custom_parts ( id, key, label_en, label_bn, input_type, is_required, price_delta, config, help_text_en, help_text_bn, sort_order,
    product_part_swatches ( swatch_id, is_default, price_delta ) )
`;

type SwatchLite = {
  id: string;
  name_en: string;
  name_bn: string | null;
  color_hex: string;
  texture_image_path: string | null;
};

async function getSwatchMap(): Promise<Map<string, SwatchLite>> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("swatches")
    .select("id, name_en, name_bn, color_hex, texture_image_path")
    .eq("is_active", true);
  const map = new Map<string, SwatchLite>();
  for (const s of (data ?? []) as SwatchLite[]) map.set(s.id, s);
  return map;
}

export async function getProductBySlug(
  slug: string,
): Promise<PublicProduct | null> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog, CACHE_TAGS.product(slug));
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Failed to load the product.", { cause: error });
  if (!data) return null;

  const raw = data as unknown as {
    id: string;
    slug: string;
    type: ProductType;
    title_en: string;
    title_bn: string | null;
    short_description_en: string | null;
    short_description_bn: string | null;
    description_en: string | null;
    description_bn: string | null;
    material: string | null;
    specs: unknown;
    moq: unknown;
    lead_time_days: unknown;
    stock_mode: StockMode;
    customization_enabled: boolean;
    is_featured: boolean;
    seo_title_en: string | null;
    seo_title_bn: string | null;
    seo_description_en: string | null;
    seo_description_bn: string | null;
    product_images:
      | {
          path: string;
          alt_en: string | null;
          alt_bn: string | null;
          sort_order: unknown;
          variant_id: string | null;
        }[]
      | null;
    product_variants:
      | {
          id: string;
          sku: string;
          swatch_id: string | null;
          color_name: string | null;
          color_hex: string | null;
          size: string | null;
          price_delta: unknown;
          stock_qty: unknown;
          reserved_qty: unknown;
          is_active: boolean;
        }[]
      | null;
    price_tiers:
      | { min_qty: unknown; max_qty: unknown; unit_price: unknown }[]
      | null;
    product_categories:
      | {
          is_primary: boolean;
          categories: {
            id: string;
            slug: string;
            name_en: string;
            name_bn: string | null;
          } | null;
        }[]
      | null;
    product_custom_parts:
      | {
          id: string;
          key: string;
          label_en: string;
          label_bn: string | null;
          input_type: InputType;
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
        }[]
      | null;
  };

  const swatchMap = await getSwatchMap();

  const variants: PublicVariant[] = (raw.product_variants ?? [])
    .filter((v) => v.is_active)
    .sort((a, b) => a.sku.localeCompare(b.sku))
    .map((v) => ({
      id: v.id,
      sku: v.sku,
      color_name: v.color_name,
      color_hex: v.color_hex,
      texture_path: v.swatch_id
        ? (swatchMap.get(v.swatch_id)?.texture_image_path ?? null)
        : null,
      size: v.size,
      price_delta: num(v.price_delta),
      stock_qty: num(v.stock_qty),
      reserved_qty: num(v.reserved_qty),
    }));

  const tiers: PublicTier[] = (raw.price_tiers ?? [])
    .sort((a, b) => num(a.min_qty) - num(b.min_qty))
    .map((t) => ({
      min_qty: num(t.min_qty),
      max_qty: t.max_qty == null ? null : num(t.max_qty),
      unit_price: num(t.unit_price),
    }));

  const images: PublicImage[] = (raw.product_images ?? [])
    .sort((a, b) => num(a.sort_order) - num(b.sort_order))
    .map((im) => ({
      path: im.path,
      alt_en: im.alt_en,
      alt_bn: im.alt_bn,
      variant_id: im.variant_id,
    }));

  const categories = (raw.product_categories ?? [])
    .map((c) => c.categories)
    .filter(
      (
        c,
      ): c is {
        id: string;
        slug: string;
        name_en: string;
        name_bn: string | null;
      } => Boolean(c),
    );

  const customParts: PublicCustomPart[] = (raw.product_custom_parts ?? [])
    .sort((a, b) => num(a.sort_order) - num(b.sort_order))
    .map((p) => ({
      id: p.id,
      key: p.key,
      label_en: p.label_en,
      label_bn: p.label_bn,
      input_type: p.input_type,
      is_required: p.is_required,
      price_delta: num(p.price_delta),
      config: p.config ?? {},
      help_text_en: p.help_text_en,
      help_text_bn: p.help_text_bn,
      sort_order: num(p.sort_order),
      allowed_swatches: (p.product_part_swatches ?? []).map((s) => {
        const sw = swatchMap.get(s.swatch_id);
        return {
          swatch_id: s.swatch_id,
          is_default: s.is_default,
          price_delta: s.price_delta == null ? null : num(s.price_delta),
          name_en: sw?.name_en ?? null,
          name_bn: sw?.name_bn ?? null,
          color_hex: sw?.color_hex ?? null,
          texture_path: sw?.texture_image_path ?? null,
        };
      }),
    }));

  return {
    slug: raw.slug,
    type: raw.type,
    title_en: raw.title_en,
    title_bn: raw.title_bn,
    short_description_en: raw.short_description_en,
    short_description_bn: raw.short_description_bn,
    description_en: raw.description_en,
    description_bn: raw.description_bn,
    material: raw.material,
    specs: raw.specs ?? null,
    moq: num(raw.moq),
    lead_time_days: raw.lead_time_days == null ? null : num(raw.lead_time_days),
    stock_mode: raw.stock_mode,
    customization_enabled: raw.customization_enabled,
    is_featured: raw.is_featured,
    seo_title_en: raw.seo_title_en,
    seo_title_bn: raw.seo_title_bn,
    seo_description_en: raw.seo_description_en,
    seo_description_bn: raw.seo_description_bn,
    images,
    variants,
    tiers,
    categories,
    customParts,
  } satisfies PublicProduct;
}

/** Related products: published items sharing any category, excluding the slug. */
export async function getRelatedProducts(
  categoryIds: string[],
  excludeSlug: string,
  limit = 4,
): Promise<ProductSummary[]> {
  if (categoryIds.length === 0) return [];
  const supabase = createPublicClient();
  const { data: links } = await supabase
    .from("product_categories")
    .select("product_id")
    .in("category_id", categoryIds);
  const ids = (links ?? [])
    .map((l: { product_id: string }) => l.product_id)
    .filter(Boolean);
  const found = await fetchProductsByIds(ids, limit + 1);
  return found.filter((p) => p.slug !== excludeSlug).slice(0, limit);
}

// ----------------------------------------------------------- picker options ----

export type ProductOption = {
  id: string;
  slug: string;
  title_en: string;
  title_bn: string | null;
};
export type CategoryOption = {
  id: string;
  name_en: string;
  name_bn: string | null;
};

/** id + bilingual title for the quote form's product picker. */
export async function listProductOptions(): Promise<ProductOption[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, title_en, title_bn")
    .eq("status", "published")
    .order("title_en");
  if (error)
    throw new Error("Failed to load product options.", { cause: error });
  return (data ?? []) as ProductOption[];
}

export async function listCategoryOptions(): Promise<CategoryOption[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name_en, name_bn")
    .eq("is_active", true)
    .order("name_en");
  if (error)
    throw new Error("Failed to load category options.", { cause: error });
  return (data ?? []) as CategoryOption[];
}

// ---------------------------------------------------------------- swatches ----

export type BuilderSwatch = {
  id: string;
  name_en: string;
  name_bn: string | null;
  color_hex: string | null;
};

export type SwatchGroup = {
  id: string;
  key: string;
  name_en: string;
  name_bn: string | null;
  swatches: BuilderSwatch[];
};

/** Groups + their active swatches for the builder's color pickers. */
export async function listSwatchGroups(): Promise<SwatchGroup[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  const supabase = createPublicClient();
  const [{ data: groups, error: gErr }, { data: swatches, error: sErr }] =
    await Promise.all([
      supabase
        .from("swatch_groups")
        .select("id, key, name_en, name_bn, sort_order")
        .order("sort_order"),
      supabase
        .from("swatches")
        .select("id, group_id, name_en, name_bn, color_hex, sort_order")
        .eq("is_active", true)
        .order("sort_order"),
    ]);
  if (gErr) throw new Error("Failed to load swatch groups.", { cause: gErr });
  if (sErr) throw new Error("Failed to load swatches.", { cause: sErr });

  const byGroup = new Map<string, BuilderSwatch[]>();
  for (const s of (swatches ?? []) as (BuilderSwatch & {
    group_id: string;
  })[]) {
    const list = byGroup.get(s.group_id) ?? [];
    list.push({
      id: s.id,
      name_en: s.name_en,
      name_bn: s.name_bn,
      color_hex: s.color_hex,
    });
    byGroup.set(s.group_id, list);
  }

  return (
    (groups ?? []) as {
      id: string;
      key: string;
      name_en: string;
      name_bn: string | null;
    }[]
  ).map((g) => ({ ...g, swatches: byGroup.get(g.id) ?? [] }));
}

// ------------------------------------------------------------------ sitemap ----

export type SitemapEntry = { slug: string; updated_at: string };

/** Every published product slug for the XML sitemap (plan 8 SEO). */
export async function listSitemapProducts(): Promise<SitemapEntry[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug, updated_at")
    .eq("status", "published")
    .order("updated_at", { ascending: false });
  if (error)
    throw new Error("Failed to load sitemap products.", { cause: error });
  return (data ?? []) as SitemapEntry[];
}

/** Every active category slug (all levels) for the XML sitemap. */
export async function listSitemapCategories(): Promise<string[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("slug")
    .eq("is_active", true);
  if (error)
    throw new Error("Failed to load sitemap categories.", { cause: error });
  return ((data ?? []) as { slug: string }[]).map((r) => r.slug);
}

/** Every active collection slug for the XML sitemap. */
export async function listSitemapCollections(): Promise<string[]> {
  "use cache";
  cacheLife("catalog");
  cacheTag(CACHE_TAGS.catalog);
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("collections")
    .select("slug")
    .eq("is_active", true);
  if (error)
    throw new Error("Failed to load sitemap collections.", { cause: error });
  return ((data ?? []) as { slug: string }[]).map((r) => r.slug);
}
