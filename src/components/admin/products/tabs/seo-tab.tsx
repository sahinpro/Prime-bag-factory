"use client";

import * as React from "react";

import { saveProductSeo } from "@/app/(admin)/admin/products/actions";
import { BilingualField } from "@/components/admin/forms/bilingual-field";
import { FormSection } from "@/components/admin/forms/form-section";
import { StickySaveBar } from "@/components/admin/forms/sticky-save-bar";
import type { AdminProduct } from "@/server/products";
import { FlashLine, useActionSave } from "../use-action-save";

type SeoForm = {
  seo_title_en: string;
  seo_title_bn: string;
  seo_description_en: string;
  seo_description_bn: string;
};

function initial(product: AdminProduct): SeoForm {
  return {
    seo_title_en: product.seo_title_en ?? "",
    seo_title_bn: product.seo_title_bn ?? "",
    seo_description_en: product.seo_description_en ?? "",
    seo_description_bn: product.seo_description_bn ?? "",
  };
}

const LIMITS = { title: 70, description: 160 };

/** SEO tab: search-engine title and meta description, in both languages. */
export function SeoTab({ product }: Readonly<{ product: AdminProduct }>) {
  const baseline = React.useMemo(() => initial(product), [product]);
  const [form, setForm] = React.useState<SeoForm>(baseline);
  const { saving, flash, run } = useActionSave();

  const [prevBaseline, setPrevBaseline] = React.useState(baseline);
  if (prevBaseline !== baseline) {
    setPrevBaseline(baseline);
    setForm(baseline);
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  async function save() {
    await run(
      () =>
        saveProductSeo(product.id, {
          seo_title_en: form.seo_title_en || undefined,
          seo_title_bn: form.seo_title_bn || undefined,
          seo_description_en: form.seo_description_en || undefined,
          seo_description_bn: form.seo_description_bn || undefined,
        }),
      "SEO saved.",
    );
  }

  return (
    <div className="space-y-2">
      <FlashLine flash={flash} />

      <FormSection
        title="Search title"
        description="Shown as the blue link text in Google. Aim for under 70 characters."
      >
        <BilingualField
          id="seo-title"
          label="SEO title"
          valueEn={form.seo_title_en}
          valueBn={form.seo_title_bn}
          onChangeEn={(v) => setForm((p) => ({ ...p, seo_title_en: v }))}
          onChangeBn={(v) => setForm((p) => ({ ...p, seo_title_bn: v }))}
          hint={`${form.seo_title_en.length}/${LIMITS.title} characters`}
        />
      </FormSection>

      <FormSection
        title="Meta description"
        description="A short summary shown under the link. Aim for under 160 characters."
      >
        <BilingualField
          id="seo-description"
          label="Meta description"
          multiline
          valueEn={form.seo_description_en}
          valueBn={form.seo_description_bn}
          onChangeEn={(v) => setForm((p) => ({ ...p, seo_description_en: v }))}
          onChangeBn={(v) => setForm((p) => ({ ...p, seo_description_bn: v }))}
          hint={`${form.seo_description_en.length}/${LIMITS.description} characters`}
        />
      </FormSection>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onDiscard={() => setForm(baseline)}
      />
    </div>
  );
}
