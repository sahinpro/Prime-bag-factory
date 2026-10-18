import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Server-only reads for the Collections module. The signed-in staff session rides
 * the cookie client, so `has_role()` RLS decides what is returned (owner/manager
 * read every row incl. inactive; other roles fall back to active rows). Mutations
 * are NOT here — they live in `app/(admin)/admin/collections/actions.ts` (server
 * actions) which validate with zod and call `requireRole()`.
 */

export type AdminCollection = {
  id: string;
  slug: string;
  name_en: string;
  name_bn: string | null;
  description_en: string | null;
  description_bn: string | null;
  image_path: string | null;
  sort_order: number;
  is_active: boolean;
  /** Number of products linked through `product_collections`. */
  product_count: number;
};

const COLLECTION_COLUMNS =
  "id, slug, name_en, name_bn, description_en, description_bn, image_path, sort_order, is_active, product_collections(count)";

// PostgREST returns an aggregate embed (`product_collections(count)`) as a single
// object `{ count }`, but the generated types model a to-many embed as an array.
// Accept both shapes and normalize so the count never depends on the typegen.
type CollectionRow = Omit<AdminCollection, "product_count"> & {
  product_collections: { count: number } | { count: number }[] | null;
};

function readCount(embedded: CollectionRow["product_collections"]): number {
  if (!embedded) return 0;
  const first = Array.isArray(embedded) ? embedded[0] : embedded;
  return first?.count ?? 0;
}

/** All collections (active and inactive) in display order for the admin table. */
export async function listAdminCollections(): Promise<AdminCollection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .select(COLLECTION_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("name_en", { ascending: true });

  if (error) {
    throw new Error("Failed to load collections.", { cause: error });
  }

  return (data ?? []).map((row) => {
    const { product_collections, ...rest } = row;
    return {
      ...rest,
      product_count: readCount(
        product_collections as CollectionRow["product_collections"],
      ),
    };
  });
}
