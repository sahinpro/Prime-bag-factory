"use client";

import { Trash } from "lucide-react";
import * as React from "react";

import { SwatchChip } from "@/components/admin/catalog/swatch-chip";
import { BilingualField } from "@/components/admin/forms/bilingual-field";
import { ConfirmDialog } from "@/components/admin/forms/confirm-dialog";
import { FormSection } from "@/components/admin/forms/form-section";
import { ImageUploader } from "@/components/admin/forms/image-uploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { SwatchInput } from "@/lib/validators/swatch";
import type { AdminSwatch, AdminSwatchGroup } from "@/server/swatches";

type FormState = {
  group_id: string;
  name_en: string;
  name_bn: string;
  code: string;
  color_hex: string;
  texture_image_path: string;
  sort_order: number;
  is_active: boolean;
};

function initialState(
  swatch?: AdminSwatch,
  defaultGroupId?: string,
  nextSort = 0,
): FormState {
  return {
    group_id: swatch?.group_id ?? defaultGroupId ?? "",
    name_en: swatch?.name_en ?? "",
    name_bn: swatch?.name_bn ?? "",
    code: swatch?.code ?? "",
    color_hex: swatch?.color_hex ?? "",
    texture_image_path: swatch?.texture_image_path ?? "",
    sort_order: swatch?.sort_order ?? nextSort,
    is_active: swatch?.is_active ?? true,
  };
}

/**
 * SwatchEditor — create/edit drawer for a single swatch (plan 9c.8 "Swatch
 * Library ... Sheet editor with texture upload"). Bilingual name, fabric code,
 * hex color, a texture image via the Cloudinary `ImageUploader`, order and an
 * active switch. `group_id` is a select so a swatch can be moved between groups.
 */
export function SwatchEditor({
  open,
  onOpenChange,
  swatch,
  groups,
  defaultGroupId,
  nextSortOrder = 0,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  swatch?: AdminSwatch;
  groups: AdminSwatchGroup[];
  defaultGroupId?: string;
  nextSortOrder?: number;
  onSave: (payload: SwatchInput & { id?: string }) => Promise<boolean>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [form, setForm] = React.useState<FormState>(() =>
    initialState(swatch, defaultGroupId, nextSortOrder),
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const initial = React.useMemo(
    () => initialState(swatch, defaultGroupId, nextSortOrder),
    [swatch, defaultGroupId, nextSortOrder],
  );
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload(): SwatchInput & { id?: string } {
    return {
      id: swatch?.id,
      group_id: form.group_id,
      name_en: form.name_en,
      name_bn: form.name_bn || undefined,
      code: form.code || undefined,
      color_hex: form.color_hex || undefined,
      texture_image_path: form.texture_image_path || undefined,
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
          <SheetTitle>{swatch ? "Edit swatch" : "New swatch"}</SheetTitle>
          <SheetDescription>
            A swatch is one fabric color option customers can pick.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          <FormSection
            title="Swatch"
            description="Which group and how it is named."
          >
            <div className="space-y-1.5">
              <Label htmlFor="swatch-group">Group</Label>
              <Select
                value={form.group_id}
                onValueChange={(v) => set("group_id", v)}
              >
                <SelectTrigger id="swatch-group" className="w-full">
                  <SelectValue placeholder="Choose a group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <BilingualField
              id="swatch-name"
              label="Name"
              required
              valueEn={form.name_en}
              valueBn={form.name_bn}
              onChangeEn={(v) => set("name_en", v)}
              onChangeBn={(v) => set("name_bn", v)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="swatch-code">Fabric code</Label>
                <Input
                  id="swatch-code"
                  value={form.code}
                  onChange={(e) => set("code", e.target.value)}
                  placeholder="JUTE-01"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="swatch-sort">Sort order</Label>
                <Input
                  id="swatch-sort"
                  type="number"
                  min={0}
                  value={form.sort_order}
                  onChange={(e) =>
                    set("sort_order", Number(e.target.value) || 0)
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-control border border-sidebar-border bg-surface-2 px-3 py-2">
              <Label htmlFor="swatch-active" className="text-sm">
                Active
              </Label>
              <Switch
                id="swatch-active"
                checked={form.is_active}
                onCheckedChange={(v) => set("is_active", v)}
              />
            </div>
          </FormSection>

          <FormSection
            title="Color"
            description="A solid hex fallback shown when there is no texture photo."
          >
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="swatch-hex">Hex</Label>
                <Input
                  id="swatch-hex"
                  value={form.color_hex}
                  onChange={(e) => set("color_hex", e.target.value)}
                  placeholder="#c8a86a"
                />
              </div>
              <div aria-hidden="true" className="pb-1">
                <SwatchChip colorHex={form.color_hex || "#e5e5e5"} size={40} />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Texture photo"
            description="A close-up of the real fabric, if you have one."
          >
            <ImageUploader
              id="swatch-texture"
              label="Texture image"
              folder="swatches"
              aspect="square"
              value={form.texture_image_path}
              onChange={(url) => set("texture_image_path", url)}
              hint="A square crop works best. PNG, JPG, WebP or AVIF, up to 5 MB."
            />
          </FormSection>

          {error ? (
            <p role="alert" className="py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {swatch && onDelete ? (
            <div className="flex items-center justify-between gap-4 border-t border-border py-6">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Delete this swatch
                </p>
                <p className="text-xs text-muted-foreground">
                  Blocked while any product variant or builder option uses it.
                </p>
              </div>
              <ConfirmDialog
                destructive
                title={`Delete “${swatch.name_en}”?`}
                description="This removes the swatch from the library. It cannot be used again until recreated. This cannot be undone."
                confirmLabel="Delete swatch"
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
                  await onDelete(swatch.id);
                }}
              />
            </div>
          ) : null}
        </div>

        <SheetFooter className="border-t border-border sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {dirty ? "Unsaved changes" : "Nothing to save yet"}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setForm(initial);
                setError(null);
                onOpenChange(false);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !dirty || !form.group_id}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
