"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { saveCustomParts } from "@/app/(admin)/admin/products/actions";
import { SwatchChip } from "@/components/admin/catalog/swatch-chip";
import { BilingualField } from "@/components/admin/forms/bilingual-field";
import { FormSection } from "@/components/admin/forms/form-section";
import { StickySaveBar } from "@/components/admin/forms/sticky-save-bar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/lib/database.types";
import type { AdminProduct } from "@/server/products";
import type { AdminSwatchGroup } from "@/server/swatches";
import { FlashLine, useActionSave } from "../use-action-save";

type InputType = Database["public"]["Enums"]["product_custom_input_type"];

const INPUT_TYPES: { value: InputType; label: string }[] = [
  { value: "swatch", label: "Color / material swatch" },
  { value: "select", label: "Dropdown option" },
  { value: "dimensions", label: "Size (dimensions)" },
  { value: "text", label: "Text note" },
  { value: "file", label: "File upload (artwork)" },
];

type PartDraft = {
  key: string;
  part_key: string;
  label_en: string;
  label_bn: string;
  input_type: InputType;
  swatch_group_id: string;
  is_required: boolean;
  price_delta: string;
  help_text_en: string;
  help_text_bn: string;
  optionsText: string;
  min_width: string;
  max_width: string;
  min_height: string;
  max_height: string;
  allowedSwatchIds: string[];
  defaultSwatchId: string;
};

function numToStr(v: unknown): string {
  if (v == null) return "";
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? String(n) : "";
}

function toDrafts(product: AdminProduct): PartDraft[] {
  return product.custom_parts.map((p, i) => {
    const config = (p.config ?? {}) as Record<string, unknown>;
    return {
      key: p.id || `p-${i}`,
      part_key: p.key,
      label_en: p.label_en,
      label_bn: p.label_bn ?? "",
      input_type: p.input_type,
      swatch_group_id: p.swatch_group_id ?? "",
      is_required: p.is_required,
      price_delta: String(p.price_delta),
      help_text_en: p.help_text_en ?? "",
      help_text_bn: p.help_text_bn ?? "",
      optionsText: Array.isArray(config.options)
        ? (config.options as unknown[]).join("\n")
        : "",
      min_width: numToStr(config.min_width),
      max_width: numToStr(config.max_width),
      min_height: numToStr(config.min_height),
      max_height: numToStr(config.max_height),
      allowedSwatchIds: p.allowed_swatches.map((s) => s.swatch_id),
      defaultSwatchId:
        p.allowed_swatches.find((s) => s.is_default)?.swatch_id ?? "",
    };
  });
}

function blank(key: string): PartDraft {
  return {
    key,
    part_key: "",
    label_en: "",
    label_bn: "",
    input_type: "swatch",
    swatch_group_id: "",
    is_required: false,
    price_delta: "0",
    help_text_en: "",
    help_text_bn: "",
    optionsText: "",
    min_width: "",
    max_width: "",
    min_height: "",
    max_height: "",
    allowedSwatchIds: [],
    defaultSwatchId: "",
  };
}

function buildConfig(draft: PartDraft): Record<string, unknown> {
  if (draft.input_type === "select") {
    const options = draft.optionsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    return { options };
  }
  if (draft.input_type === "dimensions") {
    const cfg: Record<string, unknown> = {};
    if (draft.min_width !== "") cfg.min_width = Number(draft.min_width);
    if (draft.max_width !== "") cfg.max_width = Number(draft.max_width);
    if (draft.min_height !== "") cfg.min_height = Number(draft.min_height);
    if (draft.max_height !== "") cfg.max_height = Number(draft.max_height);
    return cfg;
  }
  return {};
}

/**
 * Customization tab (plan 9c.8 / Phase 2 "Customization tab: enable builder,
 * define parts, allowed swatches, size limits, extra prices"). The builder switch
 * itself lives on General (`customization_enabled`); this tab defines the parts
 * the customer picks. Each part carries a bilingual label, an input type, an
 * extra price and — for swatch parts — the allowed swatches (from one Swatch
 * Library group) with one default. Saving replaces the whole set through
 * `saveCustomParts` (part swatches are rewritten with their parent part).
 */
export function CustomizationTab({
  product,
  swatchGroups,
}: Readonly<{ product: AdminProduct; swatchGroups: AdminSwatchGroup[] }>) {
  const baseline = React.useMemo(() => toDrafts(product), [product]);
  const [rows, setRows] = React.useState<PartDraft[]>(baseline);
  const { saving, flash, run } = useActionSave();

  const [prevBaseline, setPrevBaseline] = React.useState(baseline);
  if (prevBaseline !== baseline) {
    setPrevBaseline(baseline);
    setRows(baseline);
  }

  const dirty = JSON.stringify(rows) !== JSON.stringify(baseline);

  function update(key: string, patch: Partial<PartDraft>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
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

  function toggleSwatch(key: string, swatchId: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const has = r.allowedSwatchIds.includes(swatchId);
        const ids = has
          ? r.allowedSwatchIds.filter((s) => s !== swatchId)
          : [...r.allowedSwatchIds, swatchId];
        return {
          ...r,
          allowedSwatchIds: ids,
          defaultSwatchId:
            has && r.defaultSwatchId === swatchId ? "" : r.defaultSwatchId,
        };
      }),
    );
  }

  async function save() {
    const parts = rows
      .filter((r) => r.label_en.trim() !== "" && r.part_key.trim() !== "")
      .map((r) => {
        const allowed_swatches =
          r.input_type === "swatch"
            ? r.allowedSwatchIds.map((swatch_id) => ({
                swatch_id,
                is_default: swatch_id === r.defaultSwatchId,
              }))
            : [];
        return {
          key: r.part_key,
          label_en: r.label_en,
          label_bn: r.label_bn || undefined,
          input_type: r.input_type,
          swatch_group_id:
            r.input_type === "swatch"
              ? r.swatch_group_id || undefined
              : undefined,
          is_required: r.is_required,
          price_delta: Number(r.price_delta) || 0,
          config: buildConfig(r),
          help_text_en: r.help_text_en || undefined,
          help_text_bn: r.help_text_bn || undefined,
          sort_order: 0,
          allowed_swatches,
        };
      });
    await run(
      () => saveCustomParts(product.id, parts),
      "Builder options saved.",
    );
  }

  return (
    <div className="space-y-2">
      <FlashLine flash={flash} />

      {!product.customization_enabled ? (
        <div className="rounded-control border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
          The builder is currently off for this product. Turn it on under
          General to show these options to customers.
        </div>
      ) : null}

      <FormSection
        title="Builder parts"
        description="Each part is a step in the Custom Bag Builder — a color, size, handle, and so on."
      >
        {rows.length === 0 ? (
          <p className="rounded-control border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No builder parts yet. Add the pieces a customer can customize.
          </p>
        ) : (
          <ul className="space-y-4">
            {rows.map((row, index) => {
              const group = swatchGroups.find(
                (g) => g.id === row.swatch_group_id,
              );
              return (
                <li
                  key={row.key}
                  className="space-y-3 rounded-card border border-border bg-surface-2/40 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">
                      {row.label_en || `Part ${index + 1}`}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        aria-label={`Move part ${index + 1} up`}
                      >
                        <ArrowUp aria-hidden="true" strokeWidth={1.75} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === rows.length - 1}
                        onClick={() => move(index, 1)}
                        aria-label={`Move part ${index + 1} down`}
                      >
                        <ArrowDown aria-hidden="true" strokeWidth={1.75} />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => remove(row.key)}
                        aria-label={`Remove part ${index + 1}`}
                      >
                        <Trash2 aria-hidden="true" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1">
                      <Label
                        htmlFor={`key-${row.key}`}
                        className="text-xs text-muted-foreground"
                      >
                        Key
                      </Label>
                      <Input
                        id={`key-${row.key}`}
                        value={row.part_key}
                        onChange={(e) =>
                          update(row.key, { part_key: e.target.value })
                        }
                        placeholder="body_fabric"
                      />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <Label
                        htmlFor={`type-${row.key}`}
                        className="text-xs text-muted-foreground"
                      >
                        Input type
                      </Label>
                      <Select
                        value={row.input_type}
                        onValueChange={(v) =>
                          update(row.key, { input_type: v as InputType })
                        }
                      >
                        <SelectTrigger id={`type-${row.key}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INPUT_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <BilingualField
                    id={`label-${row.key}`}
                    label="Label"
                    required
                    valueEn={row.label_en}
                    valueBn={row.label_bn}
                    onChangeEn={(v) => update(row.key, { label_en: v })}
                    onChangeBn={(v) => update(row.key, { label_bn: v })}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="min-w-0 space-y-1">
                      <Label
                        htmlFor={`delta-${row.key}`}
                        className="text-xs text-muted-foreground"
                      >
                        Extra price (BDT)
                      </Label>
                      <Input
                        id={`delta-${row.key}`}
                        type="number"
                        step="0.01"
                        value={row.price_delta}
                        onChange={(e) =>
                          update(row.key, { price_delta: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 self-end rounded-control border border-sidebar-border bg-surface-2 px-3 py-2">
                      <Label htmlFor={`req-${row.key}`} className="text-sm">
                        Required
                      </Label>
                      <Switch
                        id={`req-${row.key}`}
                        checked={row.is_required}
                        onCheckedChange={(v) =>
                          update(row.key, { is_required: v })
                        }
                      />
                    </div>
                  </div>

                  <BilingualField
                    id={`help-${row.key}`}
                    label="Help text"
                    valueEn={row.help_text_en}
                    valueBn={row.help_text_bn}
                    onChangeEn={(v) => update(row.key, { help_text_en: v })}
                    onChangeBn={(v) => update(row.key, { help_text_bn: v })}
                  />

                  {row.input_type === "swatch" ? (
                    <div className="space-y-3 rounded-control border border-border bg-surface-2/60 p-3">
                      <div className="min-w-0 space-y-1">
                        <Label
                          htmlFor={`group-${row.key}`}
                          className="text-xs text-muted-foreground"
                        >
                          Swatch group
                        </Label>
                        <Select
                          value={row.swatch_group_id || "__none__"}
                          onValueChange={(v) => {
                            const id = v === "__none__" ? "" : v;
                            update(row.key, {
                              swatch_group_id: id,
                              allowedSwatchIds: [],
                              defaultSwatchId: "",
                            });
                          }}
                        >
                          <SelectTrigger id={`group-${row.key}`}>
                            <SelectValue placeholder="Choose a group" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">
                              Choose a group
                            </SelectItem>
                            {swatchGroups.map((g) => (
                              <SelectItem key={g.id} value={g.id}>
                                {g.name_en}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {group ? (
                        group.swatches.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            This group has no swatches yet.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">
                              Allowed swatches (tick to allow, pick a default)
                            </p>
                            <ul className="flex flex-wrap gap-2">
                              {group.swatches.map((s) => {
                                const allowed = row.allowedSwatchIds.includes(
                                  s.id,
                                );
                                return (
                                  <li
                                    key={s.id}
                                    className="flex items-center gap-2 rounded-full border border-border py-1 pr-3 pl-1.5"
                                  >
                                    <Checkbox
                                      id={`sw-${row.key}-${s.id}`}
                                      checked={allowed}
                                      onCheckedChange={() =>
                                        toggleSwatch(row.key, s.id)
                                      }
                                    />
                                    <Label
                                      htmlFor={`sw-${row.key}-${s.id}`}
                                      className="flex items-center gap-1.5 font-normal"
                                    >
                                      <SwatchChip
                                        colorHex={s.color_hex ?? "#cccccc"}
                                        textureUrl={s.texture_image_path}
                                        size={20}
                                      />
                                      {s.name_en}
                                    </Label>
                                    {allowed ? (
                                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <input
                                          type="radio"
                                          name={`default-${row.key}`}
                                          className="size-3.5 accent-current"
                                          checked={row.defaultSwatchId === s.id}
                                          onChange={() =>
                                            update(row.key, {
                                              defaultSwatchId: s.id,
                                            })
                                          }
                                          aria-label={`Default ${s.name_en}`}
                                        />
                                        default
                                      </label>
                                    ) : null}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        )
                      ) : null}
                    </div>
                  ) : null}

                  {row.input_type === "select" ? (
                    <div className="space-y-1">
                      <Label
                        htmlFor={`opts-${row.key}`}
                        className="text-xs text-muted-foreground"
                      >
                        Options (one per line)
                      </Label>
                      <Textarea
                        id={`opts-${row.key}`}
                        value={row.optionsText}
                        onChange={(e) =>
                          update(row.key, { optionsText: e.target.value })
                        }
                        className="min-h-20"
                        placeholder={"Silk screen\nHeat transfer\nEmbroidery"}
                      />
                    </div>
                  ) : null}

                  {row.input_type === "dimensions" ? (
                    <div className="space-y-2 rounded-control border border-border bg-surface-2/60 p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Size limits (inches)
                      </p>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <Field
                          id={`wmin-${row.key}`}
                          label="Min width"
                          value={row.min_width}
                          onChange={(v) => update(row.key, { min_width: v })}
                        />
                        <Field
                          id={`wmax-${row.key}`}
                          label="Max width"
                          value={row.max_width}
                          onChange={(v) => update(row.key, { max_width: v })}
                        />
                        <Field
                          id={`hmin-${row.key}`}
                          label="Min height"
                          value={row.min_height}
                          onChange={(v) => update(row.key, { min_height: v })}
                        />
                        <Field
                          id={`hmax-${row.key}`}
                          label="Max height"
                          value={row.max_height}
                          onChange={(v) => update(row.key, { max_height: v })}
                        />
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
          Add part
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

function Field({
  id,
  label,
  value,
  onChange,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}>) {
  return (
    <div className="min-w-0 space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="—"
      />
    </div>
  );
}
