"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  CONTENT_ENTITIES,
  ENTITY_SCHEMAS,
  contentIdSchema,
  contentMoveSchema,
  contentSaveSchema,
  contentToggleSchema,
  type ContentEntity,
} from "@/lib/validators/content";
import { tableFor } from "@/server/content-admin";
import { CATALOG_TAG } from "@/server/catalog";

/**
 * Content admin mutations (plan Phase 4 task 3, 9c.8). One generic quartet —
 * save / delete / move / toggle — parameterized by a fixed entity enum. Every
 * path: requireRole(owner/manager) → zod on the entity AND the per-table field
 * schema (validators/content.ts), so no free-form object reaches Supabase.
 * RLS on the content tables (owner/manager) already mirrors this gate.
 */

const CONTENT_ROLES = ["owner", "manager"] as const;

export type ContentResult =
  | { ok: true }
  | { ok: false; error: string };

function denied(): ContentResult {
  return { ok: false, error: "You are not authorized to manage content." };
}

/** 23505 per unique constraint of each table, mapped to friendly text. */
const UNIQUE_HINTS: Partial<Record<ContentEntity, string>> = {
  sections: "That page/key pair already exists.",
  posts: "That slug is already in use.",
  redirects: "A redirect for that path already exists.",
};

function friendlyDbError(
  entity: ContentEntity,
  error: { code?: string; message: string },
): string {
  if (error.code === "23505") return UNIQUE_HINTS[entity] ?? "Already in use.";
  return "Could not save. Please try again.";
}

/** Column payload per entity, from the validated schema output. */
function toColumnValues(
  entity: ContentEntity,
  data: Record<string, unknown>,
): Record<string, unknown> {
  const values = { ...data };
  if (entity === "sections" && typeof values.content === "string") {
    // Stored as jsonb; validated as JSON object text by the schema.
    values.content = JSON.parse(values.content) as never;
  }
  if (entity === "posts") {
    if (values.status === "published" && !values.published_at) {
      values.published_at = new Date().toISOString();
    }
    if (values.published_at && typeof values.published_at === "string") {
      values.published_at = new Date(
        `${values.published_at.slice(0, 10)}T09:00:00+06:00`,
      ).toISOString();
    }
  }
  return values;
}

async function requireContentRole(): Promise<boolean> {
  try {
    await requireRole(CONTENT_ROLES);
    return true;
  } catch {
    return false;
  }
}

function revalidate(entity: ContentEntity) {
  revalidatePath("/admin/content");
  // Public pages read clients/faqs/legal through unstable_cache(CATALOG_TAG).
  // Next 16 requires a staleness profile; "wait" blocks until fresh so a
  // visitor never sees the stale marketing page right after a save.
  revalidateTag(CATALOG_TAG, "wait");
  void entity;
}

export async function saveContentRow(payload: unknown): Promise<ContentResult> {
  if (!(await requireContentRole())) return denied();

  const parsed = contentSaveSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid content row." };
  const { entity, id, values } = parsed.data;

  const fields = ENTITY_SCHEMAS[entity].safeParse(values ?? {});
  if (!fields.success) {
    return {
      ok: false,
      error:
        fields.error.issues[0]?.message ??
        "Some fields need attention.",
    };
  }

  const patch = toColumnValues(entity, fields.data as Record<string, unknown>);
  const { table } = tableFor(entity);
  const supabase = await createClient();

  if (id) {
    const { data, error } = await supabase
      .from(table)
      .update(patch as never)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: friendlyDbError(entity, error) };
    if (!data) return { ok: false, error: "Row not found." };
  } else {
    const { data, error } = await supabase
      .from(table)
      .insert({ id: crypto.randomUUID(), ...patch } as never)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: friendlyDbError(entity, error) };
    if (!data) return { ok: false, error: "Could not create the row." };
  }

  revalidate(entity);
  return { ok: true };
}

export async function deleteContentRow(payload: unknown): Promise<ContentResult> {
  if (!(await requireContentRole())) return denied();

  const parsed = contentIdSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid row." };
  const { entity, id } = parsed.data;
  if (!entityIn(CONTENT_ENTITIES, entity)) return denied();

  const supabase = await createClient();
  const { error } = await supabase
    .from(tableFor(entity).table)
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: "Could not delete. Is it referenced?" };

  revalidate(entity);
  return { ok: true };
}

/** Reorder within the list: swap the row with its neighbour by renumbering
 *  the whole (small, marketing-sized) table deterministically. */
export async function moveContentRow(payload: unknown): Promise<ContentResult> {
  if (!(await requireContentRole())) return denied();

  const parsed = contentMoveSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid move." };
  const { entity, id, dir } = parsed.data;

  const supabase = await createClient();
  const { table } = tableFor(entity);
  const { data, error } = await supabase
    .from(table)
    .select("id, sort_order")
    .order("sort_order", { ascending: true });
  if (error || !data) return { ok: false, error: "Could not load the order." };

  const rows = data as unknown as { id: string; sort_order: number }[];
  const index = rows.findIndex((r) => r.id === id);
  const target = index + dir;
  if (index < 0 || target < 0 || target >= rows.length) {
    return { ok: true }; // already first/last — no-op
  }
  const next = [...rows];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);

  for (let i = 0; i < next.length; i++) {
    const { error: updateError } = await supabase
      .from(table)
      .update({ sort_order: i } as never)
      .eq("id", next[i].id);
    if (updateError) {
      return { ok: false, error: "Could not save the new order." };
    }
  }

  revalidate(entity);
  return { ok: true };
}

/** Active toggle — only tables that have is_active (sections, clients). */
export async function toggleContentRow(payload: unknown): Promise<ContentResult> {
  if (!(await requireContentRole())) return denied();

  const parsed = contentToggleSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Invalid row." };
  const { entity, id } = parsed.data;
  if (entity !== "sections" && entity !== "clients") {
    return { ok: false, error: "This content type has no active flag." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from(tableFor(entity).table)
    .select("is_active")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Row not found." };

  const current = (data as unknown as { is_active: boolean }).is_active;
  const { error: updateError } = await supabase
    .from(tableFor(entity).table)
    .update({ is_active: !current } as never)
    .eq("id", id);
  if (updateError) return { ok: false, error: "Could not save." };

  revalidate(entity);
  return { ok: true };
}

function entityIn(
  list: readonly ContentEntity[],
  value: ContentEntity,
): boolean {
  return list.includes(value);
}
