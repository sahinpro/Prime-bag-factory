"use client";

import { BadgeCheck, Check, CircleDashed, Trash } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import {
  deleteProduct,
  setProductStatus,
} from "@/app/(admin)/admin/products/actions";
import { StatusBadge } from "@/components/admin/data/status-badge";
import { ConfirmDialog } from "@/components/admin/forms/confirm-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdminProduct, listRelationOptions } from "@/server/products";
import type { AdminSwatchGroup } from "@/server/swatches";
import { CustomizationTab } from "./tabs/customization-tab";
import { GeneralTab } from "./tabs/general-tab";
import { ImagesTab } from "./tabs/images-tab";
import { PricingTab } from "./tabs/pricing-tab";
import { RelationsTab } from "./tabs/relations-tab";
import { SeoTab } from "./tabs/seo-tab";
import { VariantsTab, type VariantSwatchOption } from "./tabs/variants-tab";

type RelationOptions = Awaited<ReturnType<typeof listRelationOptions>>;

const TABS = [
  { key: "general", label: "General" },
  { key: "pricing", label: "Pricing" },
  { key: "variants", label: "Variants" },
  { key: "customization", label: "Customization" },
  { key: "images", label: "Images" },
  { key: "relations", label: "Categories" },
  { key: "seo", label: "SEO" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function isTabKey(value: string | undefined): value is TabKey {
  return !!value && TABS.some((t) => t.key === value);
}

function ChecklistRow({
  done,
  label,
}: Readonly<{ done: boolean; label: string }>) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {done ? (
        <Check
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 text-success"
        />
      ) : (
        <CircleDashed
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-4 text-muted-foreground"
        />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>
        {label}
        <span className="sr-only">{done ? " — done" : " — not set"}</span>
      </span>
    </li>
  );
}

/**
 * ProductEditor (plan 9c.8): a header (status badge + Publish/Archive + delete)
 * over a tab list, one tab panel at a time, with a desktop right-rail publish
 * checklist. Each tab owns a slice of the product and saves it through its own
 * server action (see the tab files); the active tab is reflected in `?tab` so the
 * view survives reload and share. Public Preview is intentionally omitted until
 * the Phase 3 product route exists.
 */
export function ProductEditor({
  product,
  relationOptions,
  swatchGroups,
  initialTab,
}: Readonly<{
  product: AdminProduct;
  relationOptions: RelationOptions;
  swatchGroups: AdminSwatchGroup[];
  initialTab?: string;
}>) {
  const router = useRouter();
  const pathname = usePathname();

  const activeTab: TabKey = isTabKey(initialTab) ? initialTab : "general";

  function selectTab(key: TabKey) {
    router.replace(`${pathname}?tab=${key}`, { scroll: false });
  }

  const swatchOptions = React.useMemo<VariantSwatchOption[]>(() => {
    const out: VariantSwatchOption[] = [];
    for (const g of swatchGroups) {
      for (const s of g.swatches) {
        if (!s.is_active) continue;
        out.push({
          id: s.id,
          label: `${g.name_en} · ${s.name_en}`,
          colorName: s.name_en,
          colorHex: s.color_hex ?? "#cccccc",
          texturePath: s.texture_image_path,
        });
      }
    }
    return out;
  }, [swatchGroups]);

  const checklist = {
    title: Boolean(product.title_en && product.title_bn),
    tiers: product.price_tiers.length > 0,
    variants: product.variants.length > 0,
    images: product.images.length > 0,
    seo: Boolean(product.seo_title_en || product.seo_description_en),
    bangla: Boolean(product.title_bn && product.short_description_bn),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/products"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Products
            </Link>
            <span aria-hidden="true" className="text-muted-foreground">
              /
            </span>
            <span className="truncate text-sm text-muted-foreground">
              {product.slug}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 truncate text-2xl leading-8 font-semibold tracking-tight">
              {product.title_en}
            </h1>
            <StatusBadge domain="product" value={product.status} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {product.status === "published" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void setProductStatus(product.id, "draft").then(() =>
                  router.refresh(),
                )
              }
            >
              Unpublish
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() =>
                void setProductStatus(product.id, "published").then(() =>
                  router.refresh(),
                )
              }
            >
              <BadgeCheck
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4"
              />
              Publish
            </Button>
          )}
          {product.status !== "archived" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void setProductStatus(product.id, "archived").then(() =>
                  router.refresh(),
                )
              }
            >
              Archive
            </Button>
          ) : null}
          <ConfirmDialog
            destructive
            title="Delete this product?"
            description="Its variants, images, price tiers and builder parts are removed. This cannot be undone."
            confirmLabel="Delete product"
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
              const result = await deleteProduct(product.id);
              if (result.ok) router.push("/admin/products");
            }}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-5">
          <div
            role="tablist"
            aria-label="Product sections"
            className="flex gap-1 overflow-x-auto border-b border-border"
          >
            {TABS.map((tab) => {
              const active = tab.key === activeTab;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  id={`tab-${tab.key}`}
                  aria-selected={active}
                  aria-controls={active ? "product-panel" : undefined}
                  onClick={() => selectTab(tab.key)}
                  className={cn(
                    "-mb-px shrink-0 cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <section
            role="tabpanel"
            id="product-panel"
            aria-labelledby={`tab-${activeTab}`}
            className="min-w-0"
          >
            {activeTab === "general" ? <GeneralTab product={product} /> : null}
            {activeTab === "pricing" ? <PricingTab product={product} /> : null}
            {activeTab === "variants" ? (
              <VariantsTab product={product} swatchOptions={swatchOptions} />
            ) : null}
            {activeTab === "customization" ? (
              <CustomizationTab product={product} swatchGroups={swatchGroups} />
            ) : null}
            {activeTab === "images" ? <ImagesTab product={product} /> : null}
            {activeTab === "relations" ? (
              <RelationsTab product={product} options={relationOptions} />
            ) : null}
            {activeTab === "seo" ? <SeoTab product={product} /> : null}
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-card border border-border bg-surface-2/40 p-4">
            <h2 className="text-sm font-medium">Publish checklist</h2>
            <ul className="mt-3 space-y-2">
              <ChecklistRow
                done={checklist.title}
                label="Title in both languages"
              />
              <ChecklistRow
                done={checklist.tiers}
                label="At least one price range"
              />
              <ChecklistRow
                done={checklist.variants}
                label="At least one variant"
              />
              <ChecklistRow
                done={checklist.images}
                label="At least one image"
              />
              <ChecklistRow done={checklist.seo} label="SEO set" />
              <ChecklistRow done={checklist.bangla} label="Bangla complete" />
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
