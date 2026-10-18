"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { saveVariants } from "@/app/(admin)/admin/products/actions";
import { SwatchChip } from "@/components/admin/catalog/swatch-chip";
import { FormSection } from "@/components/admin/forms/form-section";
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
import type { AdminProduct } from "@/server/products";
import { FlashLine, useActionSave } from "../use-action-save";

/** A swatch flattened for the variant picker (display label + color autofill). */
export type VariantSwatchOption = {
  id: string;
  label: string;
  colorName: string;
  colorHex: string;
  texturePath: string | null;
};

type VariantDraft = {
  key: string;
  sku: string;
  swatch_id: string;
  color_name: string;
  color_hex: string;
  size: string;
  price_delta: string;
  stock_qty: string;
  reserved_qty: string;
  low_stock_threshold: string;
  is_active: boolean;
};

const NONE = "__none__";

function toDrafts(product: AdminProduct): VariantDraft[] {
  return product.variants.map((v, i) => ({
    key: v.id || `v-${i}`,
    sku: v.sku,
    swatch_id: v.swatch_id ?? "",
    color_name: v.color_name ?? "",
    color_hex: v.color_hex ?? "",
    size: v.size ?? "",
    price_delta: String(v.price_delta),
    stock_qty: String(v.stock_qty),
    reserved_qty: String(v.reserved_qty),
    low_stock_threshold: String(v.low_stock_threshold),
    is_active: v.is_active,
  }));
}

function blank(key: string): VariantDraft {
  return {
    key,
    sku: "",
    swatch_id: "",
    color_name: "",
    color_hex: "",
    size: "",
    price_delta: "0",
    stock_qty: "0",
    reserved_qty: "0",
    low_stock_threshold: "0",
    is_active: true,
  };
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  min,
  placeholder,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  placeholder?: string;
}>) {
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        min={min}
        inputMode={type === "number" ? "numeric" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/**
 * Variants tab (plan 9c.8 "variants (swatch link, price delta, stock)"). Each row
 * is a color/size variant linked to a Swatch Library swatch; choosing a swatch
 * autofills its name and hex. Numbers are kept as strings while editing so a
 * field can be cleared; they are coerced to numbers (defaults to 0) on save.
 * Saving replaces the whole set through `saveVariants`.
 */
export function VariantsTab({
  product,
  swatchOptions,
}: Readonly<{ product: AdminProduct; swatchOptions: VariantSwatchOption[] }>) {
  const baseline = React.useMemo(() => toDrafts(product), [product]);
  const [rows, setRows] = React.useState<VariantDraft[]>(baseline);
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

  function update(key: string, patch: Partial<VariantDraft>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  function pickSwatch(key: string, swatchId: string) {
    const opt = swatchOptions.find((s) => s.id === swatchId);
    update(key, {
      swatch_id: swatchId,
      color_name: opt ? opt.colorName : "",
      color_hex: opt ? opt.colorHex : "",
    });
  }

  function add() {
    setRows((prev) => [...prev, blank(`new-${Date.now()}-${prev.length}`)]);
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

  const tracked = product.stock_mode === "tracked";

  async function save() {
    await run(
      () =>
        saveVariants(
          product.id,
          rows.map((r) => ({
            sku: r.sku,
            swatch_id: r.swatch_id || undefined,
            color_name: r.color_name || undefined,
            color_hex: r.color_hex || undefined,
            size: r.size || undefined,
            price_delta: Number(r.price_delta) || 0,
            stock_qty: Number(r.stock_qty) || 0,
            reserved_qty: Number(r.reserved_qty) || 0,
            low_stock_threshold: Number(r.low_stock_threshold) || 0,
            is_active: r.is_active,
          })),
        ),
      "Variants saved.",
    );
  }

  return (
    <div className="space-y-2">
      <FlashLine flash={flash} />

      <FormSection
        title="Variants"
        description="Colors and sizes customers can pick. Link each to a swatch for a chip preview and an optional price delta."
      >
        {rows.length === 0 ? (
          <p className="rounded-control border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No variants yet. Add one for each color or size you sell.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row, index) => {
              const swatch = swatchOptions.find((s) => s.id === row.swatch_id);
              return (
                <li
                  key={row.key}
                  className="space-y-3 rounded-card border border-border bg-surface-2/40 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <SwatchChip
                        colorHex={row.color_hex || "#cccccc"}
                        textureUrl={swatch?.texturePath ?? null}
                        size={28}
                      />
                      <span className="text-sm font-medium">
                        {row.color_name || row.sku || `Variant ${index + 1}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={`Move variant ${index + 1} up`}
                      >
                        <ArrowUp aria-hidden="true" strokeWidth={1.75} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === rows.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={`Move variant ${index + 1} down`}
                      >
                        <ArrowDown aria-hidden="true" strokeWidth={1.75} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => remove(row.key)}
                        aria-label={`Remove variant ${index + 1}`}
                      >
                        <Trash2 aria-hidden="true" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="min-w-0 space-y-1">
                      <Label
                        htmlFor={`sw-${row.key}`}
                        className="text-xs text-muted-foreground"
                      >
                        Swatch
                      </Label>
                      <Select
                        value={row.swatch_id || NONE}
                        onValueChange={(v) =>
                          pickSwatch(row.key, v === NONE ? "" : v)
                        }
                      >
                        <SelectTrigger id={`sw-${row.key}`}>
                          <SelectValue placeholder="No swatch" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>No swatch</SelectItem>
                          {swatchOptions.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Field
                      id={`sku-${row.key}`}
                      label="SKU"
                      value={row.sku}
                      onChange={(v) => update(row.key, { sku: v })}
                      placeholder="PBF-BAG-BLU"
                    />
                    <Field
                      id={`size-${row.key}`}
                      label="Size"
                      value={row.size}
                      onChange={(v) => update(row.key, { size: v })}
                      placeholder="12 x 16 in"
                    />
                    <Field
                      id={`name-${row.key}`}
                      label="Color name"
                      value={row.color_name}
                      onChange={(v) => update(row.key, { color_name: v })}
                    />
                    <Field
                      id={`hex-${row.key}`}
                      label="Hex (#rrggbb)"
                      value={row.color_hex}
                      onChange={(v) => update(row.key, { color_hex: v })}
                    />
                    <Field
                      id={`delta-${row.key}`}
                      label="Price delta (BDT)"
                      value={row.price_delta}
                      type="number"
                      onChange={(v) => update(row.key, { price_delta: v })}
                    />
                  </div>

                  {tracked ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field
                        id={`stock-${row.key}`}
                        label="Stock qty"
                        value={row.stock_qty}
                        type="number"
                        min={0}
                        onChange={(v) => update(row.key, { stock_qty: v })}
                      />
                      <Field
                        id={`resv-${row.key}`}
                        label="Reserved"
                        value={row.reserved_qty}
                        type="number"
                        min={0}
                        onChange={(v) => update(row.key, { reserved_qty: v })}
                      />
                      <Field
                        id={`low-${row.key}`}
                        label="Low-stock alert"
                        value={row.low_stock_threshold}
                        type="number"
                        min={0}
                        onChange={(v) =>
                          update(row.key, { low_stock_threshold: v })
                        }
                      />
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 rounded-control border border-sidebar-border bg-surface-2 px-3 py-2">
                    <Label htmlFor={`active-${row.key}`} className="text-sm">
                      Active
                    </Label>
                    <Switch
                      id={`active-${row.key}`}
                      checked={row.is_active}
                      onCheckedChange={(v) => update(row.key, { is_active: v })}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
          Add variant
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
