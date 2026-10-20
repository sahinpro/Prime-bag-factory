"use client";

import {
  AlertTriangle,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { createAdminOrder } from "@/app/(admin)/admin/orders/actions";
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
import { computeAdminOrderTotals, type AdminOrderLineInput } from "@/lib/admin-order-totals";
import { formatMoney, formatNumber } from "@/lib/format";
import {
  ADMIN_INITIAL_STATUSES,
  ORDER_CHANNEL_LABELS,
  ORDER_CHANNELS,
  adminCreateOrderSchema,
  type AdminInitialStatus,
  type OrderChannel,
} from "@/lib/validators/admin-order";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/lib/validators/order-admin";
import type { OrderableVariant } from "@/server/admin-orders";
import type { ShippingZone } from "@/server/checkout";

/**
 * Admin-created-order form (plan 15.2 E3): phone / WhatsApp / walk-in orders
 * keyed by staff. Reuses the admin kit only (PageHeader, Card, FormSection-ish
 * blocks, DataTable-free editable lines, StickySave-style submit), English only
 * (no next-intl in admin). Prices/MOQ/stock are shown live from
 * `lib/admin-order-totals` but the `admin_create_order` RPC re-prices every line
 * in Postgres — this is a preview, never the authority (AGENTS: don't trust
 * client totals). Discount and per-line price override render only for
 * owner/manager; `sales` sees neither, mirroring the RPC's role check.
 */

const ADVANCE_METHODS = PAYMENT_METHODS.filter((m) => m !== "cod");

type Line = {
  lineId: string;
  variantId: string;
  qty: string;
  override: string;
};

let lineSeq = 0;
const nextLineId = () => `line-${Date.now()}-${lineSeq++}`;

function Money({ value }: Readonly<{ value: number }>) {
  return <span className="tabular-nums">{formatMoney(value, "en")}</span>;
}

function FieldError({ children }: Readonly<{ children?: React.ReactNode }>) {
  if (!children) return null;
  return <p className="text-xs text-destructive">{children}</p>;
}

export function NewOrderForm({
  variants,
  zones,
  canOverride,
}: Readonly<{
  variants: OrderableVariant[];
  zones: ShippingZone[];
  canOverride: boolean;
}>) {
  const router = useRouter();
  const { flash, setFlash } = useActionSave();
  const [saving, setSaving] = React.useState(false);

  // One idempotency key per form session: a double click replays instead of
  // making a second order (same rule the public checkout uses).
  const [idempotencyKey] = React.useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const [customerName, setCustomerName] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [division, setDivision] = React.useState("");
  const [district, setDistrict] = React.useState("");
  const [area, setArea] = React.useState("");
  const [addressLine, setAddressLine] = React.useState("");

  const [zoneId, setZoneId] = React.useState<string>(zones[0]?.id ?? "");
  const [channel, setChannel] = React.useState<OrderChannel>("phone");
  const [status, setStatus] = React.useState<AdminInitialStatus>("confirmed");
  const [customerNote, setCustomerNote] = React.useState("");
  const [adminNote, setAdminNote] = React.useState("");

  const [discount, setDiscount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [overrideReason, setOverrideReason] = React.useState("");
  const [advanceAmount, setAdvanceAmount] = React.useState("");
  const [advanceMethod, setAdvanceMethod] =
    React.useState<PaymentMethod>("cash");
  const [advanceReference, setAdvanceReference] = React.useState("");

  const [search, setSearch] = React.useState("");
  const [lines, setLines] = React.useState<Line[]>([]);

  const variantById = React.useMemo(() => {
    const map = new Map<string, OrderableVariant>();
    for (const v of variants) map.set(v.variantId, v);
    return map;
  }, [variants]);

  const results = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return variants
      .filter((v) =>
        [v.productTitle, v.sku, v.colorName ?? "", v.size ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 20);
  }, [search, variants]);

  function addVariant(v: OrderableVariant) {
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === v.variantId);
      if (existing) {
        return prev.map((l) =>
          l.variantId === v.variantId
            ? { ...l, qty: String((Number(l.qty) || 0) + v.moq) }
            : l,
        );
      }
      return [
        ...prev,
        { lineId: nextLineId(), variantId: v.variantId, qty: String(v.moq || 1), override: "" },
      ];
    });
    setSearch("");
  }

  function updateLine(lineId: string, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, ...patch } : l)),
    );
  }

  function removeLine(lineId: string) {
    setLines((prev) => prev.filter((l) => l.lineId !== lineId));
  }

  const pricedInputs: AdminOrderLineInput[] = React.useMemo(
    () =>
      lines.flatMap((l) => {
        const v = variantById.get(l.variantId);
        if (!v) return [];
        const overrideVal =
          canOverride && l.override.trim() !== "" ? Number(l.override) : null;
        return [
          {
            productId: v.productId,
            variantId: v.variantId,
            qty: Number(l.qty) || 0,
            priceDelta: v.priceDelta,
            tiers: v.tiers,
            unitPriceOverride:
              overrideVal != null && Number.isFinite(overrideVal)
                ? overrideVal
                : null,
          },
        ];
      }),
    [lines, variantById, canOverride],
  );

  const zone = zones.find((z) => z.id === zoneId) ?? null;
  const totals = React.useMemo(
    () =>
      computeAdminOrderTotals({
        lines: pricedInputs,
        zone,
        discount: Number(discount) || 0,
      }),
    [pricedInputs, zone, discount],
  );

  const perLine = new Map(
    totals.lines.map((pl, i) => [pricedInputs[i].variantId, pl]),
  );

  const hasOverride = canOverride && lines.some((l) => l.override.trim() !== "");
  const discountNum = Number(discount) || 0;

  function lineWarning(variantId: string, qty: number): string | null {
    const v = variantById.get(variantId);
    if (!v) return null;
    if (v.moq > 0 && qty < v.moq)
      return `Below MOQ of ${formatNumber(v.moq, "en")}.`;
    if (v.stockMode === "tracked" && v.available != null && qty > v.available)
      return `Only ${formatNumber(v.available, "en")} in stock.`;
    if (v.tiers.length === 0) return "No price tier set for this product.";
    const priced = perLine.get(variantId);
    if (priced?.unitPrice == null) return "No price tier covers this quantity.";
    return null;
  }

  const canSubmit =
    !saving &&
    lines.length > 0 &&
    customerName.trim() !== "" &&
    customerPhone.trim() !== "" &&
    zoneId !== "" &&
    discountNum <= totals.subtotal;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload = {
      items: lines.map((l) => ({
        variant_id: l.variantId,
        qty: Number(l.qty) || 0,
        unit_price_override:
          canOverride && l.override.trim() !== "" ? Number(l.override) : "",
      })),
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      division,
      district,
      area,
      address_line: addressLine,
      shipping_zone_id: zoneId,
      channel,
      status,
      admin_note: adminNote,
      customer_note: customerNote,
      discount: discount || "0",
      reason,
      override_reason: overrideReason,
      advance_amount: advanceAmount || "0",
      advance_method: advanceMethod,
      advance_reference: advanceReference,
      idempotency_key: idempotencyKey,
    };

    // Client zod first (instant feedback), then the server action repeats it
    // and the RPC re-prices — three checks, one source of truth in the DB.
    const parsed = adminCreateOrderSchema.safeParse(payload);
    if (!parsed.success) {
      setFlash({
        kind: "error",
        text: parsed.error.issues[0]?.message ?? "Check the highlighted fields.",
      });
      return;
    }

    setSaving(true);
    const result = await createAdminOrder(payload);
    setSaving(false);
    if (!result.ok) {
      setFlash({ kind: "error", text: result.error });
      return;
    }
    // A walk-in for a blocklisted phone still saves, but staff must see why it
    // is unusual — surface the warning as a success flash with the caveat.
    setFlash({
      kind: "success",
      text: result.warning ?? "Order created.",
    });
    router.push(`/admin/orders/${result.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <PageHeader
        title="New order"
        description="Record a phone, WhatsApp or walk-in order. Prices, MOQ and stock are recalculated in the database."
        actions={
          <Button variant="outline" size="sm" onClick={() => router.push("/admin/orders")} type="button">
            Cancel
          </Button>
        }
      />

      <FlashLine flash={flash} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-medium text-foreground">
                Customer
              </h2>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="customer-name">Name</Label>
                <Input
                  id="customer-name"
                  name="customer_name"
                  autoComplete="off"
                  maxLength={120}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-phone">Phone</Label>
                <Input
                  id="customer-phone"
                  name="customer_phone"
                  inputMode="tel"
                  autoComplete="off"
                  maxLength={20}
                  placeholder="01XXXXXXXXX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Bangla digits are accepted and normalised.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-email">
                  Email <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="customer-email"
                  name="customer_email"
                  type="email"
                  autoComplete="off"
                  maxLength={160}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address-line">
                  Address{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="address-line"
                  name="address_line"
                  autoComplete="off"
                  maxLength={300}
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="division">
                  Division{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="division"
                  name="division"
                  autoComplete="off"
                  maxLength={80}
                  value={division}
                  onChange={(e) => setDivision(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="district">
                  District{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="district"
                  name="district"
                  autoComplete="off"
                  maxLength={80}
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="area">
                  Area <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="area"
                  name="area"
                  autoComplete="off"
                  maxLength={80}
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-foreground">Items</h2>
              <span className="text-xs text-muted-foreground">
                {formatNumber(
                  lines.reduce((s, l) => s + (Number(l.qty) || 0), 0),
                  "en",
                )}{" "}
                pcs
              </span>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="variant-search" className="flex items-center gap-2">
                  <Search aria-hidden="true" strokeWidth={1.75} className="size-4" />
                  Add a product
                </Label>
                <Input
                  id="variant-search"
                  autoComplete="off"
                  placeholder="Search by product, SKU, colour or size…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  disabled={variants.length === 0}
                />
                {results.length > 0 ? (
                  <ul className="divide-y divide-border overflow-hidden rounded-control border border-border">
                    {results.map((v) => (
                      <li key={v.variantId}>
                        <button
                          type="button"
                          onClick={() => addVariant(v)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-surface-2"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{v.productTitle}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {[v.sku, v.colorName, v.size]
                                .filter(Boolean)
                                .join(" · ")}
                              {v.stockMode === "tracked"
                                ? ` · ${formatNumber(v.available ?? 0, "en")} in stock`
                                : " · made to order"}
                              {v.moq > 0 ? ` · MOQ ${formatNumber(v.moq, "en")}` : ""}
                            </span>
                          </span>
                          <Plus
                            aria-hidden="true"
                            strokeWidth={1.75}
                            className="size-4 shrink-0 text-muted-foreground"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : search.trim() && variants.length > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No matching buy-now product.
                  </p>
                ) : null}
              </div>

              {variants.length === 0 ? (
                <p className="rounded-control bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
                  There are no published buy-now products to add yet.
                </p>
              ) : lines.length === 0 ? (
                <p className="rounded-control bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
                  No items yet. Search above to add products.
                </p>
              ) : (
                <ul className="space-y-3">
                  {lines.map((l) => {
                    const v = variantById.get(l.variantId);
                    if (!v) return null;
                    const priced = perLine.get(v.variantId);
                    const warning = lineWarning(v.variantId, Number(l.qty) || 0);
                    return (
                      <li
                        key={l.lineId}
                        className="rounded-control border border-border p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {v.productTitle}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[v.sku, v.colorName, v.size]
                                .filter(Boolean)
                                .join(" · ") || "No variant code"}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Remove ${v.productTitle}`}
                            onClick={() => removeLine(l.lineId)}
                          >
                            <Trash2
                              aria-hidden="true"
                              strokeWidth={1.75}
                              className="size-4"
                            />
                          </Button>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <Label htmlFor={`qty-${l.lineId}`} className="text-xs">
                              Qty
                            </Label>
                            <Input
                              id={`qty-${l.lineId}`}
                              type="number"
                              min="1"
                              step="1"
                              inputMode="numeric"
                              className="h-9"
                              value={l.qty}
                              onChange={(e) =>
                                updateLine(l.lineId, { qty: e.target.value })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Unit price</Label>
                            <p className="flex h-9 items-center rounded-control bg-surface-2 px-3 text-sm">
                              {priced?.unitPrice == null ? (
                                <span className="text-muted-foreground">—</span>
                              ) : (
                                <Money value={priced.unitPrice} />
                              )}
                              {priced?.overridden ? (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  (overridden)
                                </span>
                              ) : null}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Line total</Label>
                            <p className="flex h-9 items-center text-sm">
                              <Money value={priced?.lineTotal ?? 0} />
                            </p>
                          </div>
                        </div>
                        {canOverride ? (
                          <div className="mt-3 space-y-1">
                            <Label
                              htmlFor={`override-${l.lineId}`}
                              className="text-xs"
                            >
                              Override unit price{" "}
                              <span className="text-muted-foreground">
                                (optional)
                              </span>
                            </Label>
                            <Input
                              id={`override-${l.lineId}`}
                              type="number"
                              min="0"
                              step="0.01"
                              inputMode="decimal"
                              className="h-9"
                              placeholder={
                                priced?.tierUnitPrice != null
                                  ? String(priced.tierUnitPrice)
                                  : "0.00"
                              }
                              value={l.override}
                              onChange={(e) =>
                                updateLine(l.lineId, { override: e.target.value })
                              }
                            />
                          </div>
                        ) : null}
                        {warning ? (
                          <p className="mt-2 flex items-center gap-1.5 text-xs text-warning">
                            <AlertTriangle
                              aria-hidden="true"
                              strokeWidth={1.75}
                              className="size-3.5"
                            />
                            {warning}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-medium text-foreground">
                Pricing and payment
              </h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {canOverride ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="discount">
                      Discount (BDT){" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="discount"
                      name="discount"
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reason">
                      Discount reason{" "}
                      <span className="text-muted-foreground">
                        {discountNum > 0 ? "(required)" : "(optional)"}
                      </span>
                    </Label>
                    <Input
                      id="reason"
                      name="reason"
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <p className="rounded-control bg-surface-2 px-3 py-2 text-sm text-muted-foreground">
                  Discounts and price overrides are for owners and managers.
                </p>
              )}

              {canOverride && hasOverride ? (
                <div className="space-y-1.5">
                  <Label htmlFor="override-reason">
                    Override reason <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="override-reason"
                    name="override_reason"
                    maxLength={500}
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                  />
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="advance-amount">
                    Advance (BDT){" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="advance-amount"
                    name="advance_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={advanceAmount}
                    onChange={(e) => setAdvanceAmount(e.target.value)}
                  />
                  <FieldError>
                    {Number(advanceAmount) > totals.total && totals.total > 0
                      ? "More than the order total."
                      : undefined}
                  </FieldError>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="advance-method">Method</Label>
                  <Select
                    value={advanceMethod}
                    onValueChange={(v) => setAdvanceMethod(v as PaymentMethod)}
                  >
                    <SelectTrigger id="advance-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ADVANCE_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {PAYMENT_METHOD_LABELS[m]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="advance-reference">
                    Reference{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="advance-reference"
                    name="advance_reference"
                    maxLength={120}
                    value={advanceReference}
                    onChange={(e) => setAdvanceReference(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-medium text-foreground">Notes</h2>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="customer-note">
                  Customer note{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="customer-note"
                  name="customer_note"
                  rows={3}
                  maxLength={1000}
                  value={customerNote}
                  onChange={(e) => setCustomerNote(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="admin-note">
                  Internal note{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="admin-note"
                  name="admin_note"
                  rows={3}
                  maxLength={4000}
                  placeholder="Only staff can see this."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-sm font-medium text-foreground">Details</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="channel">Order came in via</Label>
                <Select
                  value={channel}
                  onValueChange={(v) => setChannel(v as OrderChannel)}
                >
                  <SelectTrigger id="channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_CHANNELS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {ORDER_CHANNEL_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status">Starting status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => setStatus(v as AdminInitialStatus)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADMIN_INITIAL_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === "pending" ? "Pending" : "Confirmed"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zone">Shipping zone</Label>
                <Select value={zoneId} onValueChange={setZoneId}>
                  <SelectTrigger id="zone">
                    <SelectValue placeholder="Choose a zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((z) => (
                      <SelectItem key={z.id} value={z.id}>
                        {z.nameEn} · <Money value={z.fee} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {zones.length === 0 ? (
                  <p className="text-xs text-destructive">
                    No active shipping zone — add one in Settings first.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-medium text-foreground">Summary</h2>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <Money value={totals.subtotal} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <Money value={totals.shippingFee} />
              </div>
              {totals.discount > 0 ? (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="tabular-nums">
                    <Money value={-totals.discount} />
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between border-t border-border pt-2 font-semibold">
                <span>Total</span>
                <Money value={totals.total} />
              </div>
              <p className="text-xs text-muted-foreground">
                Recalculated in the database on save — this preview may differ
                if a price, MOQ or stock changed since it loaded.
              </p>

              <Button
                type="submit"
                className="mt-2 w-full"
                disabled={!canSubmit}
              >
                <ShoppingCart
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                {saving ? "Creating…" : "Create order"}
              </Button>
              {!canSubmit && lines.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground">
                  Add at least one item to create the order.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
