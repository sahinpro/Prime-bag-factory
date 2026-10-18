"use client";

import { cn } from "cn";
import { Check, ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Media } from "@/components/site/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { addToCart } from "@/lib/cart";
import { formatMoney, formatNumber } from "@/lib/format";

export type ConfigVariant = {
  id: string;
  sku: string;
  color: string | null;
  hex: string | null;
  texture: string | null;
  size: string | null;
  priceDelta: number;
  available: number | null;
};

export type ConfigTier = {
  minQty: number;
  maxQty: number | null;
  unitPrice: number;
};

export type ConfigImage = { src: string; alt: string };

/**
 * Product detail interactivity (plan 8 "swatch chips, MOQ-aware quantity input,
 * quantity-range table with live price"). Prices are computed from the server
 * tiers for display only; the authoritative quote is produced by the server
 * action, never from these client numbers (AGENTS: never trust client totals).
 */
export function ProductConfigurator({
  slug,
  title,
  moq,
  stockMode,
  productType,
  variants,
  tiers,
  images,
  customizationEnabled,
  locale,
}: {
  slug: string;
  title: string;
  moq: number;
  stockMode: "tracked" | "made_to_order";
  productType: "buy_now" | "quote_only";
  variants: ConfigVariant[];
  tiers: ConfigTier[];
  images: ConfigImage[];
  customizationEnabled: boolean;
  locale: Locale;
}) {
  const t = useTranslations("product");
  const c = useTranslations("common");

  const [variantId, setVariantId] = useState<string | null>(
    variants[0]?.id ?? null,
  );
  const [qty, setQty] = useState<number>(moq > 0 ? moq : 1);
  const [activeImage, setActiveImage] = useState(0);
  // Add-to-cart confirmation; re-selecting any option clears it so the badge
  // never claims a cart holds a quantity that was just changed.
  const [added, setAdded] = useState(false);

  const variant = variants.find((v) => v.id === variantId) ?? null;

  const unitPrice = useMemo(() => {
    if (tiers.length === 0) return null;
    const tier =
      tiers.find(
        (tr) => qty >= tr.minQty && (tr.maxQty == null || qty <= tr.maxQty),
      ) ?? null;
    const base = tier?.unitPrice ?? tiers[0].unitPrice;
    return base + (variant?.priceDelta ?? 0);
  }, [qty, tiers, variant]);

  const total = unitPrice == null ? null : unitPrice * (qty || 0);

  const shownImage = images[activeImage] ?? images[0] ?? null;
  const hasImages = images.length > 0;

  function clampQty(raw: number) {
    if (Number.isNaN(raw)) return moq || 1;
    const min = moq > 0 ? moq : 1;
    return Math.max(min, Math.floor(raw));
  }

  const quoteHref = {
    pathname: "/quote" as const,
    query: {
      product: slug,
      quantity: String(qty || ""),
      ...(variant?.color ? { color: variant.color } : {}),
    },
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Gallery */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Media
            src={shownImage?.src ?? null}
            alt={shownImage?.alt ?? title}
            priority
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="aspect-square w-full rounded-card"
          />
        </div>
        {images.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {images.map((im, i) => (
              <button
                key={`${im.src}-${i}`}
                type="button"
                onClick={() => setActiveImage(i)}
                aria-label={im.alt}
                aria-current={i === activeImage}
                className={cn(
                  "relative h-16 w-16 overflow-hidden rounded-control border",
                  i === activeImage
                    ? "border-brand ring-2 ring-brand/40"
                    : "border-transparent hover:border-border",
                )}
              >
                <Media
                  src={im.src}
                  alt=""
                  sizes="64px"
                  className="h-full w-full"
                />
              </button>
            ))}
          </div>
        ) : null}
        {!hasImages ? (
          <p className="text-sm text-muted-foreground">{c("loading")}</p>
        ) : null}
      </div>

      {/* Purchase panel */}
      <div className="flex flex-col gap-6">
        {/* Color swatches */}
        {variants.length > 0 ? (
          <fieldset className="border-0 p-0">
            <legend className="mb-2 font-medium">{t("color")}</legend>
            <div className="flex flex-wrap gap-2">
              {variants.map((v) => {
                const selected = v.id === variantId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setVariantId(v.id);
                      setAdded(false);
                    }}
                    aria-pressed={selected}
                    aria-label={v.color ?? v.sku}
                    className={cn(
                      "flex items-center gap-2 rounded-control border px-2.5 py-1.5 text-sm transition-colors",
                      selected
                        ? "border-brand bg-brand/10 ring-2 ring-brand/40"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-4 shrink-0 rounded-full border"
                      style={{ backgroundColor: v.hex ?? "transparent" }}
                    />
                    <span className="truncate">{v.color ?? v.sku}</span>
                    {v.size ? (
                      <span className="text-muted-foreground">· {v.size}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {/* Quantity + live price */}
        <div className="flex flex-col gap-4 rounded-card border bg-surface p-4">
          <div className="flex items-end gap-6">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">
                {t("unitPrice")}
              </span>
              <span className="text-2xl font-semibold text-gold-text">
                {unitPrice != null
                  ? formatMoney(unitPrice, locale)
                  : c("priceOnRequest")}
              </span>
            </div>
            {total != null ? (
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">
                  {t("estimatedTotal")}
                </span>
                <span className="text-lg font-medium">
                  {formatMoney(total, locale)}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t("quantity")}</span>
              <Input
                type="number"
                inputMode="numeric"
                min={moq > 0 ? moq : 1}
                value={qty}
                onChange={(e) => {
                  setQty(clampQty(Number(e.target.value)));
                  setAdded(false);
                }}
                className="w-32"
              />
            </label>
            <p className="text-sm text-muted-foreground">
              {t("minOrderNote", { moq: formatNumber(moq, locale) })}
            </p>
          </div>

          {stockMode === "made_to_order" ? (
            <p className="text-sm text-muted-foreground">{c("madeToOrder")}</p>
          ) : null}

          {variant?.available != null && qty > variant.available ? (
            <p className="text-sm text-destructive">
              {t("insufficientStock", {
                count: formatNumber(variant.available, locale),
              })}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {productType === "buy_now" ? (
              <>
                <Button
                  onClick={() => {
                    if (!variantId || qty < 1) return;
                    addToCart(variantId, qty);
                    setAdded(true);
                  }}
                  disabled={
                    !variantId ||
                    qty < 1 ||
                    (variant?.available != null && qty > variant.available)
                  }
                >
                  <ShoppingBag
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4"
                  />
                  {t("addToCart")}
                </Button>
                {added ? (
                  <Button variant="outline" asChild>
                    <Link href="/cart">
                      <Check
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="size-4 text-success"
                      />
                      {t("addedViewCart")}
                    </Link>
                  </Button>
                ) : null}
                {/* COD orders are retail; the quote flow stays available for
                    customers who prefer to negotiate. */}
                <Button
                  variant="ghost"
                  asChild
                  className="text-muted-foreground"
                >
                  <Link href={quoteHref} locale={locale}>
                    {c("requestQuote")}
                  </Link>
                </Button>
              </>
            ) : (
              <Button asChild>
                <Link href={quoteHref} locale={locale}>
                  {c("requestQuote")}
                </Link>
              </Button>
            )}
            {customizationEnabled ? (
              <Button variant="outline" asChild>
                <Link
                  href={{ pathname: "/builder", query: { product: slug } }}
                  locale={locale}
                >
                  {t("customizeThis")}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        {/* Quantity-range table */}
        {tiers.length > 0 ? (
          <div>
            <h2 className="mb-2 font-medium">{t("priceTiers")}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th scope="col" className="py-2 font-medium">
                    {t("tierRange")}
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    {t("tierPrice")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tr) => {
                  const inRange =
                    qty >= tr.minQty && (tr.maxQty == null || qty <= tr.maxQty);
                  return (
                    <tr
                      key={`${tr.minQty}-${tr.maxQty ?? "x"}`}
                      className={cn(
                        "border-b last:border-0",
                        inRange && "bg-brand/10 font-medium",
                      )}
                    >
                      <td className="py-2">
                        {formatNumber(tr.minQty, locale)}
                        {"–"}
                        {tr.maxQty == null
                          ? "∞"
                          : formatNumber(tr.maxQty, locale)}{" "}
                        {c("pieces")}
                      </td>
                      <td className="py-2 text-right">
                        {formatMoney(tr.unitPrice, locale)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
