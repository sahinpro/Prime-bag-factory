"use client";

import {
  BadgeCheck,
  CircleDashed,
  Package,
  PhoneCall,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as React from "react";

import { lookupOrder } from "@/app/[locale]/(site)/checkout/actions";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/site/form-field";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { publicEnv } from "@/lib/env";
import { advanceDue, balanceDue } from "@/lib/pricing";
import { orderLookupSchema } from "@/lib/validators/checkout";
import type { PublicOrder } from "@/server/orders";

/**
 * Order confirmation and status (plan Phase 5 task 2). One presentation
 * component (`OrderStatus`) is shared by two entry points: the checkout screen
 * right after `place_order` returns an order number, and `/order/[orderNo]`,
 * where a returning customer looks the order up with the number + the phone it
 * was placed with. Both show what the database holds — the RPC's numbers, never
 * anything the browser remembered.
 */

/**
 * Explicit branches rather than a map lookup: React Compiler rejects rendering
 * a component identity that was chosen during render.
 */
function StatusIcon({ status }: { status: string }) {
  const props = { "aria-hidden": true, strokeWidth: 1.75, className: "size-4" } as const;
  switch (status) {
    case "confirmed":
      return <PhoneCall {...props} />;
    case "processing":
      return <Package {...props} />;
    case "shipped":
      return <Truck {...props} />;
    case "delivered":
      return <BadgeCheck {...props} />;
    case "cancelled":
      return <XCircle {...props} />;
    case "returned":
      return <RotateCcw {...props} />;
    default:
      return <CircleDashed {...props} />;
  }
}

export function OrderStatus({
  order,
  justPlaced,
}: {
  order: PublicOrder;
  justPlaced?: boolean;
}) {
  const t = useTranslations("order");
  const c = useTranslations("common");
  const locale = useLocale() as Locale;
  const advance = advanceDue(order.total);
  const balance = balanceDue(order.total);
  const waDigits = publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^\d]/g, "");

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="order-head"
        className="rounded-card border bg-surface p-6"
      >
        <p className="text-sm text-muted-foreground">
          {justPlaced ? t("placedLabel") : t("orderLabel")}
        </p>
        <h2
          id="order-head"
          className="mt-1 font-mono text-2xl font-semibold tracking-tight"
        >
          {order.orderNo}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("placedOn", {
            date: formatDate(new Date(order.placedAt), locale),
          })}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm">
            <StatusIcon status={order.status} />
            {t(`status.${order.status}`)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm">
            <PhoneCall aria-hidden="true" strokeWidth={1.75} className="size-4" />
            {t(`payment.${order.paymentStatus}`)}
          </span>
        </div>

        {justPlaced ? (
          <p className="mt-4 flex items-start gap-2 rounded-control bg-brand/10 px-3 py-2 text-sm">
            <PhoneCall aria-hidden="true" strokeWidth={1.75} className="mt-0.5 size-4 shrink-0 text-gold-text" />
            <span>{t("callNote")}</span>
          </p>
        ) : null}
      </section>

      {/* Money — read back from the row `place_order` wrote. */}
      <section
        aria-labelledby="order-totals"
        className="rounded-card border bg-surface p-6"
      >
        <h3 id="order-totals" className="font-medium">
          {t("totalsTitle")}
        </h3>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("subtotal")}</dt>
            <dd>{formatMoney(order.subtotal, locale)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{t("shipping")}</dt>
            <dd>{formatMoney(order.shippingFee, locale)}</dd>
          </div>
          {order.discount > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t("discount")}</dt>
              <dd>−{formatMoney(order.discount, locale)}</dd>
            </div>
          ) : null}
          {order.vatAmount > 0 ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{c("vat")}</dt>
              <dd>{formatMoney(order.vatAmount, locale)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-t pt-2 text-base font-semibold">
            <dt>{t("total")}</dt>
            <dd>{formatMoney(order.total, locale)}</dd>
          </div>
          <div className="flex justify-between gap-4 rounded-control bg-surface-2 px-2 py-1.5">
            <dt className="text-muted-foreground">{t("advanceDue")}</dt>
            <dd className="font-medium">{formatMoney(advance, locale)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-xs text-muted-foreground">
            <dt>{t("paidSoFar")}</dt>
            <dd>{formatMoney(order.paid, locale)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-xs text-muted-foreground">
            <dt>{t("balanceOnDelivery")}</dt>
            <dd>{formatMoney(Math.max(0, balance - order.paid), locale)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">{t("advanceNote")}</p>
      </section>

      {/* Lines */}
      <section
        aria-labelledby="order-items"
        className="rounded-card border bg-surface p-6"
      >
        <h3 id="order-items" className="font-medium">
          {t("itemsTitle")}
        </h3>
        <ul className="mt-3 flex flex-col divide-y">
          {order.items.map((item, i) => (
            <li key={i} className="flex items-baseline justify-between gap-4 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{item.title}</span>
                <span className="block truncate text-muted-foreground">
                  {[item.color, item.size].filter(Boolean).join(" · ") || item.sku || ""}
                </span>
              </span>
              <span className="shrink-0 text-right text-muted-foreground">
                {formatNumber(item.qty, locale)} × {formatMoney(item.unitPrice, locale)}
                <span className="block font-medium text-foreground">
                  {formatMoney(item.lineTotal, locale)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Delivery */}
      <section
        aria-labelledby="order-delivery"
        className="rounded-card border bg-surface p-6"
      >
        <h3 id="order-delivery" className="font-medium">
          {t("deliveryTitle")}
        </h3>
        <address className="mt-2 text-sm not-italic text-muted-foreground">
          <span className="block font-medium text-foreground">
            {order.customerName}
          </span>
          {order.addressLine ? <span className="block">{order.addressLine}</span> : null}
          <span className="block">
            {[order.area, order.district, order.division].filter(Boolean).join(", ")}
          </span>
          <span className="block">{order.customerPhone}</span>
        </address>
        {order.trackingCode ? (
          <p className="mt-3 text-sm">
            {t("tracking")}:{" "}
            <span className="font-medium text-foreground">
              {[order.courierName, order.trackingCode].filter(Boolean).join(" · ")}
            </span>
          </p>
        ) : null}
        {order.shippedAt || order.deliveredAt ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {order.shippedAt
              ? t("shippedOn", { date: formatDate(new Date(order.shippedAt), locale) })
              : ""}
            {order.deliveredAt
              ? ` · ${t("deliveredOn", { date: formatDate(new Date(order.deliveredAt), locale) })}`
              : ""}
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <a
            href={`https://wa.me/${waDigits}?text=${encodeURIComponent(
              t("whatsappPrefill", { orderNo: order.orderNo }),
            )}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <PhoneCall aria-hidden="true" strokeWidth={1.75} className="size-4" />
            {t("contactUs")}
          </a>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">{t("backHome")}</Link>
        </Button>
      </div>
    </div>
  );
}

type LookupState =
  | { kind: "form" }
  | { kind: "error"; text: string }
  | { kind: "found"; order: PublicOrder };

/**
 * `/order/[orderNo]` body: the order number arrives in the URL, the phone does
 * not — both are required, so this page cannot be used to read someone else's
 * order by guessing numbers.
 */
export function OrderLookup({ orderNo }: { orderNo: string }) {
  const t = useTranslations("order");
  const [state, setState] = React.useState<LookupState>({ kind: "form" });
  const [pending, setPending] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const payload = {
      order_no: String(fd.get("order_no") ?? ""),
      customer_phone: String(fd.get("customer_phone") ?? ""),
    };
    const parsed = orderLookupSchema.safeParse(payload);
    if (!parsed.success) {
      setState({ kind: "error", text: t("errNotFound") });
      return;
    }
    setPending(true);
    try {
      const result = await lookupOrder(payload);
      setState(
        result.ok
          ? { kind: "found", order: result.order }
          : { kind: "error", text: t(result.formError) },
      );
    } catch {
      setState({ kind: "error", text: t("errGeneric") });
    } finally {
      setPending(false);
    }
  }

  if (state.kind === "found") {
    return <OrderStatus order={state.order} />;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-card border bg-surface p-6">
      <p className="text-sm text-muted-foreground">{t("lookupHint")}</p>
      {state.kind === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {state.text}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="order_no" label={t("orderNoField")} required>
          <Input
            id="order_no"
            name="order_no"
            defaultValue={orderNo}
            placeholder="PBF-251018-0001"
            className="font-mono"
            required
          />
        </Field>
        <Field id="customer_phone" label={t("phoneField")} required>
          <Input
            id="customer_phone"
            name="customer_phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01XXXXXXXXX"
            required
          />
        </Field>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("lookingUp") : t("lookup")}
        </Button>
      </div>
    </form>
  );
}
