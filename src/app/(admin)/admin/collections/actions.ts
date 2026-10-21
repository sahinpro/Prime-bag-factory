"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { slugify } from "@/lib/slug";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";
import {
  collectionInputSchema,
  collectionUpdateSchema,
  type CollectionInput,
} from "@/lib/validators/collection";

const CATALOG_ROLES = ["owner", "manager"] as const;

export type CollectionActionResult =
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
  const root = slugify(base) || "collection";
  let candidate = root;
  for (let i = 2; i <= 50; i += 1) {
    const { data } = await supabase
      .from("collections")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data || data.id === excludeId) return candidate;
    candidate = `${root}-${i}`;
  }
  return candidate;
}

function toRow(input: CollectionInput, slug: string) {
  return {
    slug,
    name_en: input.name_en,
    name_bn: input.name_bn ?? null,
    description_en: input.description_en ?? null,
    description_bn: input.description_bn ?? null,
    image_path: input.image_path ?? null,
    sort_order: input.sort_order,
    is_active: input.is_active,
  };
}

export async function saveCollection(
  payload: CollectionInput & { id?: string },
): Promise<CollectionActionResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(CATALOG_ROLES)).id;
  } catch {
    return {
      ok: false,
      error: "You are not authorized to manage collections.",
    };
  }

  const supabase = await createClient();

  if (payload.id) {
    const parsed = collectionUpdateSchema.safeParse(payload);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const input = parsed.data;
    const slug = await ensureUniqueSlug(
      supabase,
      input.slug || input.name_en,
      input.id,
    );
    const { data, error } = await supabase
      .from("collections")
      .update(toRow(input, slug))
      .eq("id", input.id)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: "Could not save the collection." };
    await logAudit(supabase, {
      actorId,
      action: "collection.update",
      tableName: "collections",
      recordId: input.id,
      diff: { slug, is_active: input.is_active },
    });
    revalidatePath("/admin/collections");
    return { ok: true, id: data?.id };
  }

  const parsed = collectionInputSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;
  const slug = await ensureUniqueSlug(supabase, input.slug || input.name_en);
  const { data, error } = await supabase
    .from("collections")
    .insert(toRow(input, slug))
    .select("id")
    .single();
  if (error) return { ok: false, error: "Could not create the collection." };
  await logAudit(supabase, {
    actorId,
    action: "collection.create",
    tableName: "collections",
    recordId: data.id,
    diff: { slug, is_active: input.is_active },
  });
  revalidatePath("/admin/collections");
  return { ok: true, id: data.id };
}

export async function deleteCollection(
  id: string,
): Promise<CollectionActionResult> {
  if (!collectionUpdateSchema.shape.id.safeParse(id).success) {
    return { ok: false, error: "Invalid collection." };
  }
  let actorId: string;
  try {
    actorId = (await requireRole(CATALOG_ROLES)).id;
  } catch {
    return {
      ok: false,
      error: "You are not authorized to manage collections.",
    };
  }

  const supabase = await createClient();

  const { data: self } = await supabase
    .from("collections")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!self) return { ok: false, error: "Collection not found." };

  // `product_collections.collection_id` cascades on delete, so linked products
  // simply drop the tag; the delete itself is never blocked by that FK.
  const { error } = await supabase.from("collections").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the collection." };

  await logAudit(supabase, {
    actorId,
    action: "collection.delete",
    tableName: "collections",
    recordId: id,
  });

  revalidatePath("/admin/collections");
  return { ok: true };
}
