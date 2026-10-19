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
  const targetFolder = `${ROOT_FOLDER}/${options.folder}`;

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

/** Public image folders the browser may upload into (fixed, never free text). */
// Public (unauthenticated) signing is for customer artwork ONLY. Catalog media
// goes through the role-gated `uploadMedia` server action, never this list.
const SIGNABLE_FOLDERS = ["artwork"] as const;
export type SignableFolder = (typeof SIGNABLE_FOLDERS)[number];

export type SignedUploadParams = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  endpoint: string;
};

/**
 * Signature for a browser → Cloudinary direct upload (plan 8 "uploads … signed").
 * The api_secret stays on the server; the client only ever receives a signature
 * locked to one `timestamp`, one folder and one preset, so it cannot upload
 * elsewhere or without expiring. Returns null when Cloudinary is not configured
 * so the caller can degrade instead of throwing.
 */
export function buildSignedUploadParams(
  folder: string,
): SignedUploadParams | null {
  if (!process.env.CLOUDINARY_URL) return null;
  if (!(SIGNABLE_FOLDERS as readonly string[]).includes(folder)) {
    throw new Error("Unsupported upload folder.");
  }
  ensureConfigured();
  const cfg = cloudinary.config();
  if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) return null;

  const timestamp = Math.round(Date.now() / 1000);
  const targetFolder = `${ROOT_FOLDER}/${folder}`;
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: targetFolder },
    cfg.api_secret,
  );

  return {
    cloudName: cfg.cloud_name,
    apiKey: cfg.api_key,
    timestamp,
    signature,
    folder: targetFolder,
    endpoint: `https://api.cloudinary.com/v1_1/${cfg.cloud_name}/image/upload`,
  };
}
