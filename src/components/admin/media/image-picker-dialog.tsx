"use client";

import { Images } from "lucide-react";
import * as React from "react";

import { listMediaAssets } from "@/app/(admin)/admin/(protected)/media/actions";
import { EmptyState } from "@/components/admin/data/empty-state";
import { ErrorState } from "@/components/admin/data/error-state";
import { FilterBar } from "@/components/admin/data/filter-bar";
import {
  MediaGrid,
  MediaGridSkeleton,
} from "@/components/admin/media/media-grid";
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
 * ImagePickerDialog (plan 9c kit, Media Library task): the Shopify-style
 * "Library" half of an image field — browse everything already uploaded to
 * Cloudinary and reuse it instead of paying for a second copy. Opens lazily
 * and fetches through the role-gated `listMediaAssets` server action, so the
 * Admin API secret never leaves the server. `folderHint` preselects the
 * folder the field normally uploads to, but staff can roam the whole tree.
 */
export function ImagePickerDialog({
  trigger,
  onSelect,
  folderHint,
}: {
  trigger: React.ReactElement;
  onSelect: (asset: MediaAsset) => void;
  folderHint?: MediaFolder;
}) {
  const [open, setOpen] = React.useState(false);
  const [folder, setFolder] = React.useState<MediaFolder | "all">(
    folderHint ?? "all",
  );
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [assets, setAssets] = React.useState<MediaAsset[]>([]);

  async function load(target: MediaFolder | "all") {
    setStatus("loading");
    // A rejected action leaves the dialog on its error state rather than an
    // endless skeleton.
    const result = await listMediaAssets(
      target === "all" ? undefined : target,
    ).catch(() => null);
    if (result?.ok) {
      setAssets(result.assets);
      setStatus("idle");
    } else {
      setStatus("error");
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && status === "idle" && assets.length === 0) void load(folder);
  }

  const needle = q.trim().toLowerCase();
  const visible = needle
    ? assets.filter((a) => a.basename.toLowerCase().includes(needle))
    : assets;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-card sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Media Library</DialogTitle>
          <DialogDescription>
            Click an image to reuse it. Everything here already lives in
            Cloudinary — no new upload.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Toggle buttons, not tabs: the folder switch filters one grid in
              place, so there is no tab panel for aria-controls to point at. */}
          <div
            role="group"
            aria-label="Filter library by folder"
            className="flex max-w-full flex-wrap items-center gap-1"
          >
            {(["all", ...MEDIA_FOLDERS] as const).map((key) => {
              const isActive = key === folder;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => {
                    setFolder(key);
                    void load(key);
                  }}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-sm font-medium transition-colors",
                    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    isActive
                      ? "border-sidebar-border bg-surface-2 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  {key === "all" ? "All" : key}
                </button>
              );
            })}
          </div>
          <FilterBar
            value={q}
            onSearch={setQ}
            onReset={() => setQ("")}
            canReset={Boolean(q)}
            label="Search library"
            placeholder="Search by file name…"
            className="w-full sm:w-60"
          />
        </div>

        {status === "loading" ? (
          <MediaGridSkeleton count={8} />
        ) : status === "error" ? (
          <ErrorState
            title="Could not reach Cloudinary"
            message="The media library did not answer. Try again."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => void load(folder)}
              >
                Try again
              </Button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Images}
            title={needle ? "Nothing matches" : "This folder is empty"}
            description={
              needle
                ? "No images in this folder match your search."
                : "Upload from a product, category, collection or swatch editor and it will show up here."
            }
          />
        ) : (
          <MediaGrid
            assets={visible}
            onSelect={(asset) => {
              onSelect(asset);
              setOpen(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
