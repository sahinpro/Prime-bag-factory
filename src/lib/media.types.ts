/**
 * Media Library shared types (plan 9c, Media Library task).
 *
 * Client-safe by design: `src/server/media.ts` is `server-only`, so admin
 * client components (grid, picker, uploader) import the folder list and the
 * asset shape from here instead. Keep this file free of any server imports.
 */

export const MEDIA_FOLDERS = [
  "catalog",
  "categories",
  "clients",
  "collections",
  "gallery",
  "products",
  "swatches",
] as const;

export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

/** A Cloudinary asset trimmed to what the admin UI shows. */
export type MediaAsset = {
  publicId: string;
  /** Folder inside the project root, e.g. "products"; "" if unfiled. */
  folder: string;
  basename: string;
  bytes: number;
  format: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  secureUrl: string;
  /** Thumb-sized delivery URL for the grid (fill + cover, 400px). */
  thumbUrl: string;
};
