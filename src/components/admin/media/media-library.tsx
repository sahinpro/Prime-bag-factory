"use client";

import { Images, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { deleteMediaAsset } from "@/app/(admin)/admin/(protected)/media/actions";
import { EmptyState } from "@/components/admin/data/empty-state";
import { ErrorState } from "@/components/admin/data/error-state";
import { FilterBar } from "@/components/admin/data/filter-bar";
import { ImageUploader } from "@/components/admin/forms/image-uploader";
import {
  MediaGrid,
  MediaGridSkeleton,
} from "@/components/admin/media/media-grid";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { MediaAsset, MediaFolder } from "@/lib/media.types";
import { MEDIA_FOLDERS } from "@/lib/media.types";

/**
 * MediaLibrary — the /admin/media page body (owner request 2026-10-25,
 * Shopify-style). Folder tabs, debounced name search and cursor pagination
 * are URL-synced (`folder`, `q`, `cursor`) so views are shareable. Upload
 * reuses the kit's ImageUploader against the same server-signed action;
 * delete goes through ConfirmDialog and is refused server-side while an
 * asset is still referenced by the catalog.
 */

type MediaLibraryProps = {
  assets: MediaAsset[];
  nextCursor: string | null;
  folder: MediaFolder | null;
  q: string;
  /** Cloudinary did not answer (unconfigured or Admin API failure). */
  failed: boolean;
};

export type MediaSearchParams = {
  folder?: string;
  q?: string;
  cursor?: string;
};

/**
 * URL for one folder view: the search text carries over, the cursor never
 * does (a folder change restarts the listing at page 1).
 */
function folderHref(key: MediaFolder | "all", q: string): string {
  const params = new URLSearchParams();
  if (key !== "all") params.set("folder", key);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/admin/media?${qs}` : "/admin/media";
}

/** Same underlined strip as the orders/quotes status tabs (plan 9c). */
function folderTabClass(isActive: boolean): string {
  return cn(
    "-mb-px flex shrink-0 items-center border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "border-foreground text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );
}

export function MediaLibrary({
  assets,
  nextCursor,
  folder,
  q,
  failed,
}: MediaLibraryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  // Opaque cursors are not human-friendly page numbers; we track how deep
  // into the cursor chain we are purely so "Back" can label itself sanely.
  const [pageDepth, setPageDepth] = React.useState(0);

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`/admin/media?${params.toString()}`);
  }

  function search(next: string) {
    setPageDepth(0);
    pushParams({ q: next || null, cursor: null });
  }

  function reset() {
    setPageDepth(0);
    router.push("/admin/media");
  }

  function nextPage() {
    if (!nextCursor) return;
    setPageDepth((d) => d + 1);
    pushParams({ cursor: nextCursor });
  }

  function prevPage() {
    // Without a client-side cursor stack a "back" can only clear the cursor
    // when depth is 1; deeper chains fall back to reloading page 1.
    setPageDepth((d) => Math.max(0, d - 1));
    pushParams({
      cursor: pageDepth <= 1 ? null : searchParams.get("cursor"),
    });
  }

  async function handleDelete(asset: MediaAsset) {
    // A rejected action (offline, server crash) must surface as a message, not
    // an unhandled rejection — the tile would look unchanged.
    let result: Awaited<ReturnType<typeof deleteMediaAsset>>;
    try {
      result = await deleteMediaAsset(asset.publicId);
    } catch {
      setDeleteError("Cloudinary did not answer. Try again in a moment.");
      return;
    }
    if (result.ok) {
      setDeleteError(null);
      router.refresh();
    } else {
      setDeleteError(result.error);
    }
  }

  const hasFilters = Boolean(folder || q);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Media Library"
        description="Every image stored in Cloudinary for the storefront, organized by folder."
        actions={
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-card">
              <DialogHeader>
                <DialogTitle>Upload an image</DialogTitle>
                <DialogDescription>
                  PNG, JPG, WebP or AVIF up to 5 MB. It lands in the folder
                  selected above (or the products folder when no folder is
                  picked) and stays reusable after the form it came from is
                  saved.
                </DialogDescription>
              </DialogHeader>
              <ImageUploader
                id="media-library-upload"
                folder={folder ?? "products"}
                preset="standard"
                label="File"
                value=""
                onChange={(url) => {
                  if (url) {
                    setUploadOpen(false);
                    router.refresh();
                  }
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Folder switcher is navigation, not a tabset: it changes the URL and
            the server re-renders one shared grid. Real links (kit convention,
            same as the orders status nav) keep middle-click/open-in-tab and
            avoid the aria-controls that a tab strip without TabsContent points
            at nothing. */}
        <nav
          aria-label="Filter media by folder"
          className="flex flex-wrap items-center gap-1 border-b border-border"
        >
          {(["all", ...MEDIA_FOLDERS] as const).map((key) => {
            const isActive = key === (folder ?? "all");
            return (
              <Link
                key={key}
                href={folderHref(key, q)}
                onClick={() => setPageDepth(0)}
                aria-current={isActive ? "page" : undefined}
                className={folderTabClass(isActive)}
              >
                {key === "all" ? "All" : key}
              </Link>
            );
          })}
        </nav>
        <FilterBar
          value={q}
          onSearch={search}
          onReset={reset}
          canReset={hasFilters}
          label="Search media"
          placeholder="Search by file name…"
          className="w-full lg:w-72"
        />
      </div>

      {deleteError ? (
        <ErrorState
          title="Delete refused"
          message={deleteError}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteError(null)}
            >
              Dismiss
            </Button>
          }
        />
      ) : null}

      {failed ? (
        <ErrorState
          title="Could not reach Cloudinary"
          message="Media storage is not configured on this server or the Admin API did not answer."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.refresh()}
            >
              Try again
            </Button>
          }
        />
      ) : assets.length === 0 && !hasFilters ? (
        <div className="rounded-control border border-sidebar-border">
          <EmptyState
            icon={Images}
            title="No media yet"
            description="Images uploaded from product, category, collection and swatch editors will show up here."
            action={
              <Button onClick={() => setUploadOpen(true)}>
                <Upload
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                Upload the first image
              </Button>
            }
          />
        </div>
      ) : assets.length === 0 ? (
        <div className="rounded-control border border-sidebar-border">
          <EmptyState
            icon={Images}
            title="Nothing matches"
            description="No images in this folder match your search."
            action={
              <Button variant="outline" onClick={reset}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <MediaGrid assets={assets} onDelete={handleDelete} />
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {assets.length === 0
            ? "No images"
            : `Page ${pageDepth + 1} · ${assets.length} image${assets.length === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pageDepth === 0 && !searchParams.get("cursor")}
            onClick={prevPage}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextCursor}
            onClick={nextPage}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Suspense fallback matching the page's final dimensions (plan 9c.1.4). */
export function MediaLibrarySkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2 border-b border-border pb-5">
        <div className="h-8 w-44 animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none" />
      </div>
      <MediaGridSkeleton count={10} />
    </div>
  );
}
