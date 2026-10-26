"use client";

import { FolderOpen, ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { uploadMedia } from "@/app/(admin)/admin/media/actions";
import { ImagePickerDialog } from "@/components/admin/media/image-picker-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const MAX_BYTES = 5 * 1024 * 1024; // mirrors the server action limit

export type MediaFolder =
  | "catalog"
  | "categories"
  | "clients"
  | "collections"
  | "gallery"
  | "products"
  | "swatches";

type ImageUploaderProps = {
  /** Unique id; ties the hidden file input to its accessible label. */
  id: string;
  /** Current image URL stored in `image_path` ("" when none). */
  value?: string;
  /** Receives the new Cloudinary URL, or "" when the image is removed. */
  onChange: (url: string) => void;
  folder: MediaFolder;
  preset?: "wide" | "standard";
  label?: string;
  hint?: string;
  /** Preview box shape. Defaults to a 16:9 tile. */
  aspect?: "square" | "wide" | "video";
  /**
   * Media Library reuse (Shopify-style, owner request 2026-10-25): shows a
   * "Library" button that opens the Cloudinary picker so an already-uploaded
   * image can be attached instead of uploaded twice.
   */
  allowLibrary?: boolean;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ASPECT_CLASS: Record<
  NonNullable<ImageUploaderProps["aspect"]>,
  string
> = {
  square: "aspect-square",
  wide: "aspect-16/9",
  video: "aspect-video",
};

/**
 * ImageUploader (plan 9c kit, Media task): a drag-and-drop / click image field
 * that posts to the server-signed Cloudinary action. The browser never sees the
 * API secret. Uploads are validated twice — quickly on the client for instant
 * feedback, then authoritatively on the server (role, type, size) in
 * `media/actions.ts`. Ships idle, preview, uploading and error states; every
 * control is reachable by keyboard and labelled with text (never color alone).
 */
export function ImageUploader({
  id,
  value,
  onChange,
  folder,
  preset = "standard",
  label = "Image",
  hint = "PNG, JPG, WebP or AVIF, up to 5 MB.",
  aspect = "wide",
  allowLibrary = false,
}: ImageUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);

  const busy = uploading;

  const libraryButton = allowLibrary ? (
    <ImagePickerDialog
      folderHint={folder}
      trigger={
        <Button type="button" variant="outline" size="sm" disabled={busy}>
          <FolderOpen
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-3.5"
          />
          Library
        </Button>
      }
      onSelect={(asset) => onChange(asset.secureUrl)}
    />
  ) : null;

  async function handleFile(file: File | null | undefined) {
    if (!file) return;
    setError(null);

    // Fast, friendly pre-checks; the server re-validates authoritatively.
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("Use a PNG, JPG, WebP or AVIF image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${formatBytes(file.size)}. Keep it under 5 MB.`);
      return;
    }

    setUploading(true);
    setFileName(file.name);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("folder", folder);
      formData.set("preset", preset);
      const result = await uploadMedia(formData);
      if (result.ok) {
        onChange(result.url);
      } else {
        setError(result.error);
        setFileName(null);
      }
    } catch {
      setError("Upload failed. Please try again.");
      setFileName(null);
    } finally {
      setUploading(false);
    }
  }

  function resetInput() {
    // Allow re-picking the same file after a remove/replace.
    if (inputRef.current) inputRef.current.value = "";
  }

  // A plain element, not the shared `Input`: `Input` carries `w-full h-9`, which
  // (via tailwind-merge) overrides `sr-only`'s 1px width and turns this hidden
  // file picker into a full-width absolutely-positioned box that overflows the
  // admin area and enables a horizontal scrollbar. `sr-only` alone collapses it
  // correctly while keeping the `peer` focus hook for the dropzone label.
  const input = (
    <input
      ref={inputRef}
      id={id}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/avif"
      className="peer sr-only"
      disabled={busy}
      onChange={(e) => {
        void handleFile(e.target.files?.[0]);
        resetInput();
      }}
    />
  );

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {input}

      {value ? (
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "relative overflow-hidden rounded-control border border-sidebar-border bg-surface-2",
              ASPECT_CLASS[aspect],
              aspect === "square" ? "w-28 shrink-0" : "w-40 shrink-0",
            )}
          >
            {/* Cloudinary preview (`value` is always the returned secure_url);
                the same optimized next/image path the public catalog uses. */}
            <Image
              src={value}
              alt="Selected image preview"
              fill
              sizes={aspect === "square" ? "200px" : "250px"}
              className="size-full object-cover"
            />
            {busy ? (
              <div className="absolute inset-0 grid place-items-center bg-background/60">
                <Loader2
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none"
                />
              </div>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <label
              htmlFor={id}
              className={cn(
                "inline-flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-transparent bg-secondary px-2.5 text-sm font-medium text-secondary-foreground transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 hover:bg-secondary/90 motion-reduce:transition-none",
                busy && "pointer-events-none opacity-50",
              )}
            >
              <Upload
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-3.5"
              />
              {busy ? "Uploading…" : "Replace"}
            </label>
            <div className="flex items-center gap-1">
              {libraryButton}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={busy}
                onClick={() => {
                  onChange("");
                  setFileName(null);
                  setError(null);
                }}
              >
                <Trash2
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-3.5"
                />
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label
            htmlFor={id}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!busy) void handleFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-control border border-dashed px-4 py-6 text-center transition-colors motion-reduce:transition-none",
              dragging
                ? "border-ring bg-surface-2"
                : "border-sidebar-border bg-surface-2/50 hover:bg-surface-2",
              "peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
              busy && "pointer-events-none opacity-60",
            )}
          >
            {busy ? (
              <Loader2
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none"
              />
            ) : (
              <ImagePlus
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-5 text-muted-foreground"
              />
            )}
            <span className="text-sm font-medium text-foreground">
              {busy
                ? `Uploading ${fileName ?? "image"}…`
                : "Drag an image here or click to upload"}
            </span>
            <span className="text-xs text-muted-foreground">{hint}</span>
          </label>
          {libraryButton ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                or reuse from your library
              </span>
              {libraryButton}
            </div>
          ) : null}
        </div>
      )}

      <p
        className={cn(
          "text-xs",
          error ? "text-destructive" : "text-muted-foreground",
        )}
        role={error ? "alert" : undefined}
      >
        {error ?? hint}
      </p>
    </div>
  );
}
