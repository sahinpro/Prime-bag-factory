"use server";

import { revalidatePath } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  swatchGroupInputSchema,
  swatchGroupUpdateSchema,
  swatchInputSchema,
  swatchUpdateSchema,
  type SwatchGroupInput,
  type SwatchInput,
} from "@/lib/validators/swatch";

const CATALOG_ROLES = ["owner", "manager"] as const;

export type SwatchActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function firstError(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "The form has errors.";
}

/** Total references to these swatches across variants and builder part-swatches. */
async function countSwatchReferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  swatchIds: string[],
): Promise<number> {
  if (swatchIds.length === 0) return 0;
  const [variants, parts] = await Promise.all([
    supabase
      .from("product_variants")
      .select("id", { count: "exact", head: true })
      .in("swatch_id", swatchIds),
    supabase
      .from("product_part_swatches")
      .select("id", { count: "exact", head: true })
      .in("swatch_id", swatchIds),
  ]);
  return (variants.count ?? 0) + (parts.count ?? 0);
}

// ---------------------------------------------------------------- groups ----

export async function saveSwatchGroup(
  payload: SwatchGroupInput & { id?: string },
): Promise<SwatchActionResult> {
  try {
    await requireRole(CATALOG_ROLES);
  } catch {
    return { ok: false, error: "You are not authorized to manage swatches." };
  }

  const parsed = payload.id
    ? swatchGroupUpdateSchema.safeParse(payload)
    : swatchGroupInputSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  const supabase = await createClient();

  // `key` is unique and machine-chosen, so reject a duplicate rather than suffix it.
  const { data: clash } = await supabase
    .from("swatch_groups")
    .select("id")
    .eq("key", input.key)
    .maybeSingle();
  if (clash && clash.id !== payload.id) {
    return { ok: false, error: "That key is already used by another group." };
  }

  const row = {
    key: input.key,
    name_en: input.name_en,
    name_bn: input.name_bn ?? null,
    sort_order: input.sort_order,
  };

  if (payload.id) {
    const { data, error } = await supabase
      .from("swatch_groups")
      .update(row)
      .eq("id", payload.id)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: "Could not save the group." };
    revalidatePath("/admin/swatches");
    return { ok: true, id: data?.id };
  }

  const { data, error } = await supabase
    .from("swatch_groups")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false, error: "Could not create the group." };
  revalidatePath("/admin/swatches");
  return { ok: true, id: data.id };
}

export async function deleteSwatchGroup(
  id: string,
): Promise<SwatchActionResult> {
  if (!swatchGroupUpdateSchema.shape.id.safeParse(id).success) {
    return { ok: false, error: "Invalid group." };
  }
  try {
    await requireRole(CATALOG_ROLES);
  } catch {
    return { ok: false, error: "You are not authorized to manage swatches." };
  }

  const supabase = await createClient();
  const { data: swatchRows } = await supabase
    .from("swatches")
    .select("id")
    .eq("group_id", id);
  const refs = await countSwatchReferences(
    supabase,
    (swatchRows ?? []).map((r) => r.id),
  );
  if (refs > 0) {
    return {
      ok: false,
      error: "This group has swatches used by products. Reassign them first.",
    };
  }

  // `swatches.group_id` cascades, so the group's swatches go with it.
  const { error } = await supabase.from("swatch_groups").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the group." };
  revalidatePath("/admin/swatches");
  return { ok: true };
}

// --------------------------------------------------------------- swatches ----

export async function saveSwatch(
  payload: SwatchInput & { id?: string },
): Promise<SwatchActionResult> {
  try {
    await requireRole(CATALOG_ROLES);
  } catch {
    return { ok: false, error: "You are not authorized to manage swatches." };
  }

  const parsed = payload.id
    ? swatchUpdateSchema.safeParse(payload)
    : swatchInputSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
  const input = parsed.data;

  const supabase = await createClient();
  const row = {
    group_id: input.group_id,
    name_en: input.name_en,
    name_bn: input.name_bn ?? null,
    code: input.code ?? null,
    color_hex: input.color_hex ?? null,
    texture_image_path: input.texture_image_path ?? null,
    sort_order: input.sort_order,
    is_active: input.is_active,
  };

  if (payload.id) {
    const { data, error } = await supabase
      .from("swatches")
      .update(row)
      .eq("id", payload.id)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: "Could not save the swatch." };
    revalidatePath("/admin/swatches");
    return { ok: true, id: data?.id };
  }

  const { data, error } = await supabase
    .from("swatches")
    .insert(row)
    .select("id")
    .single();
  if (error) return { ok: false, error: "Could not create the swatch." };
  revalidatePath("/admin/swatches");
  return { ok: true, id: data.id };
}

export async function deleteSwatch(id: string): Promise<SwatchActionResult> {
  if (!swatchUpdateSchema.shape.id.safeParse(id).success) {
    return { ok: false, error: "Invalid swatch." };
  }
  try {
    await requireRole(CATALOG_ROLES);
  } catch {
    return { ok: false, error: "You are not authorized to manage swatches." };
  }

  const supabase = await createClient();
  const refs = await countSwatchReferences(supabase, [id]);
  if (refs > 0) {
    return {
      ok: false,
      error:
        "This swatch is used by products. Reassign those variants or options first.",
    };
  }

  const { error } = await supabase.from("swatches").delete().eq("id", id);
  if (error) return { ok: false, error: "Could not delete the swatch." };
  revalidatePath("/admin/swatches");
  return { ok: true };
}
