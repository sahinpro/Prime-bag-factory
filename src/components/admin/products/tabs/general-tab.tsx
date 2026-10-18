"use client";

import * as React from "react";

import { saveProductGeneral } from "@/app/(admin)/admin/products/actions";
import { BilingualField } from "@/components/admin/forms/bilingual-field";
import { FormSection } from "@/components/admin/forms/form-section";
import { StickySaveBar } from "@/components/admin/forms/sticky-save-bar";
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
import type { AdminProduct } from "@/server/products";
import { FlashLine, useActionSave } from "../use-action-save";

type GeneralForm = {
  title_en: string;
  title_bn: string;
  short_description_en: string;
  short_description_bn: string;
  description_en: string;
  description_bn: string;
  material: string;
  type: AdminProduct["type"];
  stock_mode: AdminProduct["stock_mode"];
  moq: number;
  lead_time_days: string;
  customization_enabled: boolean;
  is_featured: boolean;
  slug: string;
};

function initial(product: AdminProduct): GeneralForm {
  return {
    title_en: product.title_en,
    title_bn: product.title_bn ?? "",
    short_description_en: product.short_description_en ?? "",
    short_description_bn: product.short_description_bn ?? "",
    description_en: product.description_en ?? "",
    description_bn: product.description_bn ?? "",
    material: product.material ?? "",
    type: product.type,
    stock_mode: product.stock_mode,
    moq: product.moq,
    lead_time_days:
      product.lead_time_days == null ? "" : String(product.lead_time_days),
    customization_enabled: product.customization_enabled,
    is_featured: product.is_featured,
    slug: product.slug,
  };
}

/** General tab (plan 9c.8): identity, bilingual copy, commerce settings and slug. */
export function GeneralTab({ product }: Readonly<{ product: AdminProduct }>) {
  const baseline = React.useMemo(() => initial(product), [product]);
  const [form, setForm] = React.useState<GeneralForm>(baseline);
  const [slugEdited, setSlugEdited] = React.useState(true);
  const { saving, flash, run } = useActionSave();

  // Reset the draft when the server row changes (after a save + refresh) using
  // the sanctioned adjust-during-render pattern rather than a setState effect.
  const [prevBaseline, setPrevBaseline] = React.useState(baseline);
  if (prevBaseline !== baseline) {
    setPrevBaseline(baseline);
    setForm(baseline);
    setSlugEdited(true);
  }

  const dirty = React.useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  function set<K extends keyof GeneralForm>(key: K, value: GeneralForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    await run(
      () =>
        saveProductGeneral(product.id, {
          title_en: form.title_en,
          title_bn: form.title_bn || undefined,
          short_description_en: form.short_description_en || undefined,
          short_description_bn: form.short_description_bn || undefined,
          description_en: form.description_en || undefined,
          description_bn: form.description_bn || undefined,
          material: form.material || undefined,
          type: form.type,
          stock_mode: form.stock_mode,
          moq: form.moq,
          lead_time_days:
            form.lead_time_days === ""
              ? undefined
              : Number(form.lead_time_days),
          customization_enabled: form.customization_enabled,
          is_featured: form.is_featured,
          status: product.status,
          slug: form.slug,
        }),
      "Product details saved.",
    );
  }

  return (
    <div className="space-y-2">
      <FlashLine flash={flash} />

      <FormSection title="Title" description="The name shown across the site.">
        <BilingualField
          id="general-title"
          label="Title"
          required
          valueEn={form.title_en}
          valueBn={form.title_bn}
          onChangeEn={(v) =>
            setForm((prev) => ({
              ...prev,
              title_en: v,
              slug: slugEdited ? prev.slug : slugify(v),
            }))
          }
          onChangeBn={(v) => set("title_bn", v)}
        />
      </FormSection>

      <FormSection
        title="Descriptions"
        description="Short shows on cards, full on the product page."
      >
        <BilingualField
          id="general-short"
          label="Short description"
          multiline
          valueEn={form.short_description_en}
          valueBn={form.short_description_bn}
          onChangeEn={(v) => set("short_description_en", v)}
          onChangeBn={(v) => set("short_description_bn", v)}
        />
        <BilingualField
          id="general-desc"
          label="Full description"
          multiline
          valueEn={form.description_en}
          valueBn={form.description_bn}
          onChangeEn={(v) => set("description_en", v)}
          onChangeBn={(v) => set("description_bn", v)}
        />
      </FormSection>

      <FormSection title="Selling" description="How the product is bought.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="general-type">Selling type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => set("type", v as GeneralForm["type"])}
            >
              <SelectTrigger id="general-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quote_only">Quote only (bulk)</SelectItem>
                <SelectItem value="buy_now">Buy now (retail)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="general-stock">Stock mode</Label>
            <Select
              value={form.stock_mode}
              onValueChange={(v) =>
                set("stock_mode", v as GeneralForm["stock_mode"])
              }
            >
              <SelectTrigger id="general-stock">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tracked">Tracked inventory</SelectItem>
                <SelectItem value="made_to_order">Made to order</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="general-moq">Minimum order (pcs)</Label>
            <Input
              id="general-moq"
              type="number"
              min={1}
              value={String(form.moq)}
              onChange={(e) => set("moq", Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="general-lead">Lead time (days)</Label>
            <Input
              id="general-lead"
              type="number"
              min={0}
              value={form.lead_time_days}
              onChange={(e) => set("lead_time_days", e.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="general-material">Material</Label>
            <Input
              id="general-material"
              value={form.material}
              onChange={(e) => set("material", e.target.value)}
              placeholder="80 GSM non-woven"
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-control border border-sidebar-border bg-surface-2 px-3 py-2">
          <Label htmlFor="general-custom" className="text-sm">
            Enable the Custom Bag Builder
          </Label>
          <Switch
            id="general-custom"
            checked={form.customization_enabled}
            onCheckedChange={(v) => set("customization_enabled", v)}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-control border border-sidebar-border bg-surface-2 px-3 py-2">
          <Label htmlFor="general-featured" className="text-sm">
            Feature on the homepage
          </Label>
          <Switch
            id="general-featured"
            checked={form.is_featured}
            onCheckedChange={(v) => set("is_featured", v)}
          />
        </div>
      </FormSection>

      <FormSection title="URL" description="Used in the public product link.">
        <div className="space-y-1.5">
          <Label htmlFor="general-slug">Slug</Label>
          <Input
            id="general-slug"
            value={form.slug}
            onChange={(e) => {
              setSlugEdited(true);
              set("slug", e.target.value);
            }}
          />
          <p className="text-xs text-muted-foreground">
            Lowercase, hyphenated English. A unique suffix is added
            automatically if it collides.
          </p>
        </div>
      </FormSection>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onDiscard={() => {
          setForm(baseline);
          setSlugEdited(true);
        }}
      />
    </div>
  );
}
