import "server-only";

import { v2 as cloudinary } from "cloudinary";

import type { createClient } from "@/lib/supabase/server";

import type { MediaAsset, MediaFolder } from "@/lib/media.types";
import { MEDIA_FOLDERS } from "@/lib/media.types";

/**
 * Media Library reads/deletes for the `/admin/media` page (owner request
 * 2026-10-25, Shopify-style media management). Scope is deliberately narrow:
 * only images under the `Primebagfactory/` root folder are listed or
 * destroyed, so staff can never reach assets belonging to other work in the
 * account (Logos, portfolios, …).
 *
 * Talks to the Cloudinary Asset Admin API directly over fetch with Basic auth
 * built from CLOUDINARY_URL — no SDK internals, and the secret stays in this
 * process (AGENTS rule 7).
 *
 * This module is intentionally SELF-CONTAINED: it configures the Cloudinary
 * SDK itself instead of importing helpers from `src/lib/cloudinary.ts`. A dev
 * server can keep serving an older compiled generation of that module (a
 * Turbopack chunk reused across restarts), which turns a cross-module export
 * added later into a runtime `is not a function` crash on /admin/media.
 */

const ADMIN_API_BASE = "https://api.cloudinary.com/v1_1";

let sdkConfigured = false;

/**
 * Point the SDK at our account (same lazy rule as the upload helper, so a
 * build without `CLOUDINARY_URL` still succeeds). False = not configured.
 */
function ensureSdkConfigured(): boolean {
  const url = process.env.CLOUDINARY_URL;
  if (!url) return false;
  if (!sdkConfigured) {
    cloudinary.config(url, true);
    sdkConfigured = true;
  }
  return true;
}

/**
 * Parsed account credentials for the Admin API. SERVER ONLY: the returned
 * secret must never be rendered, logged or handed to the browser — same rule
 * as `CLOUDINARY_URL` itself (AGENTS rule 7).
 */
function adminCredentials(): {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
} | null {
  if (!ensureSdkConfigured()) return null;
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  if (!cloud_name || !api_key || !api_secret) return null;
  return {
    cloudName: String(cloud_name),
    apiKey: String(api_key),
    apiSecret: String(api_secret),
  };
}

type AdminResponse = {
  resources?: RawAsset[];
  next_cursor?: string;
  result?: string;
  /** Delete response: `{ [public_id]: "ok" | "not found" }`. */
  deleted?: Record<string, string>;
};

/**
 * One signed Admin API call. Query params ride on GET; form params go in the
 * body on POST/DELETE (Cloudinary reads `public_ids[]` from the body). Any
 * failure — missing credentials, a non-2xx answer, a transport error — resolves
 * to `null` so callers show their own error state instead of throwing.
 */
async function adminRequest(
  path: string,
  options:
    | { query?: Record<string, string | number> }
    | { method: "POST" | "DELETE"; body: Record<string, string> },
): Promise<AdminResponse | null> {
  const isGet = !("method" in options);
  const query = isGet ? options.query : undefined;
  const qs = query
    ? new URLSearchParams(
        Object.entries(query).map(([k, v]) => [k, String(v)]),
      ).toString()
    : "";
  try {
    const creds = adminCredentials();
    if (!creds) return null;
    const auth = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString(
      "base64",
    );
    const url = `${ADMIN_API_BASE}/${creds.cloudName}/${path}${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, {
      method: isGet ? "GET" : options.method,
      headers: {
        Authorization: `Basic ${auth}`,
        ...(!isGet
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
      body: isGet ? undefined : new URLSearchParams(options.body),
    });
    if (!res.ok) {
      console.error("cloudinary admin api failed", {
        path,
        status: res.status,
      });
      return null;
    }
    return (await res.json()) as AdminResponse;
  } catch (err) {
    console.error("cloudinary admin api error", err);
    return null;
  }
}

export const MEDIA_ROOT_FOLDER = "Primebagfactory";

// The folder list and asset shape live in a client-safe module because admin
// client components render them; re-exported here for server callers.
export { MEDIA_FOLDERS } from "@/lib/media.types";
export type { MediaAsset, MediaFolder } from "@/lib/media.types";

export function isMediaFolder(value: unknown): value is MediaFolder {
  return (MEDIA_FOLDERS as readonly string[]).includes(String(value));
}

export type MediaPage = {
  assets: MediaAsset[];
  nextCursor: string | null;
};

/** Cloudinary prefix for a folder filter — always rooted at our tree. */
export function prefixFor(folder?: MediaFolder | null): string {
  return folder ? `${MEDIA_ROOT_FOLDER}/${folder}` : MEDIA_ROOT_FOLDER;
}

/** Last path segment of a public id; used for "is this asset in use?" scans. */
export function basenameOf(publicId: string): string {
  return publicId.split("/").pop() ?? publicId;
}

/** True only when the id points inside our project's Cloudinary tree. */
export function isOursPublicId(publicId: string): boolean {
  return publicId.startsWith(`${MEDIA_ROOT_FOLDER}/`);
}

type RawAsset = {
  public_id?: string;
  asset_folder?: string;
  bytes?: number;
  format?: string;
  width?: number;
  height?: number;
  created_at?: string;
  secure_url?: string;
};

function toAsset(raw: RawAsset): MediaAsset | null {
  const publicId = typeof raw.public_id === "string" ? raw.public_id : null;
  const secureUrl = typeof raw.secure_url === "string" ? raw.secure_url : null;
  if (!publicId || !secureUrl || !isOursPublicId(publicId)) return null;
  const folder = publicId.slice(MEDIA_ROOT_FOLDER.length + 1).split("/")[0];
  return {
    publicId,
    folder: isMediaFolder(folder) ? folder : "",
    basename: basenameOf(publicId),
    bytes: typeof raw.bytes === "number" ? raw.bytes : 0,
    format: typeof raw.format === "string" ? raw.format : "unknown",
    width: typeof raw.width === "number" ? raw.width : null,
    height: typeof raw.height === "number" ? raw.height : null,
    createdAt: typeof raw.created_at === "string" ? raw.created_at : "",
    secureUrl,
    thumbUrl: thumbUrlFor(publicId),
  };
}

/** Grid thumbnail: cropped square so tiles stay uniform regardless of source. */
function thumbUrlFor(publicId: string): string {
  if (!ensureSdkConfigured()) return "";
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      {
        crop: "fill",
        gravity: "auto",
        width: 400,
        height: 400,
        quality: "auto",
      },
    ],
  });
}

/**
 * One page of project assets, newest first. `cursor` is the opaque
 * `next_cursor` from the previous call. Returns `null` when Cloudinary is not
 * configured or the Admin API failed — the page renders its error state.
 */
export async function listProjectAssets(options: {
  folder?: MediaFolder | null;
  cursor?: string | null;
  maxResults?: number;
}): Promise<MediaPage | null> {
  const data = await adminRequest("resources/image/upload", {
    query: {
      prefix: prefixFor(options.folder ?? null),
      max_results: options.maxResults ?? 60,
      ...(options.cursor ? { next_cursor: options.cursor } : {}),
    },
  });
  if (!data) return null;

  const assets = (data.resources ?? [])
    .map(toAsset)
    .filter((a): a is MediaAsset => a !== null);
  // A `prefix` listing comes back in public_id order — Cloudinary ignores
  // `sort_by`/`direction` there (checked against the live account
  // 2026-10-25), so newest-first is applied to the page we actually hold.
  assets.sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );
  return { assets, nextCursor: data.next_cursor ?? null };
}

export type DestroyResult = { ok: true } | { ok: false; error: string };

/**
 * Delete one image from Cloudinary. Guarded so a caller cannot smuggle a
 * public id outside the `Primebagfactory/` tree into the Admin API.
 */
export async function destroyProjectAsset(
  publicId: string,
): Promise<DestroyResult> {
  if (!isOursPublicId(publicId)) {
    return { ok: false, error: "Unknown media asset." };
  }
  if (!adminCredentials()) {
    return {
      ok: false,
      error: "Media storage is not configured on this server.",
    };
  }
  // Cloudinary deletes through the multi-asset endpoint: DELETE
  // /resources/image/upload with `public_ids[]` in the body. For assets that
  // live in an Asset Folder the per-id outcome is unreliable (`not_found` is
  // answered even while the delete goes through), so any 200 that names the
  // id counts as accepted — the grid re-reads the listing right after.
  const data = await adminRequest("resources/image/upload", {
    method: "DELETE",
    body: { "public_ids[]": publicId, invalidate: "true" },
  });
  if (data?.deleted && publicId in data.deleted) {
    return { ok: true };
  }
  return {
    ok: false,
    error:
      "Could not delete. The asset is already gone or Cloudinary did not answer.",
  };
}

/** One catalog hit group, already worded for the admin-facing message. */
export type AssetUsageHit = { label: string; count: number };

/**
 * Result of the delete guard's catalog scan. `failedTables` is the important
 * part: when a catalog table cannot be read we refuse the delete (a silent
 * destructive failure is worse than an inconvenient one) but say so honestly
 * instead of reporting an empty "in use by" list.
 */
export type AssetUsage = {
  hits: AssetUsageHit[];
  total: number;
  failedTables: string[];
};

/**
 * Every catalog column that can hold a Cloudinary media URL, worded for the
 * delete guard. Each scan is written out against the typed Supabase client —
 * no table/column config arrays — so a renamed or dropped column fails the
 * build. The array version here queried a `products.image_path` that does not
 * exist, PostgREST answered 400 with an unusable error, and every single delete
 * was refused as "in use" (found by e2e/media.spec.ts, 2026-10-25).
 */
const USAGE_SCANS: {
  table: string;
  label: string;
  run: (
    db: Awaited<ReturnType<typeof createClient>>,
    pattern: string,
  ) => PromiseLike<{ count: number | null; error: unknown }>;
}[] = [
  {
    table: "product_images",
    label: "product image(s)",
    run: (db, pattern) =>
      db
        .from("product_images")
        .select("id", { count: "exact", head: true })
        .ilike("path", pattern),
  },
  {
    table: "categories",
    label: "category",
    run: (db, pattern) =>
      db
        .from("categories")
        .select("id", { count: "exact", head: true })
        .ilike("image_path", pattern),
  },
  {
    table: "collections",
    label: "collection",
    run: (db, pattern) =>
      db
        .from("collections")
        .select("id", { count: "exact", head: true })
        .ilike("image_path", pattern),
  },
  {
    table: "gallery_items",
    label: "gallery item",
    run: (db, pattern) =>
      db
        .from("gallery_items")
        .select("id", { count: "exact", head: true })
        .ilike("image_path", pattern),
  },
  {
    table: "swatches",
    label: "swatch",
    run: (db, pattern) =>
      db
        .from("swatches")
        .select("id", { count: "exact", head: true })
        .ilike("texture_image_path", pattern),
  },
  {
    table: "clients",
    label: "site logo",
    run: (db, pattern) =>
      db
        .from("clients")
        .select("id", { count: "exact", head: true })
        .ilike("logo_path", pattern),
  },
];

/**
 * Count catalog rows whose stored image path contains the asset basename
 * (Cloudinary URLs embed the public id, so a `%basename%` ilike finds every
 * delivery-URL variant). Runs on the caller's session — staff RLS read only.
 * `supabase` is injected so this stays testable and the action owns the client.
 */
export async function findAssetUsage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  publicId: string,
): Promise<AssetUsage> {
  const pattern = `%${basenameOf(publicId)}%`;

  const results = await Promise.all(
    USAGE_SCANS.map(async (scan) => {
      try {
        // The Postgrest builder is a thenable, not a Promise — await it
        // directly and inspect `error` instead of chaining catchables.
        const r = await scan.run(supabase, pattern);
        return { table: scan.table, error: r.error, count: r.count };
      } catch {
        return { table: scan.table, error: { message: "failed" }, count: null };
      }
    }),
  );

  // A read we cannot trust is either an error or a missing count; both mean
  // "unknown usage", never "no usage".
  const failedTables = results
    .filter((r) => Boolean(r.error) || r.count === null)
    .map((r) => r.table);
  if (failedTables.length > 0) {
    console.error("media usage scan incomplete", { failedTables });
    return { hits: [], total: 1, failedTables };
  }

  const hits = USAGE_SCANS.map((scan, i) => ({
    label: scan.label,
    count: results[i].count ?? 0,
  })).filter((h) => h.count > 0);
  const total = hits.reduce((sum, h) => sum + h.count, 0);
  return { hits, total, failedTables: [] };
}
