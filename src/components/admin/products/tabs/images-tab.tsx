"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { saveImages } from "@/app/(admin)/admin/products/actions";
import { BilingualField } from "@/components/admin/forms/bilingual-field";
import { FormSection } from "@/components/admin/forms/form-section";
import { ImageUploader } from "@/components/admin/forms/image-uploader";
import { StickySaveBar } from "@/components/admin/forms/sticky-save-bar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AdminProduct } from "@/server/products";
import { FlashLine, useActionSave } from "../use-action-save";

const NONE = "__none__";

type ImageDraft = {
  key: string;
  path: string;
  alt_en: string;
  alt_bn: string;
  variant_id: string;
};

function toDrafts(product: AdminProduct): ImageDraft[] {
  return product.images.map((im, i) => ({
    key: im.id || `im-${i}`,
    path: im.path,
    alt_en: im.alt_en ?? "",
    alt_bn: im.alt_bn ?? "",
    variant_id: im.variant_id ?? "",
  }));
}

function variantLabel(id: string, variants: AdminProduct["variants"]): string {
  const v = variants.find((x) => x.id === id);
  if (!v) return "Main image";
  return [v.color_name, v.size, v.sku].filter(Boolean).join(" · ") || v.sku;
}

/**
 * Images tab (plan 9c.5 / 9c.8): Cloudinary upload per image, bilingual alt text,
 * an optional variant link and reorder with keyboard-reachable buttons. Order in
 * the list becomes `sort_order` on save; the first image is the thumbnail. The
 * whole set is replaced through `saveImages`.
 */
export function ImagesTab({ product }: Readonly<{ product: AdminProduct }>) {
  const baseline = React.useMemo(() => toDrafts(product), [product]);
  const [rows, setRows] = React.useState<ImageDraft[]>(baseline);
  const { saving, flash, run } = useActionSave();

  const [prevBaseline, setPrevBaseline] = React.useState(baseline);
  if (prevBaseline !== baseline) {
    setPrevBaseline(baseline);
    setRows(baseline);
  }

  const dirty = React.useMemo(
    () => JSON.stringify(rows) !== JSON.stringify(baseline),
    [rows, baseline],
  );

  function update(key: string, patch: Partial<ImageDraft>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  function add() {
    setRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}-${prev.length}`,
        path: "",
        alt_en: "",
        alt_bn: "",
        variant_id: "",
      },
    ]);
  }

  function remove(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const usable = rows.filter((r) => r.path.trim() !== "");

  async function save() {
    await run(
      () =>
        saveImages(
          product.id,
          usable.map((r) => ({
            path: r.path,
            alt_en: r.alt_en || undefined,
            alt_bn: r.alt_bn || undefined,
            sort_order: 0,
            variant_id: r.variant_id || undefined,
          })),
        ),
      "Images saved.",
    );
  }

  return (
    <div className="space-y-2">
      <FlashLine flash={flash} />

      <FormSection
        title="Images"
        description="The first image is the thumbnail. Add alt text in both languages."
      >
        {rows.length === 0 ? (
          <p className="rounded-control border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No images yet. The product page needs at least one.
          </p>
        ) : (
          <ul className="space-y-4">
            {rows.map((row, index) => (
              <li
                key={row.key}
                className="space-y-3 rounded-card border border-border bg-surface-2/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">
                    Image {index + 1}
                    {index === 0 ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        thumbnail
                      </span>
                    ) : null}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={`Move image ${index + 1} up`}
                    >
                      <ArrowUp aria-hidden="true" strokeWidth={1.75} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === rows.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={`Move image ${index + 1} down`}
                    >
                      <ArrowDown aria-hidden="true" strokeWidth={1.75} />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(row.key)}
                      aria-label={`Remove image ${index + 1}`}
                    >
                      <Trash2 aria-hidden="true" strokeWidth={1.75} />
                    </Button>
                  </div>
                </div>

                <ImageUploader
                  id={`img-${row.key}`}
                  label="Product image"
                  folder="products"
                  value={row.path}
                  onChange={(url) => update(row.key, { path: url })}
                  allowLibrary
                />

                <div className="grid gap-3 lg:grid-cols-2">
                  <BilingualField
                    id={`alt-${row.key}`}
                    label="Alt text"
                    valueEn={row.alt_en}
                    valueBn={row.alt_bn}
                    onChangeEn={(v) => update(row.key, { alt_en: v })}
                    onChangeBn={(v) => update(row.key, { alt_bn: v })}
                  />
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor={`variant-${row.key}`} className="text-sm">
                      Linked variant
                    </Label>
                    <Select
                      value={row.variant_id || NONE}
                      onValueChange={(v) =>
                        update(row.key, { variant_id: v === NONE ? "" : v })
                      }
                    >
                      <SelectTrigger id={`variant-${row.key}`}>
                        <SelectValue placeholder="Main image" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Main image</SelectItem>
                        {product.variants.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {variantLabel(v.id, product.variants)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
          Add image
        </Button>
      </FormSection>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onDiscard={() => setRows(baseline)}
      />
    </div>
  );
}
