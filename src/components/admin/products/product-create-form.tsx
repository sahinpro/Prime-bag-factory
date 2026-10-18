"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { createProduct } from "@/app/(admin)/admin/products/actions";
import { BilingualField } from "@/components/admin/forms/bilingual-field";
import { FormSection } from "@/components/admin/forms/form-section";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductCreateInput } from "@/lib/validators/product";

/**
 * ProductCreateForm: the minimal `New product` step. It creates a draft row so
 * the tabbed editor has an id to attach price tiers, variants, images and builder
 * parts to, then redirects into that editor. Kept deliberately small — everything
 * else is configured on the editor tabs.
 */
export function ProductCreateForm() {
  const router = useRouter();
  const [titleEn, setTitleEn] = React.useState("");
  const [titleBn, setTitleBn] = React.useState("");
  const [type, setType] =
    React.useState<ProductCreateInput["type"]>("quote_only");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dirty = titleEn.trim() !== "";

  async function submit() {
    setSaving(true);
    setError(null);
    const result = await createProduct({
      title_en: titleEn,
      title_bn: titleBn || undefined,
      type,
      status: "draft",
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/admin/products/${result.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New product"
        description="Create a draft, then add pricing, variants and images on the editor."
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/products">
              <ArrowLeft
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4"
              />
              Back to products
            </Link>
          </Button>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-2"
      >
        <h2 className="sr-only">Product details</h2>
        <FormSection
          title="Basics"
          description="Give it a name and how it sells. You can add pricing, variants and images next."
        >
          <BilingualField
            id="new-product-title"
            label="Title"
            required
            valueEn={titleEn}
            valueBn={titleBn}
            onChangeEn={setTitleEn}
            onChangeBn={setTitleBn}
            placeholder="Non-woven shopping bag"
          />
          <div className="space-y-1.5">
            <label htmlFor="new-product-type" className="text-sm font-medium">
              Selling type
            </label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as ProductCreateInput["type"])}
            >
              <SelectTrigger id="new-product-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="quote_only">Quote only (bulk)</SelectItem>
                <SelectItem value="buy_now">Buy now (retail)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Quote-only products show an enquiry button; buy-now products add
              to cart at checkout.
            </p>
          </div>
        </FormSection>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? "Creating…" : "Create and continue"}
          </Button>
        </div>
      </form>
    </div>
  );
}
