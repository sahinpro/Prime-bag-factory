import { createClient } from "@/lib/supabase/server";

import type { ContentEntity } from "@/lib/validators/content";

// Admin reads for the content modules (plan 9c.8 "Content"). Rows come back in
// one generic shape so a single workspace component can render all eight
// types: primitives keyed by column, jsonb flattened to pretty JSON text,
// timestamps flattened to date-only strings. Reads use the cookie-based staff
// client, so RLS (owner/manager on all content tables) applies.

export type ContentRow = {
  id: string;
  /** sort_order when the table has one, else null (list order = created_at). */
  sortOrder: number | null;
  isActive: boolean | null;
  values: Record<string, string | number | boolean | null>;
};

type ContentTable =
  | "site_sections"
  | "clients"
  | "gallery_items"
  | "testimonials"
  | "faqs"
  | "posts"
  | "legal_documents"
  | "redirects";

type TableConfig = {
  table: ContentTable;
  select: string;
  hasSort: boolean;
};

const TABLES: Record<ContentEntity, TableConfig> = {
  sections: {
    table: "site_sections",
    select: "id, page, key, content, sort_order, is_active",
    hasSort: true,
  },
  clients: {
    table: "clients",
    select: "id, name, logo_path, sort_order, is_active",
    hasSort: true,
  },
  gallery: {
    table: "gallery_items",
    select: "id, image_path, caption, sort_order",
    hasSort: true,
  },
  testimonials: {
    table: "testimonials",
    select: "id, name, company, rating, body_en, body_bn",
    hasSort: false,
  },
  faqs: {
    table: "faqs",
    select: "id, question_en, question_bn, answer_en, answer_bn, sort_order",
    hasSort: true,
  },
  posts: {
    table: "posts",
    select: "id, slug, title_en, title_bn, body_en, body_bn, cover_path, status, published_at, seo_title_en, seo_description_en",
    hasSort: false,
  },
  legal: {
    table: "legal_documents",
    select: "id, title, number, image_path",
    hasSort: false,
  },
  redirects: {
    table: "redirects",
    select: "id, from_path, to_path, status_code",
    hasSort: false,
  },
};

function flatten(
  row: Record<string, unknown>,
): Omit<ContentRow, "id" | "sortOrder" | "isActive"> & {
  sortOrder: number | null;
  isActive: boolean | null;
} {
  const values: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "id" || key === "sort_order" || key === "is_active") continue;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      values[key] = value;
    } else if (key === "content") {
      // jsonb section content edits as pretty JSON text.
      values[key] = JSON.stringify(value ?? {}, null, 2);
    } else {
      values[key] = String(value);
    }
  }
  return {
    values,
    sortOrder:
      typeof row.sort_order === "number" ? row.sort_order : null,
    isActive:
      typeof row.is_active === "boolean" ? row.is_active : null,
  };
}

export async function listContentRows(
  entity: ContentEntity,
): Promise<ContentRow[]> {
  const config = TABLES[entity];
  const supabase = await createClient();
  // The select string is not a literal here, so the generated row type
  // degrades; rows are flattened by hand below, hence the unknown cast.
  const { data, error } = await supabase
    .from(config.table)
    .select(config.select)
    .order(config.hasSort ? "sort_order" : "created_at", { ascending: true });
  if (error) {
    throw new Error(`Failed to load ${entity}.`, { cause: error });
  }
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  return rows.map((row) => {
    const flat = flatten(row);
    return { id: String(row.id), ...flat };
  });
}

/** Shared with the actions so list order and move math agree. */
export function tableFor(entity: ContentEntity): TableConfig {
  return TABLES[entity];
}
