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
 * decision (see plan Decision Log 2026-10-17). Scope: public catalog images
 * (products, categories, collections, swatch textures). Private quote
 * attachments stay on Supabase Storage.
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
 * Upload an image buffer to Cloudinary and return a resized, auto-compressed
 * delivery URL. `folder` is validated by the caller (never free text), so the
 * storage layout stays fixed and injection-safe.
 */
export async function uploadImage(
  bytes: Buffer,
  options: { folder: string; preset?: MediaPreset },
): Promise<UploadedMedia> {
  ensureConfigured();
  const preset = options.preset ?? "standard";

  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: options.folder, resource_type: "image" },
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
