"use client";

import { ShieldCheck, ShoppingBag } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { loadCart } from "@/app/[locale]/(site)/cart/actions";
import {
  lookupOrder,
  placeCheckoutOrder,
} from "@/app/[locale]/(site)/checkout/actions";
import { Field } from "@/components/site/form-field";
import { Media } from "@/components/site/media";
import { OrderStatus } from "@/components/site/order-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cartCount, clearCart, useCartItems } from "@/lib/cart";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  advanceDue,
  balanceDue,
  meetsMoq,
  priceLines,
  shippingFeeFor,
  subtotalOf,
} from "@/lib/pricing";
import { checkoutSchema } from "@/lib/validators/checkout";
import type { CartLine } from "@/server/cart";
import type { ShippingZone } from "@/server/checkout";
import type { PublicOrder } from "@/server/orders";

/**
 * Guest COD checkout (plan 8 + Phase 5 task 2). The cart on the left is the
 * same server-hydrated view of the client store as `/cart`; the money shown here
 * is display-only — `place_order` re-prices the order, applies the zone fee and
 * reserves stock, so a tampered or stale tab cannot change what is charged. On
 * success the cart is emptied and the confirmation is read back from the database
 * through the same lookup the public status page uses.
 */

type CartData = {
  key: string;
  lines: CartLine[];
  missing: string[];
};

/** One placed order; `order` is null if the read-back lookup failed. */
type Placed = { orderNo: string; order: PublicOrder | null };

function newIdempotencyKey(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  return `web-${random}`.slice(0, 128);
}

export function CheckoutForm({ zones }: { zones: ShippingZone[] }) {
  const t = useTranslations("checkout");
  const locale = useLocale() as Locale;

  const items = useCartItems();
  const qtyByVariant = React.useMemo(
    () => new Map(items.map((i) => [i.variantId, i.qty])),
    [items],
  );
  const idsKey = React.useMemo(
    () => [...qtyByVariant.keys()].sort().join(","),
    [qtyByVariant],
  );

  const [cart, setCart] = React.useState<CartData | null>(null);
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    if (idsKey === "") return;
    let active = true;
    loadCart({ variantIds: idsKey.split(",") }).then((result) => {
      if (!active) return;
      if (result.ok) {
        setCart({ key: idsKey, lines: result.lines, missing: result.missing });
        setLoadFailed(false);
      } else {
        setLoadFailed(true);
      }
    });
    return () => {
      active = false;
    };
  }, [idsKey]);

  const [zoneId, setZoneId] = React.useState(zones[0]?.id ?? "");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>(
    {},
  );
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [placed, setPlaced] = React.useState<Placed | null>(null);
  // Generated once per attempt and kept until it succeeds: replaying the same
  // key (double click, retry after a dropped response) returns the same order.
  const idempotencyRef = React.useRef<string>("");

  const zone = zones.find((z) => z.id === zoneId) ?? null;
  const lines = cart?.lines ?? [];
  const priced = priceLines(
    lines.map((line) => ({
      productId: line.productId,
      qty: qtyByVariant.get(line.variantId) ?? 0,
      priceDelta: line.priceDelta,
      tiers: line.tiers,
    })),
  );
  const subtotal = subtotalOf(priced);
  const shipping = zone ? shippingFeeFor(subtotal, zone) : 0;
  const total = Math.round((subtotal + shipping) * 100) / 100;

  // Same blockers as the cart: a checkout that would fail in the RPC must not
  // look submittable here.
  const blockers = lines.filter((line, i) => {
    const qty = qtyByVariant.get(line.variantId) ?? 0;
    return (
      line.productType !== "buy_now" ||
      !meetsMoq(priced[i].productQty, line.moq) ||
      (line.available !== null && qty > line.available) ||
      priced[i].unitPrice === null
    );
  });

  const ready =
    cart !== null &&
    cart.key === idsKey &&
    items.length > 0 &&
    lines.length > 0 &&
    blockers.length === 0 &&
    zone !== null;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !zone) return;
    const form = event.currentTarget;
    const fd = new FormData(form);
    const payload = {
      items: lines.map((line) => ({
        variant_id: line.variantId,
        qty: qtyByVariant.get(line.variantId) ?? 0,
      })),
      customer_name: String(fd.get("customer_name") ?? ""),
      customer_phone: String(fd.get("customer_phone") ?? ""),
      customer_email: String(fd.get("customer_email") ?? ""),
      division: String(fd.get("division") ?? ""),
      district: String(fd.get("district") ?? ""),
      area: String(fd.get("area") ?? ""),
      address_line: String(fd.get("address_line") ?? ""),
      customer_note: String(fd.get("customer_note") ?? ""),
      shipping_zone_id: zone.id,
      idempotency_key: idempotencyRef.current || newIdempotencyKey(),
      website: String(fd.get("website") ?? ""),
    };
    if (!idempotencyRef.current)
      idempotencyRef.current = payload.idempotency_key;

    // Client pass of the server schema — instant field errors, no round trip.
    // The honeypot is exempt here: a baited submit must still reach the
    // server, which owns the fake-success verdict (plan 15.2 B3). Validating
    // `website` client-side would silently swallow the bot's post.
    const parsed = checkoutSchema.safeParse({ ...payload, website: "" });
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "form");
        if (!errors[field]) {
          errors[field] =
            issue.code === "custom" ? issue.message : "errRequired";
        }
      }
      setFieldErrors(errors);
      setFormError(null);
      return;
    }

    setFieldErrors({});
    setFormError(null);
    setPending(true);
    try {
      const result = await placeCheckoutOrder(payload);
      if (result.ok) {
        if (result.orderNo) {
          // The order exists now — empty the cart so a back-button cannot
          // submit the same lines twice, then read the numbers back from the DB.
          clearCart();
          const found = await lookupOrder({
            order_no: result.orderNo,
            customer_phone: parsed.data.customer_phone,
          }).catch(() => null);
          setPlaced({
            orderNo: result.orderNo,
            order: found && found.ok ? found.order : null,
          });
        } else {
          // Honeypot submission: pretend success without creating anything.
          setPending(false);
        }
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.formError ?? "errGeneric");
        // A rejected payload never reached the RPC, so the same key is reused
        // on the next attempt; only a hard failure clears it.
        setPending(false);
      }
    } catch {
      idempotencyRef.current = "";
      setFormError("errGeneric");
      setPending(false);
    }
  }

  if (placed) {
    if (placed.order) return <OrderStatus order={placed.order} justPlaced />;
    // The order is created but the read-back failed — show the number, not a
    // blank screen, and point at the status page.
    return (
      <section className="rounded-card border bg-surface p-6">
        <p className="text-sm text-muted-foreground">{t("placedLabel")}</p>
        <h2 className="mt-1 font-mono text-2xl font-semibold tracking-tight">
          {placed.orderNo}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("placedNote")}</p>
        <div className="mt-4">
          <Button asChild variant="outline">
            <Link href={`/order/${placed.orderNo}`}>{t("viewOrder")}</Link>
          </Button>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card border border-dashed px-6 py-16 text-center">
        <ShoppingBag
          aria-hidden="true"
          strokeWidth={1.75}
          className="size-8 text-muted-foreground"
        />
        <p className="font-medium">{t("emptyCart")}</p>
        <Button asChild>
          <Link href="/cart">{t("backToCart")}</Link>
        </Button>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t("loadError")}
      </p>
    );
  }

  if (cart === null || cart.key !== idsKey) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]" aria-busy="true">
        <div className="space-y-3">
          <div className="h-64 animate-pulse rounded-card bg-muted" />
        </div>
        <div className="h-64 animate-pulse rounded-card bg-muted" />
      </div>
    );
  }

  const zoneName = (z: ShippingZone) =>
    locale === "bn" && z.nameBn ? z.nameBn : z.nameEn;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]"
    >
      <div className="flex flex-col gap-6">
        {/* What is being ordered — read-only here; edits happen in the cart. */}
        <section
          aria-labelledby="checkout-items"
          className="rounded-card border bg-surface p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 id="checkout-items" className="font-medium">
              {t("itemsTitle")}
            </h2>
            <Link href="/cart" className="text-sm underline">
              {t("editCart")}
            </Link>
          </div>
          <ul className="flex flex-col divide-y">
            {lines.map((line, i) => {
              const qty = qtyByVariant.get(line.variantId) ?? 0;
              const title =
                locale === "bn" && line.titleBn ? line.titleBn : line.titleEn;
              return (
                <li
                  key={line.variantId}
                  className="flex items-center gap-3 py-3"
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-control border bg-surface-2">
                    <Media
                      src={line.image}
                      alt={title}
                      sizes="48px"
                      className="h-full w-full"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {title}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {[line.color, line.size].filter(Boolean).join(" · ") ||
                        line.sku}
                    </span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {formatNumber(qty, locale)} ×{" "}
                    {formatMoney(priced[i].unitPrice ?? 0, locale)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Contact */}
        <section className="flex flex-col gap-4 rounded-card border bg-surface p-4">
          <h2 className="font-medium">{t("contactTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="customer_name"
              label={t("name")}
              required
              error={
                fieldErrors.customer_name
                  ? t(fieldErrors.customer_name)
                  : undefined
              }
            >
              <Input
                id="customer_name"
                name="customer_name"
                autoComplete="name"
                required
                aria-invalid={!!fieldErrors.customer_name}
              />
            </Field>
            <Field
              id="customer_phone"
              label={t("phone")}
              required
              error={
                fieldErrors.customer_phone
                  ? t(fieldErrors.customer_phone)
                  : undefined
              }
            >
              <Input
                id="customer_phone"
                name="customer_phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                required
                aria-invalid={!!fieldErrors.customer_phone}
              />
            </Field>
            <Field
              id="customer_email"
              label={t("email")}
              error={
                fieldErrors.customer_email
                  ? t(fieldErrors.customer_email)
                  : undefined
              }
            >
              <Input
                id="customer_email"
                name="customer_email"
                type="email"
                autoComplete="email"
                aria-invalid={!!fieldErrors.customer_email}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground">{t("phoneHelp")}</p>
        </section>

        {/* Delivery */}
        <section className="flex flex-col gap-4 rounded-card border bg-surface p-4">
          <h2 className="font-medium">{t("deliveryTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="division"
              label={t("division")}
              error={fieldErrors.division ? t(fieldErrors.division) : undefined}
            >
              <Input
                id="division"
                name="division"
                autoComplete="address-level1"
                aria-invalid={!!fieldErrors.division}
              />
            </Field>
            <Field
              id="district"
              label={t("district")}
              required
              error={fieldErrors.district ? t(fieldErrors.district) : undefined}
            >
              <Input
                id="district"
                name="district"
                required
                aria-invalid={!!fieldErrors.district}
              />
            </Field>
            <Field
              id="area"
              label={t("area")}
              required
              error={fieldErrors.area ? t(fieldErrors.area) : undefined}
            >
              <Input
                id="area"
                name="area"
                autoComplete="address-level2"
                required
                aria-invalid={!!fieldErrors.area}
              />
            </Field>
          </div>
          <Field
            id="address_line"
            label={t("address")}
            required
            error={
              fieldErrors.address_line ? t(fieldErrors.address_line) : undefined
            }
          >
            <Textarea
              id="address_line"
              name="address_line"
              rows={2}
              required
              autoComplete="street-address"
              aria-invalid={!!fieldErrors.address_line}
            />
          </Field>
          <Field
            id="customer_note"
            label={t("note")}
            error={
              fieldErrors.customer_note
                ? t(fieldErrors.customer_note)
                : undefined
            }
          >
            <Textarea id="customer_note" name="customer_note" rows={2} />
          </Field>
        </section>

        {/* Shipping zone */}
        <fieldset className="flex flex-col gap-3 rounded-card border bg-surface p-4">
          <legend className="mb-1 font-medium">{t("zoneTitle")}</legend>
          {zones.length === 0 ? (
            <p className="text-sm text-destructive">{t("noZones")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {zones.map((z) => (
                <label
                  key={z.id}
                  className={[
                    "flex items-center justify-between gap-3 rounded-control border px-3 py-2.5 text-sm",
                    z.id === zoneId ? "border-brand bg-brand/10" : "",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="shipping_zone"
                      value={z.id}
                      checked={z.id === zoneId}
                      onChange={() => setZoneId(z.id)}
                      className="size-4 accent-brand"
                    />
                    <span className="font-medium">{zoneName(z)}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {formatMoney(z.fee, locale)}
                    {z.freeOver !== null
                      ? ` · ${t("freeOver", { amount: formatMoney(z.freeOver, locale) })}`
                      : ""}
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {/* Honeypot — hidden from people, filled by bots (plan 8). */}
        <div className="hidden" aria-hidden>
          <label htmlFor="checkout-website">Website</label>
          <input
            id="checkout-website"
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
      </div>

      {/* Summary */}
      <aside
        aria-label={t("summaryAria")}
        className="sticky top-20 flex flex-col gap-4 rounded-card border bg-surface p-5"
      >
        <h2 className="font-medium">{t("summary")}</h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {t("pieces", { count: formatNumber(cartCount(items), locale) })}
            </dt>
            <dd />
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("subtotal")}</dt>
            <dd>{formatMoney(subtotal, locale)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{t("shipping")}</dt>
            <dd>
              {zone
                ? shipping === 0
                  ? t("shippingFree")
                  : formatMoney(shipping, locale)
                : t("shippingPending")}
            </dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>{t("total")}</dt>
            <dd>{formatMoney(total, locale)}</dd>
          </div>
          <div className="flex justify-between rounded-control bg-surface-2 px-2 py-1.5">
            <dt className="text-muted-foreground">{t("advanceDue")}</dt>
            <dd className="font-medium">
              {formatMoney(advanceDue(total), locale)}
            </dd>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <dt>{t("codBalance")}</dt>
            <dd>{formatMoney(balanceDue(total), locale)}</dd>
          </div>
        </dl>

        {formError ? (
          <p role="alert" className="text-sm text-destructive">
            {t(formError)}
          </p>
        ) : null}
        {blockers.length > 0 ? (
          <p role="alert" className="text-sm text-destructive">
            {t("fixInCart")}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={!ready || pending}>
          {pending ? t("placing") : t("placeOrder")}
        </Button>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-4 shrink-0"
          />
          {t("callNote")}
        </p>
        <p className="text-xs text-muted-foreground">{t("advanceNote")}</p>
      </aside>
    </form>
  );
}
