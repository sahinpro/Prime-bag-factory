"use client";

import { Check, Copy, Link2, Trash2 } from "lucide-react";
import Image from "next/image";
import * as React from "react";

import { ConfirmDialog } from "@/components/admin/forms/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { MediaAsset } from "@/lib/media.types";
import { cn } from "@/lib/utils";

/**
 * MediaGrid (plan 9c kit, Media Library task): the Shopify-style tile grid
 * behind /admin/media and the in-form media picker. Each tile shows the
 * thumbnail, file name, folder badge and meta line (format · size · dims ·
 * date), plus copy-link and delete actions. In `select` mode (the picker) the
 * whole tile is a choose button instead. Status is never color alone: the
 * copied state carries a check icon and text.
 */

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateShort(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function mediaMetaLine(asset: MediaAsset): string {
  const dims =
    asset.width && asset.height ? `${asset.width}×${asset.height}` : null;
  return [
    asset.format.toUpperCase(),
    formatBytes(asset.bytes),
    dims,
    formatDateShort(asset.createdAt),
  ]
    .filter(Boolean)
    .join(" · ");
}

type MediaGridProps = {
  assets: MediaAsset[];
  /** Tiles get a ConfirmDialog-backed delete. Omit for read-only grids. */
  onDelete?: (asset: MediaAsset) => void | Promise<void>;
  /** Picker mode: clicking a tile chooses it. */
  onSelect?: (asset: MediaAsset) => void;
  /** Assets referenced by the catalog — delete stays visible but disabled. */
  inUseIds?: ReadonlySet<string>;
  className?: string;
};

export function MediaGrid({
  assets,
  onDelete,
  onSelect,
  inUseIds,
  className,
}: MediaGridProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  async function copyUrl(asset: MediaAsset) {
    try {
      await navigator.clipboard.writeText(asset.secureUrl);
    } catch {
      // Clipboard can be blocked (insecure context / permissions); the URL is
      // still visible via "Open", so only flash the failure state briefly.
    }
    setCopiedId(asset.publicId);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopiedId(null), 2000);
  }

  // Always `role="list"`: the picker tiles are buttons inside `li`s, not
  // `role="option"` children, so a `listbox` here would be broken ARIA (and
  // would hide the tiles from role-based selection).
  return (
    <ul
      role="list"
      aria-label={onSelect ? "Choose an image" : "Media assets"}
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7",
        className,
      )}
    >
      {assets.map((asset) => {
        const inUse = inUseIds?.has(asset.publicId) ?? false;
        const copied = copiedId === asset.publicId;
        const name = asset.basename;
        return (
          <li
            key={asset.publicId}
            className={cn(
              "group/media rounded-control border border-sidebar-border bg-card",
              onSelect && "transition-shadow hover:ring-2 hover:ring-ring/60",
            )}
          >
            <div className="relative aspect-square overflow-hidden rounded-t-[calc(var(--radius-control)-1px)] bg-surface-2">
              {onSelect ? (
                <button
                  type="button"
                  className="absolute inset-0 cursor-pointer"
                  aria-label={`Use image ${name}`}
                  onClick={() => onSelect(asset)}
                >
                  <Thumb asset={asset} />
                </button>
              ) : (
                <a
                  href={asset.secureUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute inset-0"
                  aria-label={`Open ${name} in a new tab`}
                >
                  <Thumb asset={asset} />
                </a>
              )}
            </div>
            <div className="space-y-1 px-2.5 py-2">
              <p
                className="truncate text-sm font-medium"
                title={asset.publicId}
              >
                {name}
              </p>
              <p className="text-xs text-muted-foreground">
                {asset.folder ? `${asset.folder}/ · ` : ""}
                {mediaMetaLine(asset)}
              </p>
              <div className="flex items-center gap-1 pt-0.5">
                <button
                  type="button"
                  onClick={() => void copyUrl(asset)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground",
                    "hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                  )}
                  aria-label={
                    copied ? `Link copied for ${name}` : `Copy link for ${name}`
                  }
                >
                  {copied ? (
                    <>
                      <Check
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="size-3.5 text-success"
                      />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="size-3.5"
                      />
                      Copy
                    </>
                  )}
                </button>
                {onDelete ? (
                  <ConfirmDialog
                    trigger={
                      <button
                        type="button"
                        disabled={inUse}
                        title={
                          inUse
                            ? "In use by the catalog — unlink it first"
                            : "Delete from Cloudinary"
                        }
                        className={cn(
                          "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium",
                          "text-destructive hover:bg-destructive-soft disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        )}
                        aria-label={`Delete ${name}`}
                      >
                        <Trash2
                          aria-hidden="true"
                          strokeWidth={1.75}
                          className="size-3.5"
                        />
                        Delete
                      </button>
                    }
                    title={`Delete ${name}?`}
                    description="This removes the file from Cloudinary for good. Assets still used by the catalog cannot be deleted until they are unlinked."
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() => onDelete(asset)}
                  />
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Thumb({ asset }: { asset: MediaAsset }) {
  return (
    <Image
      src={asset.thumbUrl || asset.secureUrl}
      alt=""
      fill
      sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 160px"
      className="size-full object-cover"
    />
  );
}

/** Same-footprint skeleton so the grid does not jump while loading. */
export function MediaGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="rounded-control border border-sidebar-border bg-card p-2.5"
        >
          <Skeleton className="aspect-square w-full rounded-t-none" />
          <Skeleton className="mt-2 h-4 w-2/3" />
          <Skeleton className="mt-1.5 h-3 w-full" />
          <Skeleton className="mt-2 h-6 w-1/2" />
        </div>
      ))}
    </div>
  );
}

/** Small label chip used where a folder needs an icon + text (never color alone). */
export function FolderTag({ folder }: { folder: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs text-muted-foreground">
      <Link2 aria-hidden="true" strokeWidth={1.75} className="size-3" />
      {folder || "unfiled"}
    </span>
  );
}
