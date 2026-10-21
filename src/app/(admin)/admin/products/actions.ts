"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { requireRole } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/cache-tags";
import type { Database } from "@/lib/database.types";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";
import {
  bulkStatusSchema,
  productCreateSchema,
  productGeneralSchema,
  productSeoSchema,
  productStatusSchema,
  saveCustomPartsSchema,
  saveImagesSchema,
  savePriceTiersSchema,
  saveVariantsSchema,
  setCategoriesSchema,
  setCollectionsSchema,
  type CustomPartInput,
  type PriceTierInput,
  type ProductCreateInput,
  type ProductGeneralInput,
  type ProductImageInput,
  type ProductSeoInput,
  type VariantInput,
} from "@/lib/validators/product";

/**
 * Server actions for the Products module (plan 9c.8, AGENTS working rule 6 and
 * the admin mutation rule). Every action: (1) checks the role with
 * `requireRole`, (2) re-validates the payload with zod on the server, (3) writes
 * through the cookie-session Supabase client so `has_role()` RLS is the last
 * line of defense, then (4) revalidates the affected routes. Money and stock are
 * always taken from the validated server payload, never trusted from the client.
 *
 * Child rows (tiers, variants, images, categories, collections, custom parts) are
 * saved with dedicated "replace" actions: the caller sends the full desired set,
 * we delete the current rows and re-insert. All child FKs are `on delete cascade`
 * from `products`, and `product_part_swatches` cascades from its part, so a
 * product delete cleans up everything.
 */

const CATALOG_ROLES = ["owner", "manager", "inventory"] as const;

export type ProductActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function firstError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "The form has errors.";
}

type AuthorizeResult =
  | { ok: true; actorId: string }
  | { ok: false; error: string };

async function authorize(): Promise<AuthorizeResult> {
  try {
    return { ok: true, actorId: (await requireRole(CATALOG_ROLES)).id };
  } catch {
    return {
      ok: false,
      error: "You are not authorized to manage products.",
    };
  }
}

/**
 * Revalidate both the list and the editor after any product-scoped write, and
 * expire the public `catalog` cache tag (plan 3b) — a product edit changes the
 * home rails, nav, search, listings and its own detail page, all of which carry
 * the `catalog` tag, so one call refreshes the whole public site. The product's
 * own `product:{slug}` entry is tagged `catalog` too, so it is covered here.
 */
function touch(productId?: string) {
  revalidatePath("/admin/products");
  if (productId) revalidatePath(`/admin/products/${productId}`);
  revalidateTag(CACHE_TAGS.catalog, "max");
}

/** Lowercased, hyphenated slug from a base string, with a uniqueness suffix. */
async function ensureUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || "product";
  let candidate = root;
  for (let i = 2; i <= 50; i += 1) {
    const { data } = await supabase
      .from("products")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data || data.id === excludeId) return candidate;
    candidate = `${root}-${i}`;
  }
  return candidate;
}

// ------------------------------------------------------------------ create --

export async function createProduct(
  payload: ProductCreateInput,
): Promise<ProductActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const actorId = auth.actorId;

  const parsed = productCreateSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const slug = await ensureUniqueSlug(supabase, parsed.data.title_en);
  const { data, error } = await supabase
    .from("products")
    .insert({
      slug,
      title_en: parsed.data.title_en,
      title_bn: parsed.data.title_bn ?? null,
      type: parsed.data.type,
      status: parsed.data.status,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: "Could not create the product." };
  }
  await logAudit(supabase, {
    actorId,
    action: "product.create",
    tableName: "products",
    recordId: data.id,
    diff: { slug, status: parsed.data.status },
  });
  touch(data.id);
  return { ok: true, id: data.id };
}

// ----------------------------------------------------------------- general --

function toGeneralRow(input: ProductGeneralInput, slug: string) {
  return {
    slug,
    title_en: input.title_en,
    title_bn: input.title_bn ?? null,
    short_description_en: input.short_description_en ?? null,
    short_description_bn: input.short_description_bn ?? null,
    description_en: input.description_en ?? null,
    description_bn: input.description_bn ?? null,
    material: input.material ?? null,
    type: input.type,
    stock_mode: input.stock_mode,
    moq: input.moq,
    lead_time_days: input.lead_time_days ?? null,
    customization_enabled: input.customization_enabled,
    is_featured: input.is_featured,
    status: input.status,
  };
}

export async function saveProductGeneral(
  id: string,
  payload: ProductGeneralInput,
): Promise<ProductActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const actorId = auth.actorId;

  const parsed = productGeneralSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (!productStatusSchema.shape.id.safeParse(id).success) {
    return { ok: false, error: "Invalid product." };
  }

  const supabase = await createClient();
  const slug = await ensureUniqueSlug(
    supabase,
    parsed.data.slug || parsed.data.title_en,
    id,
  );
  const { error } = await supabase
    .from("products")
    .update(toGeneralRow(parsed.data, slug))
    .eq("id", id);
  if (error) return { ok: false, error: "Could not save the product." };
  await logAudit(supabase, {
    actorId,
    action: "product.update",
    tableName: "products",
    recordId: id,
    diff: { slug, status: parsed.data.status },
  });
  touch(id);
  return { ok: true, id };
}

// --------------------------------------------------------------------- seo --

export async function saveProductSeo(
  id: string,
  payload: ProductSeoInput,
): Promise<ProductActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const actorId = auth.actorId;

  const parsed = productSeoSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  if (!productStatusSchema.shape.id.safeParse(id).success) {
    return { ok: false, error: "Invalid product." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({
      seo_title_en: parsed.data.seo_title_en ?? null,
      seo_title_bn: parsed.data.seo_title_bn ?? null,
      seo_description_en: parsed.data.seo_description_en ?? null,
      seo_description_bn: parsed.data.seo_description_bn ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not save the SEO fields." };
  await logAudit(supabase, {
    actorId,
    action: "product.seo",
    tableName: "products",
    recordId: id,
    diff: { fields: ["seo_title", "seo_description"] },
  });
  touch(id);
  return { ok: true, id };
}

// ------------------------------------------------------------------ status --

export async function setProductStatus(
  id: string,
  status: "draft" | "published" | "archived",
): Promise<ProductActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const actorId = auth.actorId;

  const parsed = productStatusSchema.safeParse({ id, status });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: "Could not change the status." };
  await logAudit(supabase, {
    actorId,
    action: "product.status",
    tableName: "products",
    recordId: parsed.data.id,
    diff: { status: parsed.data.status },
  });
  touch(parsed.data.id);
  return { ok: true };
}

export async function bulkSetProductStatus(
  ids: string[],
  status: "draft" | "published" | "archived",
): Promise<ProductActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const actorId = auth.actorId;

  const parsed = bulkStatusSchema.safeParse({ ids, status });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ status })
    .in("id", parsed.data.ids);
  if (error)
    return { ok: false, error: "Could not update the selected products." };
  await logAudit(supabase, {
    actorId,
    action: "product.bulk_status",
    tableName: "products",
    diff: { count: parsed.data.ids.length, status },
  });
  touch();
  return { ok: true };
}

// ------------------------------------------------------------------ delete --

export async function deleteProduct(id: string): Promise<ProductActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const actorId = auth.actorId;
  if (!productStatusSchema.shape.id.safeParse(id).success) {
    return { ok: false, error: "Invalid product." };
  }

  const supabase = await createClient();
  const { data: self } = await supabase
    .from("products")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!self) return { ok: false, error: "Product not found." };

  // Every child FK cascades on delete, so this removes tiers, variants, images,
  // category/collection joins, custom parts and their swatch allow-lists.
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the product." };
  await logAudit(supabase, {
    actorId,
    action: "product.delete",
    tableName: "products",
    recordId: id,
  });
  revalidatePath("/admin/products");
  revalidateTag(CACHE_TAGS.catalog, "max");
  return { ok: true };
}

// ------------------------------------------------- children: replace sets --

export async function savePriceTiers(
  productId: string,
  tiers: PriceTierInput[],
): Promise<ProductActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const actorId = auth.actorId;

  const parsed = savePriceTiersSchema.safeParse({
    product_id: productId,
    tiers,
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error: del } = await supabase
    .from("price_tiers")
    .delete()
    .eq("product_id", productId);
  if (del) return { ok: false, error: "Could not save the price tiers." };

  if (parsed.data.tiers.length > 0) {
    const rows = parsed.data.tiers.map((t) => ({
      product_id: productId,
      min_qty: t.min_qty,
      max_qty: t.max_qty ?? null,
      unit_price: t.unit_price,
    }));
    const { error: ins } = await supabase.from("price_tiers").insert(rows);
    if (ins) return { ok: false, error: "Could not save the price tiers." };
  }
  await logAudit(supabase, {
    actorId,
    action: "product.tiers",
    tableName: "products",
    recordId: productId,
    diff: { count: parsed.data.tiers.length },
  });
  touch(productId);
  return { ok: true };
}

export async function saveVariants(
  productId: string,
  variants: VariantInput[],
): Promise<ProductActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const actorId = auth.actorId;

  const parsed = saveVariantsSchema.safeParse({
    product_id: productId,
    variants,
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  // `sku` is globally unique in the schema, so reject a duplicate inside the batch
  // before the insert would fail opaquely.
  const seen = new Set<string>();
  for (const v of parsed.data.variants) {
    if (seen.has(v.sku)) {
      return {
        ok: false,
        error: `Duplicate SKU “${v.sku}” in the variant list.`,
      };
    }
    seen.add(v.sku);
  }

  const supabase = await createClient();
  const { error: del } = await supabase
    .from("product_variants")
    .delete()
    .eq("product_id", productId);
  if (del) return { ok: false, error: "Could not save the variants." };

  if (parsed.data.variants.length > 0) {
    const rows = parsed.data.variants.map((v) => ({
      product_id: productId,
      sku: v.sku,
      swatch_id: v.swatch_id ?? null,
      color_name: v.color_name ?? null,
      color_hex: v.color_hex ?? null,
      size: v.size ?? null,
      price_delta: v.price_delta,
      stock_qty: v.stock_qty,
      reserved_qty: v.reserved_qty,
      low_stock_threshold: v.low_stock_threshold,
      is_active: v.is_active,
    }));
    const { error: ins } = await supabase.from("product_variants").insert(rows);
    if (ins) {
      if (ins.code === "23505") {
        return {
          ok: false,
          error: "One or more SKUs already exist on another product.",
        };
      }
      return { ok: false, error: "Could not save the variants." };
    }
  }
  await logAudit(supabase, {
    actorId,
    action: "product.variants",
    tableName: "products",
    recordId: productId,
    diff: { count: parsed.data.variants.length },
  });
  touch(productId);
  return { ok: true };
}

export async function saveImages(
  productId: string,
  images: ProductImageInput[],
): Promise<ProductActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const actorId = auth.actorId;

  const parsed = saveImagesSchema.safeParse({ product_id: productId, images });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error: del } = await supabase
    .from("product_images")
    .delete()
    .eq("product_id", productId);
  if (del) return { ok: false, error: "Could not save the images." };

  if (parsed.data.images.length > 0) {
    const rows = parsed.data.images.map((im, i) => ({
      product_id: productId,
      path: im.path,
      alt_en: im.alt_en ?? null,
      alt_bn: im.alt_bn ?? null,
      sort_order: im.sort_order ?? i,
      variant_id: im.variant_id ?? null,
    }));
    const { error: ins } = await supabase.from("product_images").insert(rows);
    if (ins) return { ok: false, error: "Could not save the images." };
  }
  await logAudit(supabase, {
    actorId,
    action: "product.images",
    tableName: "products",
    recordId: productId,
    diff: { count: parsed.data.images.length },
  });
  touch(productId);
  return { ok: true };
}

export async function setProductCategories(
  productId: string,
  categories: { category_id: string; is_primary: boolean }[],
): Promise<ProductActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const actorId = auth.actorId;

  const parsed = setCategoriesSchema.safeParse({
    product_id: productId,
    categories,
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  // At most one primary category.
  if (parsed.data.categories.filter((c) => c.is_primary).length > 1) {
    return { ok: false, error: "Only one primary category is allowed." };
  }

  const supabase = await createClient();
  const { error: del } = await supabase
    .from("product_categories")
    .delete()
    .eq("product_id", productId);
  if (del) return { ok: false, error: "Could not save the categories." };

  if (parsed.data.categories.length > 0) {
    const rows = parsed.data.categories.map((c) => ({
      product_id: productId,
      category_id: c.category_id,
      is_primary: c.is_primary,
    }));
    const { error: ins } = await supabase
      .from("product_categories")
      .insert(rows);
    if (ins) return { ok: false, error: "Could not save the categories." };
  }
  await logAudit(supabase, {
    actorId,
    action: "product.categories",
    tableName: "products",
    recordId: productId,
    diff: { count: parsed.data.categories.length },
  });
  touch(productId);
  return { ok: true };
}

export async function setProductCollections(
  productId: string,
  collectionIds: string[],
): Promise<ProductActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const actorId = auth.actorId;

  const parsed = setCollectionsSchema.safeParse({
    product_id: productId,
    collection_ids: collectionIds,
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error: del } = await supabase
    .from("product_collections")
    .delete()
    .eq("product_id", productId);
  if (del) return { ok: false, error: "Could not save the collections." };

  if (parsed.data.collection_ids.length > 0) {
    const rows = parsed.data.collection_ids.map((collection_id) => ({
      product_id: productId,
      collection_id,
    }));
    const { error: ins } = await supabase
      .from("product_collections")
      .insert(rows);
    if (ins) return { ok: false, error: "Could not save the collections." };
  }
  await logAudit(supabase, {
    actorId,
    action: "product.collections",
    tableName: "products",
    recordId: productId,
    diff: { count: parsed.data.collection_ids.length },
  });
  touch(productId);
  return { ok: true };
}

export async function saveCustomParts(
  productId: string,
  parts: CustomPartInput[],
): Promise<ProductActionResult> {
  const auth = await authorize();
  if (!auth.ok) return auth;
  const actorId = auth.actorId;

  const parsed = saveCustomPartsSchema.safeParse({
    product_id: productId,
    parts,
  });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };

  const supabase = await createClient();
  // Deleting parts cascades their `product_part_swatches` rows.
  const { error: del } = await supabase
    .from("product_custom_parts")
    .delete()
    .eq("product_id", productId);
  if (del) return { ok: false, error: "Could not save the builder parts." };

  for (const part of parsed.data.parts) {
    const { data: created, error: ins } = await supabase
      .from("product_custom_parts")
      .insert({
        product_id: productId,
        key: part.key,
        label_en: part.label_en,
        label_bn: part.label_bn ?? null,
        input_type: part.input_type,
        swatch_group_id: part.swatch_group_id ?? null,
        is_required: part.is_required,
        price_delta: part.price_delta,
        config:
          part.config as unknown as Database["public"]["Tables"]["product_custom_parts"]["Insert"]["config"],
        help_text_en: part.help_text_en ?? null,
        help_text_bn: part.help_text_bn ?? null,
        sort_order: part.sort_order,
      })
      .select("id")
      .single();
    if (ins || !created) {
      return { ok: false, error: "Could not save the builder parts." };
    }

    if (part.allowed_swatches.length > 0) {
      // De-duplicate swatches (join is unique on part_id + swatch_id) and keep
      // only the first row per swatch.
      const bySwatch = new Map<
        string,
        (typeof part.allowed_swatches)[number]
      >();
      for (const s of part.allowed_swatches) {
        if (!bySwatch.has(s.swatch_id)) bySwatch.set(s.swatch_id, s);
      }
      const swatchRows = [...bySwatch.values()].map((s) => ({
        part_id: created.id,
        swatch_id: s.swatch_id,
        is_default: s.is_default,
        price_delta: s.price_delta ?? null,
      }));
      const { error: sIns } = await supabase
        .from("product_part_swatches")
        .insert(swatchRows);
      if (sIns) {
        return { ok: false, error: "Could not save the part swatches." };
      }
    }
  }
  await logAudit(supabase, {
    actorId,
    action: "product.custom_parts",
    tableName: "products",
    recordId: productId,
    diff: { count: parsed.data.parts.length },
  });
  touch(productId);
  return { ok: true };
}
