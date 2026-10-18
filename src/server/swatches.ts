import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Server-only reads for the Swatch Library. The signed-in staff session rides the
 * cookie client, so `has_role()` RLS decides what is returned. Mutations live in
 * `app/(admin)/admin/swatches/actions.ts`. `product_variants.swatch_id` has no FK,
 * so PostgREST cannot embed a variant count; usage is tallied with two flat reads
 * (variants + part-swatches) across the loaded swatch ids instead.
 */

type Client = Awaited<ReturnType<typeof createClient>>;

export type AdminSwatch = {
  id: string;
  group_id: string;
  name_en: string;
  name_bn: string | null;
  code: string | null;
  color_hex: string | null;
  texture_image_path: string | null;
  sort_order: number;
  is_active: boolean;
  /** Times referenced by product variants or builder part swatches. */
  usage_count: number;
};

export type AdminSwatchGroup = {
  id: string;
  key: string;
  name_en: string;
  name_bn: string | null;
  sort_order: number;
  swatches: AdminSwatch[];
};

const SWATCH_COLUMNS =
  "id, group_id, name_en, name_bn, code, color_hex, texture_image_path, sort_order, is_active";

type SwatchRow = Omit<AdminSwatch, "usage_count">;
type GroupRow = {
  id: string;
  key: string;
  name_en: string;
  name_bn: string | null;
  sort_order: number;
  swatches: SwatchRow[] | null;
};

function byOrder(
  a: { sort_order: number; name_en: string },
  b: { sort_order: number; name_en: string },
) {
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.name_en.localeCompare(b.name_en);
}

/**
 * Every swatch group with its swatches nested, plus a usage count per swatch.
 * One read for the library grid; tab switching is client-side.
 */
export async function listSwatchLibrary(): Promise<AdminSwatchGroup[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("swatch_groups")
    .select(
      `id, key, name_en, name_bn, sort_order, swatches(${SWATCH_COLUMNS})`,
    )
    .order("sort_order", { ascending: true })
    .order("name_en", { ascending: true });

  if (error) {
    throw new Error("Failed to load swatch groups.", { cause: error });
  }

  const groups = (data ?? []) as unknown as GroupRow[];
  const allSwatches = groups.flatMap((g) => g.swatches ?? []);
  const usage = await tallyUsage(
    supabase,
    allSwatches.map((s) => s.id),
  );

  return groups
    .slice()
    .sort(byOrder)
    .map((group) => ({
      id: group.id,
      key: group.key,
      name_en: group.name_en,
      name_bn: group.name_bn,
      sort_order: group.sort_order,
      swatches: (group.swatches ?? [])
        .slice()
        .sort(byOrder)
        .map((s) => ({ ...s, usage_count: usage[s.id] ?? 0 })),
    }));
}

/** Count references to each swatch across variants and builder part-swatches. */
async function tallyUsage(
  supabase: Client,
  swatchIds: string[],
): Promise<Record<string, number>> {
  const map: Record<string, number> = {};
  if (swatchIds.length === 0) return map;

  const sources = ["product_variants", "product_part_swatches"] as const;
  await Promise.all(
    sources.map(async (table) => {
      const { data } = await supabase
        .from(table)
        .select("swatch_id")
        .in("swatch_id", swatchIds);
      for (const row of data ?? []) {
        const id = (row as { swatch_id: string | null }).swatch_id;
        if (id) map[id] = (map[id] ?? 0) + 1;
      }
    }),
  );

  return map;
}
