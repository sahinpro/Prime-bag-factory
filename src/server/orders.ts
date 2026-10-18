import "server-only";

import { advanceDue, paidTotal, round2 } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/validators/order-admin";

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

/* ------------------------------------------------------------------ *
 * Admin fulfilment reads (Phase 5 task 3, plan 9c.8 "Orders list /
 * Order detail"). These run through the cookie RSC client so the
 * `has_role(['owner','manager','sales','inventory'])` policy on `orders`
 * is the gate — a staff member without that role gets zero rows back.
 * ------------------------------------------------------------------ */

export type AdminOrderRow = {
  id: string;
  order_no: string;
  created_at: string;
  updated_at: string;
  type: string;
  status: OrderStatus;
  payment_status: string;
  payment_method: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  division: string | null;
  district: string | null;
  area: string | null;
  address_line: string | null;
  zone_name: string | null;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  vat_amount: number;
  total: number;
  /** Sum of the payments ledger; balance and advance are derived from it. */
  paid: number;
  balance: number;
  advance_due: number;
  courier_name: string | null;
  tracking_code: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  customer_note: string | null;
  admin_note: string | null;
  source_quote_id: string | null;
};

export type AdminOrderLine = {
  id: string;
  variant_id: string | null;
  title: string;
  sku: string | null;
  color: string | null;
  size: string | null;
  qty: number;
  unit_price: number;
  line_total: number;
};

export type AdminOrderPayment = {
  id: string;
  amount: number;
  method: string;
  reference: string | null;
  note: string | null;
  received_at: string;
  recorded_by: string | null;
};

export type AdminOrderEvent = {
  id: string;
  from_status: string | null;
  to_status: string;
  note: string | null;
  created_at: string;
  changed_by: string | null;
};

export type AdminOrder = AdminOrderRow & {
  lines: AdminOrderLine[];
  payments: AdminOrderPayment[];
  history: AdminOrderEvent[];
};

/** List projection: enough for the table without loading every child row. */
export type AdminOrderListItem = AdminOrderRow & {
  item_count: number;
  unit_count: number;
};

const LIST_SELECT =
  "id, order_no, created_at, updated_at, type, status, payment_status, payment_method, customer_name, customer_phone, total, shipping_zone_id, order_items ( qty ), zone:shipping_zones ( name_en )";

const DETAIL_SELECT =
  "id, order_no, created_at, updated_at, type, status, payment_status, payment_method, customer_name, customer_phone, customer_email, division, district, area, address_line, subtotal, shipping_fee, discount, vat_amount, total, courier_name, tracking_code, shipped_at, delivered_at, customer_note, admin_note, source_quote_id, zone:shipping_zones ( name_en ), order_items ( id, variant_id, title_snapshot, sku_snapshot, color_snapshot, size_snapshot, unit_price, qty, line_total ), payments ( id, amount, method, reference, note, received_at, recorded_by ), order_status_history ( id, from_status, to_status, note, created_at, changed_by )";

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

/** PostgREST to-one embeds arrive as an object or a 1-item array. */
function one(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return Array.isArray(value)
    ? (value[0] ?? null)
    : (value as Record<string, unknown>);
}

/**
 * List projection. Only the fields the table shows are selected, so the other
 * money columns read back as 0 here — the detail page is the full record.
 */
function toListItem(
  row: Record<string, unknown>,
  paid: number,
): AdminOrderListItem {
  const items = rows(row.order_items);
  const total = round2(num(row.total));
  return {
    id: String(row.id),
    order_no: String(row.order_no),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    type: String(row.type ?? "retail"),
    status: String(row.status ?? "pending") as OrderStatus,
    payment_status: String(row.payment_status ?? "unpaid"),
    payment_method: String(row.payment_method ?? "cod"),
    customer_name: String(row.customer_name ?? ""),
    customer_phone: String(row.customer_phone ?? ""),
    customer_email: text(row.customer_email),
    division: text(row.division),
    district: text(row.district),
    area: text(row.area),
    address_line: text(row.address_line),
    zone_name: text(one(row.zone)?.name_en),
    subtotal: round2(num(row.subtotal)),
    shipping_fee: round2(num(row.shipping_fee)),
    discount: round2(num(row.discount)),
    vat_amount: round2(num(row.vat_amount)),
    total,
    paid,
    balance: round2(Math.max(0, total - paid)),
    advance_due: advanceDue(total),
    courier_name: text(row.courier_name),
    tracking_code: text(row.tracking_code),
    shipped_at: row.shipped_at ? String(row.shipped_at) : null,
    delivered_at: row.delivered_at ? String(row.delivered_at) : null,
    customer_note: text(row.customer_note),
    admin_note: text(row.admin_note),
    source_quote_id: text(row.source_quote_id),
    item_count: items.length,
    unit_count: items.reduce((sum, item) => sum + num(item.qty), 0),
  };
}

/** Newest first; the table filters, sorts and pages client-side (as in Quotes). */
export async function listAdminOrders(
  status?: OrderStatus,
): Promise<AdminOrderListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error("Failed to load orders.", { cause: error });

  // One ledger read for the whole list: `paid`/`balance` are derived, never
  // stored (plan §7 Commerce), so the table cannot trust the order row alone.
  const { data: paymentRows, error: paymentError } = await supabase
    .from("payments")
    .select("order_id, amount");
  if (paymentError) throw new Error("Failed to load payments.", { cause: paymentError });

  const paidByOrder = new Map<string, number[]>();
  for (const payment of rows(paymentRows)) {
    const key = String(payment.order_id);
    const bucket = paidByOrder.get(key) ?? [];
    bucket.push(num(payment.amount));
    paidByOrder.set(key, bucket);
  }

  return (data ?? []).map((item) =>
    toListItem(
      item as unknown as Record<string, unknown>,
      paidTotal(paidByOrder.get(String(item.id)) ?? []),
    ),
  );
}

export type OrderStatusCounts = {
  all: number;
} & Record<OrderStatus, number>;

export async function countOrdersByStatus(): Promise<OrderStatusCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").select("status");
  if (error) throw new Error("Failed to count orders.", { cause: error });
  const counts: OrderStatusCounts = {
    all: 0,
    pending: 0,
    confirmed: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    returned: 0,
  };
  for (const row of rows(data)) {
    counts.all += 1;
    const status = String(row.status) as OrderStatus;
    if (status in counts) counts[status] += 1;
  }
  return counts;
}

export async function getAdminOrder(id: string): Promise<AdminOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Failed to load the order.", { cause: error });
  if (!data) return null;

  const row = data as unknown as Record<string, unknown>;
  const base = toListItem(row, paidTotal(rows(row.payments).map((p) => num(p.amount))));

  return {
    ...base,
    lines: rows(row.order_items).map((item) => ({
      id: String(item.id),
      variant_id: text(item.variant_id),
      title: String(item.title_snapshot ?? ""),
      sku: text(item.sku_snapshot),
      color: text(item.color_snapshot),
      size: text(item.size_snapshot),
      qty: num(item.qty),
      unit_price: round2(num(item.unit_price)),
      line_total: round2(num(item.line_total)),
    })),
    payments: rows(row.payments)
      .map((payment) => ({
        id: String(payment.id),
        amount: round2(num(payment.amount)),
        method: String(payment.method ?? "cod"),
        reference: text(payment.reference),
        note: text(payment.note),
        received_at: String(payment.received_at),
        recorded_by: text(payment.recorded_by),
      }))
      .sort((a, b) => b.received_at.localeCompare(a.received_at)),
    history: rows(row.order_status_history).map((event) => ({
      id: String(event.id),
      from_status: text(event.from_status),
      to_status: String(event.to_status ?? ""),
      note: text(event.note),
      created_at: String(event.created_at),
      changed_by: text(event.changed_by),
    })),
  };
}
