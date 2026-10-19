"use client";

import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { loadCart } from "@/app/[locale]/(site)/cart/actions";
import { Media } from "@/components/site/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  cartCount,
  removeFromCart,
  setCartQty,
  useCartItems,
} from "@/lib/cart";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  meetsMoq,
  priceLines,
  subtotalOf,
  type LinePricing,
} from "@/lib/pricing";
import type { CartLine } from "@/server/cart";

/**
 * Cart page body (plan Phase 5 task 1): the store holds only {variantId, qty};
 * on open we re-hydrate every line from the server (fresh prices, MOQ, stock,
 * publish state) and recompute quantity-range pricing across the cart with
 * `pricing.ts` — the same rules `place_order` will apply. Stock checks and MOQ
 * warnings block the checkout CTA; items that vanished from the catalog get a
 * "remove" cleanup. Loading/empty/error states ship at final dimensions.
 */

type CartData =
  | { status: "error"; text: string }
  | { status: "ready"; key: string; lines: CartLine[]; missing: string[] };

export function CartView() {
  const t = useTranslations("cart");
  const c = useTranslations("common");
  const locale = useLocale() as Locale;
  const items = useCartItems();
  const qtyByVariant = React.useMemo(
    () => new Map(items.map((i) => [i.variantId, i.qty])),
    [items],
  );
  // Re-fetch only when the set of variants changes, not on every qty edit.
  const idsKey = React.useMemo(
    () => [...qtyByVariant.keys()].sort().join(","),
    [qtyByVariant],
  );

  // React Compiler forbids synchronous setState inside effects, so "loading"
  // is derived: data is either null or stale for the current idsKey. The
  // effect below only cancels/re-issues the async fetch.
  const [data, setData] = React.useState<CartData | null>(null);
  const cancelRef = React.useRef<(andClearError: boolean) => void>(
    () => undefined,
  );

  React.useEffect(() => {
    if (idsKey === "") return; // empty cart renders its empty state directly
    if (data && data.status === "ready" && data.key === idsKey) return;
    if (data && data.status === "error") return; // retry resets data to null
    let active = true;
    cancelRef.current = (andClearError) => {
      active = false;
      if (andClearError) setData(null);
    };
    loadCart({ variantIds: idsKey.split(",") })
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setData({
            status: "ready",
            key: idsKey,
            lines: result.lines,
            missing: result.missing,
          });
        } else {
          setData({ status: "error", text: result.error });
        }
      })
      .catch(() => {
        if (active) setData({ status: "error", text: t("loadError") });
      });
    return () => {
      active = false;
    };
    // t is stable per locale; idsKey/data are the real triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, data]);

  if (items.length === 0 && (!data || data.status === "ready")) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed px-6 py-16 text-center">
        <ShoppingBag
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-8 text-muted-foreground"
        />
        <p className="font-medium">{t("empty")}</p>
        <p className="text-sm text-muted-foreground">{t("emptyHint")}</p>
        <Button asChild>
          <Link href="/">{t("browse")}</Link>
        </Button>
      </div>
    );
  }

  if (data && data.status === "error") {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert" className="text-sm text-destructive">
          {data.text}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            cancelRef.current(true);
          }}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!data || data.key !== idsKey) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]" aria-busy="true">
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-card bg-muted" />
          ))}
        </div>
        <div className="h-48 animate-pulse rounded-card bg-muted" />
      </div>
    );
  }

  const lines = data.lines;
  const totalPieces = cartCount(items);

  const priced: LinePricing[] = priceLines(
    lines.map((line) => ({
      productId: line.productId,
      qty: qtyByVariant.get(line.variantId) ?? 0,
      priceDelta: line.priceDelta,
      tiers: line.tiers,
    })),
  );
  const subtotal = subtotalOf(priced);

  // Checkout blockers: MOQ (per product, grouped like place_order does), stock,
  // quote-only products, no tier price.
  const blockers = lines
    .map((line, i) => ({ line, p: priced[i] }))
    .filter(({ line, p }) => {
      const qty = qtyByVariant.get(line.variantId) ?? 0;
      return (
        !meetsMoq(p.productQty, line.moq) ||
        (line.available !== null && qty > line.available) ||
        line.productType !== "buy_now" ||
        p.unitPrice === null
      );
    });

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-3">
        {data.missing.length > 0 && (
          <div className="flex items-center justify-between gap-3 rounded-control border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-warning-foreground">
            <span>{t("missingNote", { count: data.missing.length })}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                for (const id of data.missing) removeFromCart(id);
              }}
            >
              {t("removeMissing")}
            </Button>
          </div>
        )}

        <ul className="flex flex-col gap-3">
          {lines.map((line, i) => {
            const qty = qtyByVariant.get(line.variantId) ?? 0;
            const { unitPrice, lineTotal, productQty } = priced[i];
            // MOQ is a per-product rule: other variants of the same product in
            // the cart count towards it (mirrors place_order).
            const belowMoq = !meetsMoq(productQty, line.moq);
            const overStock = line.available !== null && qty > line.available;
            const title =
              locale === "bn" && line.titleBn ? line.titleBn : line.titleEn;
            return (
              <li
                key={line.variantId}
                className="flex gap-4 rounded-card border bg-surface p-4"
              >
                <Link
                  href={`/product/${line.slug}`}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-control border bg-surface-2"
                  // The thumbnail is decorative chrome (Media renders an
                  // aria-hidden block when a product has no image yet — local
                  // seed data), so the link needs its own accessible name or
                  // axe flags `link-name`. Found by the local-stack e2e run.
                  aria-label={title}
                >
                  <Media
                    src={line.image}
                    alt={title}
                    sizes="80px"
                    className="h-full w-full"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/product/${line.slug}`}
                        className="truncate font-medium hover:underline"
                      >
                        {title}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">
                        {[line.color, line.size].filter(Boolean).join(" · ") ||
                          line.sku}
                        {productQty > qty
                          ? ` · ${t("pricedWithCart", { count: formatNumber(productQty, locale) })}`
                          : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("removeAria", { title })}
                      onClick={() => removeFromCart(line.variantId)}
                    >
                      <Trash2
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="size-4"
                      />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label={t("decreaseAria")}
                        disabled={qty <= 1}
                        onClick={() => setCartQty(line.variantId, qty - 1)}
                      >
                        <Minus
                          aria-hidden="true"
                          strokeWidth={1.75}
                          className="size-3.5"
                        />
                      </Button>
                      <label
                        className="sr-only"
                        htmlFor={`qty-${line.variantId}`}
                      >
                        {t("quantity")}
                      </label>
                      <Input
                        id={`qty-${line.variantId}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={qty}
                        onChange={(e) =>
                          setCartQty(
                            line.variantId,
                            Number(e.target.value) || 0,
                          )
                        }
                        className="w-20 text-center"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label={t("increaseAria")}
                        onClick={() => setCartQty(line.variantId, qty + 1)}
                      >
                        <Plus
                          aria-hidden="true"
                          strokeWidth={1.75}
                          className="size-3.5"
                        />
                      </Button>
                    </div>
                    <div className="ml-auto text-right">
                      <p className="text-sm text-muted-foreground">
                        {unitPrice === null
                          ? c("priceOnRequest")
                          : `${formatMoney(unitPrice, locale)} / ${c("pieces")}`}
                      </p>
                      <p className="font-semibold">
                        {formatMoney(lineTotal, locale)}
                      </p>
                    </div>
                  </div>

                  {line.productType !== "buy_now" && (
                    <p className="text-sm text-destructive">
                      {t("quoteOnly")}{" "}
                      <Link
                        href={`/quote?product=${line.slug}`}
                        className="underline"
                      >
                        {c("requestQuote")}
                      </Link>
                    </p>
                  )}
                  {belowMoq && (
                    <p className="text-sm text-destructive">
                      {t("belowMoq", { moq: formatNumber(line.moq, locale) })}
                    </p>
                  )}
                  {overStock && line.available !== null && (
                    <p className="text-sm text-destructive">
                      {t("overStock", {
                        count: formatNumber(line.available, locale),
                      })}
                    </p>
                  )}
                  {line.stockMode === "made_to_order" &&
                    !belowMoq &&
                    !overStock && (
                      <p className="text-sm text-muted-foreground">
                        {c("madeToOrder")}
                      </p>
                    )}
                </div>
              </li>
            );
          })}
        </ul>

        <div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">{t("continueShopping")}</Link>
          </Button>
        </div>
      </div>

      <aside
        aria-label={t("summaryAria")}
        className="sticky top-20 flex flex-col gap-4 rounded-card border bg-surface p-5"
      >
        <h2 className="font-medium">{t("summary")}</h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {t("items", { count: formatNumber(totalPieces, locale) })}
            </dt>
            <dd />
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>{t("subtotal")}</dt>
            <dd>{formatMoney(subtotal, locale)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          {t("shippingAtCheckout")}
        </p>
        <Button
          asChild
          className="w-full"
          disabled={blockers.length > 0 || lines.length === 0}
        >
          <Link href="/checkout">{t("checkout")}</Link>
        </Button>
        {blockers.length > 0 && (
          <p className="text-xs text-destructive">{t("fixBeforeCheckout")}</p>
        )}
        <p className="text-xs text-muted-foreground">{t("advanceNote")}</p>
      </aside>
    </div>
  );
}
