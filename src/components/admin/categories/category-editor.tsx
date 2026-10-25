"use client";

import { Trash } from "lucide-react";
import * as React from "react";

import { BilingualField } from "@/components/admin/forms/bilingual-field";
import { ConfirmDialog } from "@/components/admin/forms/confirm-dialog";
import { FormSection } from "@/components/admin/forms/form-section";
import { ImageUploader } from "@/components/admin/forms/image-uploader";
import { StickySaveBar } from "@/components/admin/forms/sticky-save-bar";
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
import { Switch } from "@/components/ui/switch";
import { slugify } from "@/lib/slug";
import type { CategoryInput } from "@/lib/validators/category";
import type { AdminCategory } from "@/server/categories";

const ROOT = "root";

type FormState = {
  name_en: string;
  name_bn: string;
  description_en: string;
  description_bn: string;
  seo_title_en: string;
  seo_title_bn: string;
  seo_description_en: string;
  seo_description_bn: string;
  slug: string;
  parent_id: string; // "root" or a category id
  image_path: string;
  is_active: boolean;
};

function initialState(category?: AdminCategory): FormState {
  return {
    name_en: category?.name_en ?? "",
    name_bn: category?.name_bn ?? "",
    description_en: category?.description_en ?? "",
    description_bn: category?.description_bn ?? "",
    seo_title_en: category?.seo_title_en ?? "",
    seo_title_bn: category?.seo_title_bn ?? "",
    seo_description_en: category?.seo_description_en ?? "",
    seo_description_bn: category?.seo_description_bn ?? "",
    slug: category?.slug ?? "",
    parent_id: category?.parent_id ?? ROOT,
    image_path: category?.image_path ?? "",
    is_active: category?.is_active ?? true,
  };
}

/**
 * CategoryEditor (plan 9c.8): the right-hand panel. Bilingual name / description /
 * SEO via `BilingualField`, an auto-generated slug, parent select, an active
 * toggle and a delete `ConfirmDialog`. Media picking for `image_path` arrives with
 * the Media task; until then it is a plain path field. Remount per selection (the
 * parent passes `key`) so state resets cleanly.
 */
export function CategoryEditor({
  category,
  parentOptions,
  initialSortOrder,
  onSave,
  onDelete,
}: {
  category?: AdminCategory;
  parentOptions: { id: string; name: string }[];
  initialSortOrder: number;
  onSave: (payload: CategoryInput & { id?: string }) => Promise<boolean>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [form, setForm] = React.useState<FormState>(() =>
    initialState(category),
  );
  const [slugEdited, setSlugEdited] = React.useState(Boolean(category));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const initial = React.useMemo(() => initialState(category), [category]);

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

  function buildPayload(): CategoryInput & { id?: string } {
    return {
      id: category?.id,
      name_en: form.name_en,
      name_bn: form.name_bn || undefined,
      description_en: form.description_en || undefined,
      description_bn: form.description_bn || undefined,
      seo_title_en: form.seo_title_en || undefined,
      seo_title_bn: form.seo_title_bn || undefined,
      seo_description_en: form.seo_description_en || undefined,
      seo_description_bn: form.seo_description_bn || undefined,
      slug: form.slug || undefined,
      parent_id: form.parent_id === ROOT ? "" : form.parent_id,
      image_path: form.image_path || undefined,
      sort_order: category?.sort_order ?? initialSortOrder,
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
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="truncate text-sm font-medium">
          {category ? category.name_en : "New category"}
        </h2>
        {category && onDelete ? (
          <ConfirmDialog
            destructive
            title={`Delete “${category.name_en}”?`}
            description="This removes the category. Subcategories move up one level. Products still linked to it must be unlinked first."
            confirmLabel="Delete category"
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
              await onDelete(category.id);
            }}
          />
        ) : null}
      </div>

      <FormSection title="Basics" description="The display name and hierarchy.">
        <BilingualField
          id="category-name"
          label="Name"
          required
          valueEn={form.name_en}
          valueBn={form.name_bn}
          onChangeEn={setNameEn}
          onChangeBn={(v) => set("name_bn", v)}
        />
        <div className="space-y-1.5">
          <Label htmlFor="category-parent">Parent</Label>
          <Select
            value={form.parent_id}
            onValueChange={(v) => set("parent_id", v)}
          >
            <SelectTrigger id="category-parent">
              <SelectValue placeholder="No parent (top level)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROOT}>No parent (top level)</SelectItem>
              {parentOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="category-slug">Slug</Label>
          <Input
            id="category-slug"
            value={form.slug}
            onChange={(e) => {
              setSlugEdited(true);
              set("slug", e.target.value);
            }}
            placeholder="auto-generated-from-name"
          />
          <p className="text-xs text-muted-foreground">
            Lowercase, hyphenated English. Used in public category URLs.
          </p>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-control border border-sidebar-border bg-surface-2 px-3 py-2">
          <div>
            <Label htmlFor="category-active" className="text-sm">
              Active
            </Label>
            <p className="text-xs text-muted-foreground">
              Inactive categories are hidden from the store.
            </p>
          </div>
          <Switch
            id="category-active"
            checked={form.is_active}
            onCheckedChange={(v) => set("is_active", v)}
          />
        </div>
      </FormSection>

      <FormSection
        title="Description"
        description="Shown on the category page."
      >
        <BilingualField
          id="category-description"
          label="Description"
          multiline
          valueEn={form.description_en}
          valueBn={form.description_bn}
          onChangeEn={(v) => set("description_en", v)}
          onChangeBn={(v) => set("description_bn", v)}
        />
      </FormSection>

      <FormSection title="Image" description="Category thumbnail.">
        <ImageUploader
          id="category-image"
          label="Category image"
          folder="categories"
          value={form.image_path}
          onChange={(url) => set("image_path", url)}
          hint="Shown on category tiles. PNG, JPG, WebP or AVIF, up to 5 MB."
          allowLibrary
        />
      </FormSection>

      <FormSection
        title="SEO"
        description="Search engine title and meta description."
      >
        <BilingualField
          id="category-seo-title"
          label="SEO title"
          valueEn={form.seo_title_en}
          valueBn={form.seo_title_bn}
          onChangeEn={(v) => set("seo_title_en", v)}
          onChangeBn={(v) => set("seo_title_bn", v)}
        />
        <BilingualField
          id="category-seo-description"
          label="SEO description"
          multiline
          valueEn={form.seo_description_en}
          valueBn={form.seo_description_bn}
          onChangeEn={(v) => set("seo_description_en", v)}
          onChangeBn={(v) => set("seo_description_bn", v)}
        />
      </FormSection>

      {error ? (
        <p role="alert" className="px-1 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onDiscard={() => {
          setForm(initial);
          setSlugEdited(Boolean(category));
          setError(null);
        }}
      />
    </div>
  );
}
