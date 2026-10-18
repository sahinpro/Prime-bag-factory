import "server-only";

import { paidTotal, round2 } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Order reads (plan Phase 5 task 2). RLS gives anonymous visitors no access to
 * `orders` at all — customers create orders through the `place_order` RPC and
 * read them back only through this helper, which matches BOTH the order number
 * and the phone it was placed with, then hands back a customer-safe projection
 * (no admin notes, no internal flags). The service-role key stays on the server.
 */

export type PublicOrderLine = {
  title: string;
  sku: string | null;
  color: string | null;
  size: string | null;
  qty: number;
  unitPrice: number;
  lineTotal: number;
};

export type PublicOrder = {
  orderNo: string;
  placedAt: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  customerName: string;
  customerPhone: string;
  division: string | null;
  district: string | null;
  area: string | null;
  addressLine: string | null;
  subtotal: number;
  shippingFee: number;
  discount: number;
  vatAmount: number;
  total: number;
  /** Sum of the payments ledger so far (0 until staff record the advance). */
  paid: number;
  courierName: string | null;
  trackingCode: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: PublicOrderLine[];
};

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

/**
 * Returns the order when `orderNo` was placed with `phone`, else null. Callers
 * must treat null as "not found" without revealing which half was wrong.
 */
export async function findOrderForLookup(
  orderNo: string,
  phone: string,
): Promise<PublicOrder | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select(
      "id, order_no, created_at, status, payment_status, payment_method, customer_name, customer_phone, division, district, area, address_line, subtotal, shipping_fee, discount, vat_amount, total, courier_name, tracking_code, shipped_at, delivered_at, order_items ( title_snapshot, sku_snapshot, color_snapshot, size_snapshot, unit_price, qty, line_total )",
    )
    .eq("order_no", orderNo)
    .eq("customer_phone", phone)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  const rawItems = Array.isArray(row.order_items)
    ? (row.order_items as Record<string, unknown>[])
    : [];

  const items: PublicOrderLine[] = rawItems.map((item) => ({
    title: String(item.title_snapshot ?? ""),
    sku: text(item.sku_snapshot),
    color: text(item.color_snapshot),
    size: text(item.size_snapshot),
    qty: num(item.qty),
    unitPrice: num(item.unit_price),
    lineTotal: num(item.line_total),
  }));

  // Payments ledger: the advance is recorded by staff (plan §14), so a fresh
  // order legitimately shows 0 paid and a 50% advance still due.
  const { data: paymentRows } = await admin
    .from("payments")
    .select("amount")
    .eq("order_id", String(row.id));
  const paid = paidTotal(
    ((paymentRows ?? []) as Record<string, unknown>[]).map((p) =>
      num(p.amount),
    ),
  );

  return {
    orderNo: String(row.order_no),
    placedAt: String(row.created_at),
    status: String(row.status ?? "pending"),
    paymentStatus: String(row.payment_status ?? "unpaid"),
    paymentMethod: String(row.payment_method ?? "cod"),
    customerName: String(row.customer_name ?? ""),
    customerPhone: String(row.customer_phone ?? ""),
    division: text(row.division),
    district: text(row.district),
    area: text(row.area),
    addressLine: text(row.address_line),
    subtotal: round2(num(row.subtotal)),
    shippingFee: round2(num(row.shipping_fee)),
    discount: round2(num(row.discount)),
    vatAmount: round2(num(row.vat_amount)),
    total: round2(num(row.total)),
    paid,
    courierName: text(row.courier_name),
    trackingCode: text(row.tracking_code),
    shippedAt: row.shipped_at ? String(row.shipped_at) : null,
    deliveredAt: row.delivered_at ? String(row.delivered_at) : null,
    items,
  };
}
