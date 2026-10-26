import "server-only";

import type { UploadApiResponse } from "cloudinary";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";

/**
 * Cloudinary media helper — SERVER ONLY. The account credentials live in
 * `CLOUDINARY_URL` and are never exposed to the browser (AGENTS: no secrets in
 * the client bundle). Importing this file from a client component fails the
 * build, exactly like `supabase/admin.ts`.
 *
 * Media storage moved from the plan's Supabase Storage to Cloudinary by owner
 * decision (see plan Decision Log 2026-10-17). Scope is narrow after plan
 * 15.2 B6: this helper serves ADMIN product media only (products, categories,
 * collections, swatch textures), reached through the role-gated `uploadMedia`
 * server action. Customer quote attachments are private and live in the
 * `quote-attachments` Supabase Storage bucket, never here.
 *
 * Config is read lazily so a build without `CLOUDINARY_URL` (CI, fresh clone)
 * still succeeds; only an actual upload fails fast with a clear message.
 */

let configured = false;

function ensureConfigured(): void {
  if (configured) return;
  const url = process.env.CLOUDINARY_URL;
  if (!url) {
    throw new Error(
      "CLOUDINARY_URL is not set. Add it to .env.local to enable media uploads.",
    );
  }
  cloudinary.config(url, true);
  configured = true;
}

/**
 * All project media lives under one Cloudinary root folder so Prime Bag Factory
 * assets stay separate from other work in the account (Logos, portfolios, …).
 * Uploads land in `Primebagfactory/<entity>` — e.g. `Primebagfactory/products`.
 * Note: Cloudinary folder names are case-sensitive; this must match exactly.
 */
const ROOT_FOLDER = "Primebagfactory";

/** Delivery presets per usage, so stored URLs are already resized + compressed. */
const TRANSFORM = {
  // Large hero / product master images.
  wide: { width: 1600, height: 1600 },
  // Cards, thumbnails, category/collection tiles, swatch textures.
  standard: { width: 1000, height: 1000 },
} as const;

export type MediaPreset = keyof typeof TRANSFORM;

// Keep aspect ratio, never upscale past the original, cap the long edge;
// auto quality and auto format (WebP/AVIF) for the ~300 KB performance target.
const COMMON_TRANSFORM = {
  crop: "limit" as const,
  quality: "auto" as const,
  fetch_format: "auto" as const,
};

export type UploadedMedia = {
  publicId: string;
  /** Resized, auto-compressed delivery URL — store this in `image_path`. */
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
};

/**
 * Turn an uploaded file's name into a Cloudinary `public_id` so assets keep
 * their original name (owner request 2026-10-26) instead of an auto-generated
 * hash. Keeps the name readable: spaces become hyphens, the extension and any
 * path separators are stripped, and characters Cloudinary rejects
 * (`\ * ^ ( ) { } % # & = < > ? ! ' " : ; , [ ]` and control chars) are
 * dropped. Returns "" when nothing usable is left, so the caller falls back to
 * Cloudinary's generated name rather than failing the upload.
 */
export function derivePublicId(originalName: string): string {
  const base = originalName
    // Strip directory components a browser may include in `File.name`.
    .split(/[\\/]/)
    .pop() ?? "";
  const name = base
    // Drop a (single) trailing extension like .png / .jpeg.
    .replace(/\.[A-Za-z0-9]{1,5}$/u, "")
    // Drop control characters and characters illegal in a public id.
    .replace(/[\]\u0000-\u001f\u007f\\*^(){}%#&=<>?!'":;,\[]/gu, "")
    .replace(/\s+/gu, "-")
    // Cloudinary trims leading/trailing spaces and dots; collapse repeats.
    .replace(/-{2,}/gu, "-")
    .replace(/^[.-]+|[ .-]+$/gu, "")
    .slice(0, 120);
  return /^[A-Za-z0-9][A-Za-z0-9 ._-]*$/u.test(name) ? name : "";
}

/**
 * Upload an image buffer to Cloudinary and return a resized, auto-compressed
 * delivery URL. `folder` is validated by the caller (never free text), so the
 * storage layout stays fixed and injection-safe. When `filename` is given the
 * asset keeps its original name as the public id (re-uploading the same name
 * into the same folder replaces the old asset, CDN caches invalidated).
 */
export async function uploadImage(
  bytes: Buffer,
  options: { folder: string; preset?: MediaPreset; filename?: string },
): Promise<UploadedMedia> {
  ensureConfigured();
  const preset = options.preset ?? "standard";
  const targetFolder = `${ROOT_FOLDER}/${options.folder}`;
  const originalName = options.filename ? derivePublicId(options.filename) : "";

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        // `folder` sets the public-id prefix; `asset_folder` sets the Media
        // Library location. Both are set explicitly so the account's default
        // upload preset (whose asset_folder points at /portfolios) cannot
        // redirect this project's assets out of the Primebagfactory tree.
        folder: targetFolder,
        asset_folder: targetFolder,
        use_asset_folder_as_public_id_prefix: true,
        resource_type: "image",
        ...(originalName
          ? { public_id: originalName, overwrite: true, invalidate: true }
          : {}),
      },
      (error, res) => {
        if (error || !res) {
          reject(error ?? new Error("Cloudinary upload failed."));
          return;
        }
        resolve(res);
      },
    );
    Readable.from(bytes).pipe(stream);
  });

  // Store a transformed delivery URL so the saved `image_path` is already
  // resized + compressed (Cloudinary applies the transform on request).
  const url = cloudinary.url(result.public_id, {
    secure: true,
    transformation: [{ ...TRANSFORM[preset], ...COMMON_TRANSFORM }],
  });

  return {
    publicId: result.public_id,
    url,
    width: result.width,
    height: result.height,
    format: result.format,
    bytes: result.bytes,
  };
}
