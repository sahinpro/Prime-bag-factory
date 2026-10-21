"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { requireRole } from "@/lib/auth";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";
import {
  categoryInputSchema,
  categoryReorderSchema,
  categoryUpdateSchema,
  type CategoryInput,
} from "@/lib/validators/category";

const CATALOG_ROLES = ["owner", "manager"] as const;

export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function firstError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "The form has errors.";
}

/** Lowercased, hyphenated slug from the English name, with a uniqueness suffix. */
async function ensureUniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || "category";
  let candidate = root;
  for (let i = 2; i <= 50; i += 1) {
    const { data } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data || data.id === excludeId) return candidate;
    candidate = `${root}-${i}`;
  }
  return candidate;
}

function toRow(input: CategoryInput, slug: string) {
  return {
    slug,
    name_en: input.name_en,
    name_bn: input.name_bn ?? null,
    description_en: input.description_en ?? null,
    description_bn: input.description_bn ?? null,
    seo_title_en: input.seo_title_en ?? null,
    seo_title_bn: input.seo_title_bn ?? null,
    seo_description_en: input.seo_description_en ?? null,
    seo_description_bn: input.seo_description_bn ?? null,
    image_path: input.image_path ?? null,
    parent_id: input.parent_id ? input.parent_id : null,
    sort_order: input.sort_order,
    is_active: input.is_active,
  };
}

export async function saveCategory(
  payload: CategoryInput & { id?: string },
): Promise<ActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(CATALOG_ROLES)).id;
  } catch {
    return { ok: false, error: "You are not authorized to manage categories." };
  }

  const supabase = await createClient();

  if (payload.id) {
    const parsed = categoryUpdateSchema.safeParse(payload);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const input = parsed.data;
    const slug = await ensureUniqueSlug(
      supabase,
      input.slug || input.name_en,
      input.id,
    );
    const { data, error } = await supabase
      .from("categories")
      .update(toRow(input, slug))
      .eq("id", input.id)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: "Could not save the category." };
    await logAudit(supabase, {
      actorId,
      action: "category.update",
      tableName: "categories",
      recordId: input.id,
      diff: { slug, is_active: input.is_active, parent_id: input.parent_id ?? null },
    });
    revalidatePath("/admin/categories");
      revalidateTag(CACHE_TAGS.catalog, "max");
    return { ok: true, id: data?.id };
  }

  const parsed = categoryInputSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;
  const slug = await ensureUniqueSlug(supabase, input.slug || input.name_en);
  const { data, error } = await supabase
    .from("categories")
    .insert(toRow(input, slug))
    .select("id")
    .single();
  if (error) return { ok: false, error: "Could not create the category." };
  await logAudit(supabase, {
    actorId,
    action: "category.create",
    tableName: "categories",
    recordId: data.id,
    diff: { slug, is_active: input.is_active },
  });
  revalidatePath("/admin/categories");
    revalidateTag(CACHE_TAGS.catalog, "max");
  return { ok: true, id: data.id };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  if (!categoryUpdateSchema.shape.id.safeParse(id).success) {
    return { ok: false, error: "Invalid category." };
  }
  let actorId: string;
  try {
    actorId = (await requireRole(CATALOG_ROLES)).id;
  } catch {
    return { ok: false, error: "You are not authorized to manage categories." };
  }

  const supabase = await createClient();

  // Reparent direct children to this node's parent so the FK is not blocked.
  const { data: self } = await supabase
    .from("categories")
    .select("parent_id")
    .eq("id", id)
    .maybeSingle();
  if (!self) return { ok: false, error: "Category not found." };

  await supabase
    .from("categories")
    .update({ parent_id: self.parent_id })
    .eq("parent_id", id);

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) {
    // A FK violation here means products still reference this category.
    return {
      ok: false,
      error:
        "This category is still used by products. Remove those links first.",
    };
  }

  await logAudit(supabase, {
    actorId,
    action: "category.delete",
    tableName: "categories",
    recordId: id,
  });

  revalidatePath("/admin/categories");
    revalidateTag(CACHE_TAGS.catalog, "max");
  return { ok: true };
}

export async function reorderCategories(
  orderedIds: string[],
): Promise<ActionResult> {
  const parsed = categoryReorderSchema.safeParse({ orderedIds });
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  let actorId: string;
  try {
    actorId = (await requireRole(CATALOG_ROLES)).id;
  } catch {
    return { ok: false, error: "You are not authorized to manage categories." };
  }

  const supabase = await createClient();

  // `sort_order` is only compared between siblings, so number each category by
  // its position *within its own parent* as it appears in the flattened order
  // (the client only ever emits sibling moves, keeping the list a valid DFS).
  const { data: rows, error: readError } = await supabase
    .from("categories")
    .select("id, parent_id")
    .in("id", parsed.data.orderedIds);
  if (readError) return { ok: false, error: "Could not save the new order." };
  const parentOf = new Map<string, string | null>(
    (rows ?? []).map((r) => [r.id, r.parent_id ?? null]),
  );

  const seenPerParent = new Map<string | null, number>();
  for (const id of parsed.data.orderedIds) {
    const parent = parentOf.get(id) ?? null;
    const next = seenPerParent.get(parent) ?? 0;
    seenPerParent.set(parent, next + 1);
    const { error } = await supabase
      .from("categories")
      .update({ sort_order: next })
      .eq("id", id);
    if (error) return { ok: false, error: "Could not save the new order." };
  }

  await logAudit(supabase, {
    actorId,
    action: "category.reorder",
    tableName: "categories",
    diff: { count: parsed.data.orderedIds.length },
  });

  revalidatePath("/admin/categories");
    revalidateTag(CACHE_TAGS.catalog, "max");
  return { ok: true };
}
