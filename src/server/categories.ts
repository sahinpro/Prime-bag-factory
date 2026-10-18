import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Server-only reads for the Categories module. The signed-in staff session rides
 * the cookie client, so `has_role()` RLS decides what is returned. Mutations are
 * NOT here — they live in `app/(admin)/admin/categories/actions.ts` (server
 * actions) which validate with zod and call `requireRole()`.
 */

export type AdminCategory = {
  id: string;
  parent_id: string | null;
  slug: string;
  name_en: string;
  name_bn: string | null;
  description_en: string | null;
  description_bn: string | null;
  image_path: string | null;
  seo_title_en: string | null;
  seo_title_bn: string | null;
  seo_description_en: string | null;
  seo_description_bn: string | null;
  sort_order: number;
  is_active: boolean;
};

const CATEGORY_COLUMNS =
  "id, parent_id, slug, name_en, name_bn, description_en, description_bn, image_path, seo_title_en, seo_title_bn, seo_description_en, seo_description_bn, sort_order, is_active";

/** All categories (active and draft) in display order for the admin tree. */
export async function listAdminCategories(): Promise<AdminCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select(CATEGORY_COLUMNS)
    .order("sort_order", { ascending: true })
    .order("name_en", { ascending: true });

  if (error) {
    throw new Error("Failed to load categories.", { cause: error });
  }

  return (data ?? []) as AdminCategory[];
}
