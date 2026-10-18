"use client";

import { Trash } from "lucide-react";
import * as React from "react";

import { BilingualField } from "@/components/admin/forms/bilingual-field";
import { ConfirmDialog } from "@/components/admin/forms/confirm-dialog";
import { FormSection } from "@/components/admin/forms/form-section";
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
import { slugify } from "@/lib/slug";
import type { SwatchGroupInput } from "@/lib/validators/swatch";
import type { AdminSwatchGroup } from "@/server/swatches";

type FormState = {
  key: string;
  name_en: string;
  name_bn: string;
  sort_order: number;
};

function initialState(group?: AdminSwatchGroup, nextSort = 0): FormState {
  return {
    key: group?.key ?? "",
    name_en: group?.name_en ?? "",
    name_bn: group?.name_bn ?? "",
    sort_order: group?.sort_order ?? nextSort,
  };
}

/** Group key helper: lowercase, underscore-separated machine id (body_fabric). */
function keyify(value: string): string {
  return slugify(value).replace(/-/g, "_");
}

/**
 * SwatchGroupEditor — the create/edit drawer for a swatch group (plan 9c.8 "Swatch
 * Library"). Bilingual name, an auto-generated machine key and a sort order; a
 * `ConfirmDialog` delete. The parent controls `open` and remounts via `key`.
 */
export function SwatchGroupEditor({
  open,
  onOpenChange,
  group,
  nextSortOrder = 0,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: AdminSwatchGroup;
  nextSortOrder?: number;
  onSave: (payload: SwatchGroupInput & { id?: string }) => Promise<boolean>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [form, setForm] = React.useState<FormState>(() =>
    initialState(group, nextSortOrder),
  );
  const [keyEdited, setKeyEdited] = React.useState(Boolean(group));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const initial = React.useMemo(
    () => initialState(group, nextSortOrder),
    [group, nextSortOrder],
  );
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function setNameEn(value: string) {
    setForm((prev) => ({
      ...prev,
      name_en: value,
      key: keyEdited ? prev.key : keyify(value),
    }));
  }

  function buildPayload(): SwatchGroupInput & { id?: string } {
    return {
      id: group?.id,
      key: form.key,
      name_en: form.name_en,
      name_bn: form.name_bn || undefined,
      sort_order: form.sort_order,
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
          <SheetTitle>{group ? "Edit group" : "New group"}</SheetTitle>
          <SheetDescription>
            A group is a set of swatches used together, like body fabric or
            handles.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          <FormSection title="Group" description="Name and machine key.">
            <BilingualField
              id="group-name"
              label="Name"
              required
              valueEn={form.name_en}
              valueBn={form.name_bn}
              onChangeEn={setNameEn}
              onChangeBn={(v) => set("name_bn", v)}
            />
            <div className="space-y-1.5">
              <Label htmlFor="group-key">Key</Label>
              <Input
                id="group-key"
                value={form.key}
                onChange={(e) => {
                  setKeyEdited(true);
                  set("key", e.target.value);
                }}
                placeholder="body_fabric"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, underscore or hyphen. Used by the
                builder and imports.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="group-sort">Sort order</Label>
              <Input
                id="group-sort"
                type="number"
                min={0}
                value={form.sort_order}
                onChange={(e) => set("sort_order", Number(e.target.value) || 0)}
              />
            </div>
          </FormSection>

          {error ? (
            <p role="alert" className="py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {group && onDelete ? (
            <div className="flex items-center justify-between gap-4 border-t border-border py-6">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Delete this group
                </p>
                <p className="text-xs text-muted-foreground">
                  Removes every swatch in the group. Blocked if a swatch is in
                  use.
                </p>
              </div>
              <ConfirmDialog
                destructive
                title={`Delete “${group.name_en}”?`}
                description="This deletes the group and all of its swatches. Swatches used by products must be reassigned first. This cannot be undone."
                confirmLabel="Delete group"
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
                  await onDelete(group.id);
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
                setKeyEdited(Boolean(group));
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
