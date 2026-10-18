"use client";

import * as React from "react";

import {
  setProductCategories,
  setProductCollections,
} from "@/app/(admin)/admin/products/actions";
import { FormSection } from "@/components/admin/forms/form-section";
import { StickySaveBar } from "@/components/admin/forms/sticky-save-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { AdminProduct, listRelationOptions } from "@/server/products";
import { FlashLine, useActionSave } from "../use-action-save";

type RelationOptions = Awaited<ReturnType<typeof listRelationOptions>>;

/**
 * Relations tab (plan 9c.8 "categories, collections"): pick the categories this
 * product belongs to (one primary, which drives breadcrumb + category URL) and
 * any collections it is cross-listed in. Saving replaces both join sets through
 * `setProductCategories` / `setProductCollections`.
 */
export function RelationsTab({
  product,
  options,
}: Readonly<{ product: AdminProduct; options: RelationOptions }>) {
  const baseCategories = React.useMemo(
    () => product.category_ids.map((c) => c.category_id),
    [product],
  );
  const basePrimary = React.useMemo(
    () => product.category_ids.find((c) => c.is_primary)?.category_id ?? "",
    [product],
  );
  const baseCollections = React.useMemo(
    () => [...product.collection_ids].sort(),
    [product],
  );

  const [selectedCategories, setSelectedCategories] =
    React.useState<string[]>(baseCategories);
  const [primary, setPrimary] = React.useState<string>(basePrimary);
  const [selectedCollections, setSelectedCollections] =
    React.useState<string[]>(baseCollections);
  const { saving, flash, run } = useActionSave();

  const [prevKey, setPrevKey] = React.useState("");
  const currentKey = `${product.id}`;
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setSelectedCategories(baseCategories);
    setPrimary(basePrimary);
    setSelectedCollections(baseCollections);
  }

  const dirty =
    JSON.stringify([...selectedCategories].sort()) !==
      JSON.stringify([...baseCategories].sort()) ||
    (baseCategories.length > 0 ? primary !== basePrimary : primary !== "") ||
    JSON.stringify([...selectedCollections].sort()) !==
      JSON.stringify(baseCollections);

  function toggleCategory(id: string) {
    setSelectedCategories((prev) => {
      const next = prev.includes(id)
        ? prev.filter((c) => c !== id)
        : [...prev, id];
      if (!next.includes(primary)) setPrimary(next[0] ?? "");
      return next;
    });
  }

  function toggleCollection(id: string) {
    setSelectedCollections((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function save() {
    const cats = selectedCategories.map((category_id) => ({
      category_id,
      is_primary: category_id === primary,
    }));
    await run(async () => {
      const first = await setProductCategories(product.id, cats);
      if (!first.ok) return first;
      return setProductCollections(product.id, selectedCollections);
    }, "Categories and collections saved.");
  }

  return (
    <div className="space-y-2">
      <FlashLine flash={flash} />

      <FormSection
        title="Categories"
        description="Where the product lives in the catalog tree. Pick one primary."
      >
        {options.categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No categories exist yet — create some under Categories.
          </p>
        ) : (
          <ul className="space-y-2">
            {options.categories.map((cat) => {
              const checked = selectedCategories.includes(cat.id);
              return (
                <li key={cat.id} className="flex items-center gap-3">
                  <div className="flex flex-1 items-center gap-2">
                    <Checkbox
                      id={`cat-${cat.id}`}
                      checked={checked}
                      onCheckedChange={() => toggleCategory(cat.id)}
                    />
                    <Label htmlFor={`cat-${cat.id}`} className="font-normal">
                      {cat.name_en}
                    </Label>
                  </div>
                  {checked ? (
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="radio"
                        name="primary-category"
                        className="size-4 accent-current"
                        checked={primary === cat.id}
                        onChange={() => setPrimary(cat.id)}
                        aria-label={`Set ${cat.name_en} as primary`}
                      />
                      Primary
                    </label>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </FormSection>

      <FormSection
        title="Collections"
        description="Cross-list this product into themed collections."
      >
        {options.collections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No collections exist yet.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {options.collections.map((col) => {
              const checked = selectedCollections.includes(col.id);
              return (
                <li key={col.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`col-${col.id}`}
                    checked={checked}
                    onCheckedChange={() => {
                      // Satisfy the "checked with icon" affordance used elsewhere.
                      toggleCollection(col.id);
                    }}
                  />
                  <Label htmlFor={`col-${col.id}`} className="font-normal">
                    {col.name_en}
                  </Label>
                </li>
              );
            })}
          </ul>
        )}
      </FormSection>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onDiscard={() => {
          setSelectedCategories(baseCategories);
          setPrimary(basePrimary);
          setSelectedCollections(baseCollections);
        }}
      />
    </div>
  );
}
