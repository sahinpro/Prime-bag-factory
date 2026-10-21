"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  CircleDot,
  ClipboardList,
  MessageCircle,
  Phone,
  Printer,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import {
  blockOrderPhone,
  recordPayment,
  saveOrderNote,
  saveShippingDetails,
  setOrderStatus,
  setProductionStatus,
} from "@/app/(admin)/admin/orders/actions";
import {
  ORDER_STATUS_META,
  PRODUCTION_STATUS_META,
  StatusBadge,
} from "@/components/admin/data/status-badge";
import { ConfirmDialog } from "@/components/admin/forms/confirm-dialog";
import {
  FlashLine,
  useActionSave,
} from "@/components/admin/products/use-action-save";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  allowedProductionMoves,
  type OrderStatus,
  type PaymentMethod,
  type ProductionStatus,
} from "@/lib/validators/order-admin";
import type { AdminOrder } from "@/server/orders";

/**
 * Order detail (plan 9c.8): left column — items, payments ledger, status
 * timeline; right column — customer/delivery summary, courier details, the
 * fulfilment pipeline and the internal note. Status moves and payments run
 * through the Postgres fulfilment functions, so stock and `payment_status`
 * change in the same transaction as the history entry.
 */

const PIPELINE: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

const SHIPPED_OR_LATER: OrderStatus[] = ["shipped", "delivered", "returned"];

function statusLabel(value: string): string {
  return ORDER_STATUS_META[value]?.label ?? value;
}

function SectionCard({
  title,
  children,
  action,
}: Readonly<{
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}>) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {action}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground sm:col-span-2">{children}</dd>
    </div>
  );
}

function Money({ value }: Readonly<{ value: number }>) {
  return <span className="tabular-nums">{formatMoney(value, "en")}</span>;
}

function TotalRow({
  label,
  value,
  strong = false,
}: Readonly<{ label: string; value: number; strong?: boolean }>) {
  return (
    <div
      className={
        strong
          ? "flex items-center justify-between border-t border-border pt-2 text-sm font-semibold text-foreground"
          : "flex items-center justify-between text-sm"
      }
    >
      <span className={strong ? undefined : "text-muted-foreground"}>
        {label}
      </span>
      <Money value={value} />
    </div>
  );
}

export function OrderDetail({ order }: Readonly<{ order: AdminOrder }>) {
  const { saving, flash, run } = useActionSave();

  const [note, setNote] = React.useState("");
  const [amount, setAmount] = React.useState(() =>
    String(order.paid === 0 ? order.advance_due : order.balance),
  );
  const [method, setMethod] = React.useState<PaymentMethod>("bkash_manual");
  const [reference, setReference] = React.useState("");
  const [paymentNote, setPaymentNote] = React.useState("");
  const [courier, setCourier] = React.useState(order.courier_name ?? "");
  const [tracking, setTracking] = React.useState(order.tracking_code ?? "");
  const [adminNote, setAdminNote] = React.useState(order.admin_note ?? "");
  const [prodNote, setProdNote] = React.useState("");

  const paymentError =
    amount.trim() === "" || Number.isNaN(Number(amount))
      ? "Enter a payment amount."
      : Number(amount) <= 0
        ? "The amount must be greater than zero."
        : Number(amount) > order.balance
          ? "That is more than the balance due."
          : null;

  const canCancel = !SHIPPED_OR_LATER.includes(order.status);
  const canReturn = order.status === "delivered";
  const closed = order.status === "cancelled" || order.status === "returned";
  const unitCount = order.lines.reduce((sum, line) => sum + line.qty, 0);

  const phoneDigits = order.customer_phone.replace(/\D/g, "");
  const waText = encodeURIComponent(
    `Hello${order.customer_name ? ` ${order.customer_name}` : ""}, this is Prime Bag Factory about your order ${order.order_no}.`,
  );

  function changeStatus(next: OrderStatus, successLabel: string) {
    return run(
      () => setOrderStatus({ id: order.id, status: next, note }),
      `Marked as ${successLabel}.`,
    ).then((ok) => {
      if (ok) setNote("");
      return ok;
    });
  }

  const isBulk = order.type === "bulk";
  const productionStatus = order.production_status as ProductionStatus | null;
  const productionMoves = isBulk
    ? allowedProductionMoves(productionStatus)
    : [];

  function changeProduction(next: ProductionStatus) {
    const label = PRODUCTION_STATUS_META[next]?.label ?? next;
    return run(
      () => setProductionStatus({ id: order.id, status: next, note: prodNote }),
      `Production marked ${label}.`,
    ).then((ok) => {
      if (ok) setProdNote("");
      return ok;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.order_no}
        description={`${order.customer_name} · placed ${formatDate(new Date(order.created_at), "en")} · ${formatNumber(unitCount, "en")} pcs`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/orders">
                <ArrowLeft
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                All orders
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://wa.me/${phoneDigits}?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                WhatsApp
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:${phoneDigits}`}>
                <Phone
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                Call
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/print/orders/${order.id}/invoice`}>
                <Printer
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                Invoice
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/print/orders/${order.id}/packing`}>
                <Printer
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                Packing slip
              </Link>
            </Button>
          </div>
        }
      />

      <FlashLine flash={flash} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Items">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Items on order {order.order_no}
                </caption>
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">
                      Product
                    </th>
                    <th
                      scope="col"
                      className="py-2 pr-3 text-right font-medium"
                    >
                      Qty
                    </th>
                    <th
                      scope="col"
                      className="py-2 pr-3 text-right font-medium"
                    >
                      Unit price
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Line total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.lines.map((line) => (
                    <tr key={line.id} className="border-b border-border/60">
                      <th
                        scope="row"
                        className="py-2 pr-3 text-left font-normal"
                      >
                        <span className="block text-foreground">
                          {line.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {[line.sku, line.color, line.size]
                            .filter(Boolean)
                            .join(" · ") || "No variant code"}
                        </span>
                      </th>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatNumber(line.qty, "en")}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <Money value={line.unit_price} />
                      </td>
                      <td className="py-2 text-right">
                        <Money value={line.line_total} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1 pt-1">
              <TotalRow label="Subtotal" value={order.subtotal} />
              <TotalRow label="Shipping" value={order.shipping_fee} />
              {order.discount > 0 ? (
                <TotalRow label="Discount" value={-order.discount} />
              ) : null}
              {order.vat_amount > 0 ? (
                <TotalRow label="VAT" value={order.vat_amount} />
              ) : null}
              <TotalRow label="Total" value={order.total} strong />
            </div>
          </SectionCard>

          <SectionCard
            title="Payments"
            action={
              <span className="text-xs text-muted-foreground">
                Balance due <Money value={order.balance} />
              </span>
            }
          >
            {order.payments.length === 0 ? (
              <p className="rounded-control bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
                Nothing received yet. The 50% advance (
                <Money value={order.advance_due} />) is collected by hand and
                recorded here.
              </p>
            ) : (
              <ul className="space-y-2">
                {order.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex items-start justify-between gap-3 rounded-control border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        {PAYMENT_METHOD_LABELS[
                          payment.method as PaymentMethod
                        ] ?? payment.method}
                        {payment.reference ? (
                          <span className="text-muted-foreground">
                            {" · "}
                            {payment.reference}
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(new Date(payment.received_at), "en")}
                        {payment.note ? ` · ${payment.note}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium">
                      <Money value={payment.amount} />
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {!closed && order.balance > 0 ? (
              <form
                className="space-y-3 border-t border-border pt-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (paymentError) return;
                  run(
                    () =>
                      recordPayment({
                        id: order.id,
                        amount,
                        method,
                        reference,
                        note: paymentNote,
                      }),
                    "Payment recorded.",
                  ).then((ok) => {
                    if (ok) {
                      setReference("");
                      setPaymentNote("");
                    }
                  });
                }}
              >
                <h3 className="text-sm font-medium text-foreground">
                  Record a payment
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="payment-amount">Amount (BDT)</Label>
                    <Input
                      id="payment-amount"
                      name="payment_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      autoComplete="off"
                      inputMode="decimal"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      aria-describedby={
                        paymentError ? "payment-amount-error" : undefined
                      }
                    />
                    {paymentError ? (
                      <p
                        id="payment-amount-error"
                        className="text-xs text-destructive"
                      >
                        {paymentError}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Advance due <Money value={order.advance_due} /> ·
                        balance <Money value={order.balance} />
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="payment-method">Method</Label>
                    <Select
                      value={method}
                      onValueChange={(value) =>
                        setMethod(value as PaymentMethod)
                      }
                    >
                      <SelectTrigger id="payment-method">
                        <SelectValue placeholder="Method" />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYMENT_METHODS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {PAYMENT_METHOD_LABELS[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="payment-reference">
                      Reference{" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="payment-reference"
                      name="payment_reference"
                      autoComplete="off"
                      maxLength={120}
                      placeholder="bKash TrxID, bank slip…"
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="payment-note">
                      Note{" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="payment-note"
                      name="payment_note"
                      autoComplete="off"
                      maxLength={500}
                      value={paymentNote}
                      onChange={(event) => setPaymentNote(event.target.value)}
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving || Boolean(paymentError)}
                >
                  <BadgeCheck
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4"
                  />
                  {saving ? "Recording…" : "Record payment"}
                </Button>
              </form>
            ) : null}
          </SectionCard>

          <SectionCard title="Status history">
            {order.history.length === 0 ? (
              <p className="rounded-control bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
                No status changes yet — the pipeline below records every move.
              </p>
            ) : (
              <ol className="space-y-3">
                {order.history.map((event) => (
                  <li key={event.id} className="flex gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
                      <CircleDot
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="size-3.5"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        {event.from_status
                          ? `${statusLabel(event.from_status)} → ${statusLabel(event.to_status)}`
                          : statusLabel(event.to_status)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(new Date(event.created_at), "en")}
                        {event.note ? ` · ${event.note}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="Status"
            action={<StatusBadge domain="order" value={order.status} />}
          >
            <ol className="space-y-1.5" aria-label="Order fulfilment pipeline">
              {PIPELINE.map((value) => {
                const current = order.status === value;
                return (
                  <li key={value}>
                    <Button
                      type="button"
                      variant={current ? "default" : "outline"}
                      size="sm"
                      className="w-full justify-start"
                      aria-current={current ? "step" : undefined}
                      disabled={saving || current || closed}
                      onClick={() =>
                        void changeStatus(value, statusLabel(value))
                      }
                    >
                      {current ? "Current: " : "Mark "}
                      {statusLabel(value)}
                    </Button>
                  </li>
                );
              })}
            </ol>
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="status-note">
                Note for the history{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="status-note"
                name="status_note"
                rows={2}
                maxLength={1000}
                placeholder="Called the customer, advance paid on bKash…"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
            {canCancel ? (
              <ConfirmDialog
                destructive
                title="Cancel this order?"
                description={`Order ${order.order_no} will be marked cancelled and the ${formatNumber(unitCount, "en")} reserved pieces go back to stock.`}
                confirmLabel="Cancel order"
                trigger={
                  <Button variant="outline" size="sm" className="w-full">
                    <Ban
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="size-4"
                    />
                    Cancel order
                  </Button>
                }
                onConfirm={() => {
                  void changeStatus("cancelled", "Cancelled");
                }}
              />
            ) : null}
            {canReturn ? (
              <ConfirmDialog
                destructive
                title="Mark this order as returned?"
                description={`The ${formatNumber(unitCount, "en")} pieces on order ${order.order_no} go back into stock.`}
                confirmLabel="Mark returned"
                trigger={
                  <Button variant="outline" size="sm" className="w-full">
                    <Undo2
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="size-4"
                    />
                    Returned
                  </Button>
                }
                onConfirm={() => {
                  void changeStatus("returned", "Returned");
                }}
              />
            ) : null}
          </SectionCard>

          {isBulk ? (
            <SectionCard
              title="Production"
              action={
                productionStatus ? (
                  <StatusBadge domain="production" value={productionStatus} />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Not started
                  </span>
                )
              }
            >
              {order.source_quote_id ? (
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link
                    href={`/admin/print/quotes/${order.source_quote_id}/spec`}
                  >
                    <ClipboardList
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="size-4"
                    />
                    Production spec sheet
                  </Link>
                </Button>
              ) : (
                <p className="rounded-control bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
                  No linked quote — this bulk order has no production spec
                  sheet.
                </p>
              )}
              <ol
                className="space-y-1.5"
                aria-label="Production pipeline"
              >
                {productionMoves.map((value) => (
                  <li key={value}>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start"
                      disabled={saving}
                      onClick={() => void changeProduction(value)}
                    >
                      {productionStatus ? "Move to " : "Start: "}
                      {PRODUCTION_STATUS_META[value]?.label ?? value}
                    </Button>
                  </li>
                ))}
              </ol>
              <div className="space-y-1.5 pt-1">
                <Label htmlFor="production-note">
                  Note for the audit trail{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="production-note"
                  name="production_note"
                  rows={2}
                  maxLength={1000}
                  placeholder="Artwork approved by the customer on WhatsApp…"
                  value={prodNote}
                  onChange={(event) => setProdNote(event.target.value)}
                />
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Customer and delivery">
            <dl className="space-y-2">
              <DetailRow label="Name">{order.customer_name}</DetailRow>
              <DetailRow label="Phone">
                <a
                  className="text-gold-text underline-offset-4 hover:underline"
                  href={`tel:${phoneDigits}`}
                >
                  {order.customer_phone}
                </a>
              </DetailRow>
              <DetailRow label="Email">{order.customer_email ?? "—"}</DetailRow>
              <DetailRow label="Address">
                {[
                  order.address_line,
                  order.area,
                  order.district,
                  order.division,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </DetailRow>
              <DetailRow label="Zone">{order.zone_name ?? "—"}</DetailRow>
              <DetailRow label="Payment">
                <StatusBadge domain="payment" value={order.payment_status} />
              </DetailRow>
              <DetailRow label="Method">
                {PAYMENT_METHOD_LABELS[order.payment_method as PaymentMethod] ??
                  order.payment_method}
              </DetailRow>
              {order.customer_note ? (
                <DetailRow label="Customer note">
                  {order.customer_note}
                </DetailRow>
              ) : null}
            </dl>
            {/* Plan 15.2 B4 — abuse protection escape hatch. Blocked phones
                get the generic error at checkout and quote; the entry is a
                normalized phone in blocked_contacts. */}
            <div className="border-t border-border pt-3">
              <ConfirmDialog
                destructive
                title="Block this phone?"
                description={`${order.customer_phone} will no longer be able to place orders or submit quotes. Remove the entry from blocked_contacts to unblock.`}
                confirmLabel="Block phone"
                trigger={
                  <Button variant="outline" size="sm" className="w-full">
                    <Ban
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="size-4"
                    />
                    Block this phone
                  </Button>
                }
                onConfirm={() => {
                  void run(
                    () => blockOrderPhone({ id: order.id }),
                    "Phone blocked.",
                  );
                }}
              />
            </div>
          </SectionCard>

          <SectionCard title="Courier and tracking">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  () =>
                    saveShippingDetails({
                      id: order.id,
                      courier_name: courier,
                      tracking_code: tracking,
                    }),
                  "Courier details saved.",
                );
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="courier-name">Courier</Label>
                <Input
                  id="courier-name"
                  name="courier_name"
                  autoComplete="off"
                  maxLength={80}
                  placeholder="Stafecourier, Pathao…"
                  value={courier}
                  onChange={(event) => setCourier(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tracking-code">Tracking code</Label>
                <Input
                  id="tracking-code"
                  name="tracking_code"
                  autoComplete="off"
                  maxLength={80}
                  value={tracking}
                  onChange={(event) => setTracking(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={
                  saving ||
                  (courier === (order.courier_name ?? "") &&
                    tracking === (order.tracking_code ?? ""))
                }
              >
                Save courier details
              </Button>
            </form>
            <dl className="space-y-2 border-t border-border pt-3">
              <DetailRow label="Shipped">
                {order.shipped_at
                  ? formatDate(new Date(order.shipped_at), "en")
                  : "—"}
              </DetailRow>
              <DetailRow label="Delivered">
                {order.delivered_at
                  ? formatDate(new Date(order.delivered_at), "en")
                  : "—"}
              </DetailRow>
            </dl>
          </SectionCard>

          <SectionCard title="Internal note">
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                run(
                  () => saveOrderNote({ id: order.id, admin_note: adminNote }),
                  "Note saved.",
                );
              }}
            >
              <Label htmlFor="admin-note" className="sr-only">
                Internal note
              </Label>
              <Textarea
                id="admin-note"
                name="admin_note"
                rows={4}
                maxLength={4000}
                placeholder="Only staff can see this."
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={saving || adminNote === (order.admin_note ?? "")}
              >
                Save note
              </Button>
            </form>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
