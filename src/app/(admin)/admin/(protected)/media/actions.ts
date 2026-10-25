"use server";

import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/server/audit";
import {
  destroyProjectAsset,
  findAssetUsage,
  isMediaFolder,
  listProjectAssets,
  type MediaAsset,
  type MediaFolder,
  type MediaPage,
} from "@/server/media";

/**
 * Media Library mutations/readers for `/admin/media` (Shopify-style media
 * management, owner request 2026-10-25). Uploads stay in the existing
 * `uploadMedia` action below; listing and deleting live here. All handlers
 * re-check the owner/manager role (defense in depth — nav is never the gate).
 */

const CATALOG_ROLES = ["owner", "manager"] as const;
const NOT_ALLOWED = "You are not authorized to manage media.";

export type DeleteMediaResult = { ok: true } | { ok: false; error: string };

const publicIdSchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^Primebagfactory\/[a-z0-9/_.-]+$/i, "Unknown media asset.");

/**
 * Delete one Cloudinary asset — refused while the image is still referenced
 * by the catalog (product images, categories, collections, gallery, swatches,
 * site logo), so the public site can never be left with a broken image by an
 * over-eager cleanup. A catalog read that fails is refused too, with its own
 * message: "I could not check" must never look like "it is in use by nothing".
 */
export async function deleteMediaAsset(
  payload: unknown,
): Promise<DeleteMediaResult> {
  let actorId: string;
  try {
    actorId = (await requireRole(CATALOG_ROLES)).id;
  } catch {
    return { ok: false, error: NOT_ALLOWED };
  }

  const parsed = publicIdSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Unknown media asset." };
  const publicId = parsed.data;

  const supabase = await createClient();
  const usage = await findAssetUsage(supabase, publicId);
  if (usage.failedTables.length > 0) {
    return {
      ok: false,
      error:
        "Could not check whether this image is still used by the catalog, so the delete was refused. Try again in a moment.",
    };
  }
  if (usage.total > 0) {
    const where = usage.hits.map((hit) => `${hit.count} ${hit.label}`);
    return {
      ok: false,
      error: `Still in use by ${where.join(", ")}. Remove it there first.`,
    };
  }

  const destroyed = await destroyProjectAsset(publicId);
  if (!destroyed.ok) return destroyed;

  await logAudit(supabase, {
    actorId,
    action: "media.delete",
    tableName: "cloudinary",
    // `audit_logs.record_id` is a uuid and a Cloudinary public id is not one
    // (found by e2e/media.spec.ts, 2026-10-25 — the insert was rejected and the
    // delete went unaudited). The full id belongs in the jsonb diff.
    recordId: null,
    diff: { public_id: publicId, folder: publicId.split("/")[1] ?? null },
  });
  return { ok: true };
}

export type ListMediaResult =
  | { ok: true; assets: MediaAsset[] }
  | { ok: false; error: string };

/**
 * All project assets in one folder (or the whole `Primebagfactory/` tree),
 * for the in-form Media Library picker. A few hundred uploads at most, so the
 * Admin API's 500-row page is plenty; no cursor is exposed to the client.
 */
export async function listMediaAssets(
  folder?: unknown,
): Promise<ListMediaResult> {
  try {
    await requireRole(CATALOG_ROLES);
  } catch {
    return { ok: false, error: NOT_ALLOWED };
  }

  const parsedFolder: MediaFolder | null = isMediaFolder(folder)
    ? folder
    : null;
  const page: MediaPage | null = await listProjectAssets({
    folder: parsedFolder,
    maxResults: 500,
  });
  if (!page) {
    return {
      ok: false,
      error: "Media storage is not configured or did not answer.",
    };
  }
  return { ok: true, assets: page.assets };
}
