"use client";

import { Trash } from "lucide-react";
import * as React from "react";

import { BilingualField } from "@/components/admin/forms/bilingual-field";
import { ConfirmDialog } from "@/components/admin/forms/confirm-dialog";
import { FormSection } from "@/components/admin/forms/form-section";
import { ImageUploader } from "@/components/admin/forms/image-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { slugify } from "@/lib/slug";
import type { CollectionInput } from "@/lib/validators/collection";
import type { AdminCollection } from "@/server/collections";

type FormState = {
  name_en: string;
  name_bn: string;
  description_en: string;
  description_bn: string;
  slug: string;
  image_path: string;
  sort_order: number;
  is_active: boolean;
};

function initialState(collection?: AdminCollection, nextSort = 0): FormState {
  return {
    name_en: collection?.name_en ?? "",
    name_bn: collection?.name_bn ?? "",
    description_en: collection?.description_en ?? "",
    description_bn: collection?.description_bn ?? "",
    slug: collection?.slug ?? "",
    image_path: collection?.image_path ?? "",
    sort_order: collection?.sort_order ?? nextSort,
    is_active: collection?.is_active ?? true,
  };
}

/**
 * CollectionEditor (plan 9c.8 "DataTable + side Sheet editor"): the create/edit
 * drawer. Bilingual name/description via `BilingualField`, an auto-generated slug,
 * a sort order, an active toggle and a delete `ConfirmDialog`. Save/Cancel live in
 * the sticky `SheetFooter` (the Sheet analogue of the page `StickySaveBar`). Media
 * picking for `image_path` arrives with the Media task; until then it is a path
 * field. The parent controls `open` and remounts via `key` per selection.
 */
export function CollectionEditor({
  open,
  onOpenChange,
  collection,
  nextSortOrder = 0,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection?: AdminCollection;
  nextSortOrder?: number;
  onSave: (payload: CollectionInput & { id?: string }) => Promise<boolean>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [form, setForm] = React.useState<FormState>(() =>
    initialState(collection, nextSortOrder),
  );
  const [slugEdited, setSlugEdited] = React.useState(Boolean(collection));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const initial = React.useMemo(
    () => initialState(collection, nextSortOrder),
    [collection, nextSortOrder],
  );

  const dirty = React.useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial],
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setNameEn(value: string) {
    setForm((prev) => ({
      ...prev,
      name_en: value,
      slug: slugEdited ? prev.slug : slugify(value),
    }));
  }

  function buildPayload(): CollectionInput & { id?: string } {
    return {
      id: collection?.id,
      name_en: form.name_en,
      name_bn: form.name_bn || undefined,
      description_en: form.description_en || undefined,
      description_bn: form.description_bn || undefined,
      slug: form.slug || undefined,
      image_path: form.image_path || undefined,
      sort_order: form.sort_order,
      is_active: form.is_active,
    };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const ok = await onSave(buildPayload());
    setSaving(false);
    if (!ok) setError("Could not save. Check the fields and try again.");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>
            {collection ? "Edit collection" : "New collection"}
          </SheetTitle>
          <SheetDescription>
            Collections cross-list products by industry without duplicating
            them.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          <FormSection title="Basics" description="The display name and order.">
            <BilingualField
              id="collection-name"
              label="Name"
              required
              valueEn={form.name_en}
              valueBn={form.name_bn}
              onChangeEn={setNameEn}
              onChangeBn={(v) => set("name_bn", v)}
            />
            <div className="space-y-1.5">
              <Label htmlFor="collection-slug">Slug</Label>
              <Input
                id="collection-slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  set("slug", e.target.value);
                }}
                placeholder="auto-generated-from-name"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase, hyphenated English. Used in public collection URLs.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="collection-sort">Sort order</Label>
                <Input
                  id="collection-sort"
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) =>
                    set("sort_order", Number(e.target.value) || 0)
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-3 self-end rounded-control border border-sidebar-border bg-surface-2 px-3 py-2">
                <Label htmlFor="collection-active" className="text-sm">
                  Active
                </Label>
                <Switch
                  id="collection-active"
                  checked={form.is_active}
                  onCheckedChange={(v) => set("is_active", v)}
                />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Description"
            description="Shown on the collection page."
          >
            <BilingualField
              id="collection-description"
              label="Description"
              multiline
              valueEn={form.description_en}
              valueBn={form.description_bn}
              onChangeEn={(v) => set("description_en", v)}
              onChangeBn={(v) => set("description_bn", v)}
            />
          </FormSection>

          <FormSection title="Image" description="Collection thumbnail.">
            <ImageUploader
              id="collection-image"
              label="Collection image"
              folder="collections"
              value={form.image_path}
              onChange={(url) => set("image_path", url)}
              hint="Shown on the collection tile. PNG, JPG, WebP or AVIF, up to 5 MB."
            />
          </FormSection>

          {error ? (
            <p role="alert" className="py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {collection && onDelete ? (
            <div className="flex items-center justify-between gap-4 border-t border-border py-6">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Delete this collection
                </p>
                <p className="text-xs text-muted-foreground">
                  Products keep existing but lose this collection tag.
                </p>
              </div>
              <ConfirmDialog
                destructive
                title={`Delete “${collection.name_en}”?`}
                description="This removes the collection and unlinks it from every product. This cannot be undone."
                confirmLabel="Delete collection"
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="size-4"
                    />
                    Delete
                  </Button>
                }
                onConfirm={async () => {
                  await onDelete(collection.id);
                }}
              />
            </div>
          ) : null}
        </div>

        <SheetFooter className="border-t border-border sm:justify-between">
          {collection && onDelete ? null : (
            <span className="text-sm text-muted-foreground">
              {dirty ? "Unsaved changes" : "Nothing to save yet"}
            </span>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setForm(initial);
                setSlugEdited(Boolean(collection));
                setError(null);
                onOpenChange(false);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
