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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
          <Tabs
            value={folder}
            onValueChange={(v) => {
              const next = v as MediaFolder | "all";
              setFolder(next);
              void load(next);
            }}
          >
            <TabsList className="h-auto max-w-full flex-wrap justify-start gap-1 bg-transparent p-0">
              <TabsTrigger value="all" className="rounded-md px-2.5 text-xs">
                All
              </TabsTrigger>
              {MEDIA_FOLDERS.map((f) => (
                <TabsTrigger
                  key={f}
                  value={f}
                  className="rounded-md px-2.5 text-xs capitalize"
                >
                  {f}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
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
