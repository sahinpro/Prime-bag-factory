"use server";

import { z } from "zod";

import { requireRole } from "@/lib/auth";
import { uploadImage, type MediaPreset } from "@/lib/cloudinary";

const CATALOG_ROLES = ["owner", "manager"] as const;

// Fixed storage folders — never free text, so the Cloudinary layout stays
// predictable and a client cannot inject an arbitrary path.
const folderSchema = z.enum([
  "catalog",
  "categories",
  "clients",
  "collections",
  "gallery",
  "products",
  "swatches",
]);
const presetSchema = z.enum(["wide", "standard"]);

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export type UploadMediaResult =
  | { ok: true; url: string; publicId: string; bytes: number }
  | { ok: false; error: string };

/**
 * Server-signed Cloudinary upload. The API secret stays on the server
 * (`src/lib/cloudinary.ts`); the browser only ever posts a file to this action.
 * Role-gated and validated before any bytes reach Cloudinary.
 */
export async function uploadMedia(
  formData: FormData,
): Promise<UploadMediaResult> {
  try {
    await requireRole(CATALOG_ROLES);
  } catch {
    return { ok: false, error: "You are not authorized to upload media." };
  }

  const parsedFolder = folderSchema.safeParse(formData.get("folder"));
  if (!parsedFolder.success) {
    return { ok: false, error: "Unknown upload destination." };
  }

  const rawPreset = formData.get("preset");
  const parsedPreset = presetSchema.safeParse(rawPreset ?? "standard");
  const preset: MediaPreset = parsedPreset.success
    ? parsedPreset.data
    : "standard";

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file received." };
  if (file.size === 0) return { ok: false, error: "The file is empty." };
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Image must be 5 MB or smaller." };
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return { ok: false, error: "Use a PNG, JPG, WebP or AVIF image." };
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(await file.arrayBuffer());
  } catch {
    return { ok: false, error: "Could not read the file." };
  }

  try {
    const uploaded = await uploadImage(bytes, {
      folder: parsedFolder.data,
      preset,
      // Keep the asset's original file name as its public id (owner request
      // 2026-10-26); `derivePublicId` sanitizes it, empty falls back to a
      // Cloudinary-generated name.
      filename: file.name,
    });
    return {
      ok: true,
      url: uploaded.url,
      publicId: uploaded.publicId,
      bytes: uploaded.bytes,
    };
  } catch (err) {
    // Keep the raw error server-side; return a safe, generic message.
    console.error("media upload failed", err);
    const configured =
      err instanceof Error && err.message.includes("CLOUDINARY_URL");
    return {
      ok: false,
      error: configured
        ? "Media storage is not configured on this server."
        : "Upload failed. Please try again.",
    };
  }
}
