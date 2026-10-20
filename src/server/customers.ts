import "server-only";

import { createClient } from "@/lib/supabase/server";
import { normalizePhone } from "@/server/abuse";

/**
 * Plan §9 "Customers" — the directory is *derived*, not a table: every
 * customer is a phone number that appears in `orders` or `quote_requests`,
 * grouped by the canonical form (`normalizePhone()` from the abuse module,
 * so +880 / spaces / Bangla digits all collapse onto one row). No migration,
 * no sync job — the list is computed from the two sources of truth at read
 * time on the staff cookie client, so Phase 1 RLS decides visibility exactly
 * as it does on the orders and quotes pages (sales included).
 *
 * Same "load the rows, let the client sort/page" shape as `listAdminOrders`:
 * at factory scale (hundreds of rows) one pass is honest and keeps the
 * grouping in one place. Both histories ride along on the row because the
 * drawer needs them and the data is already here — no second fetch.
 */

export type CustomerOrderRef = {
  id: string;
  order_no: string;
  created_at: string;
  status: string;
  payment_status: string;
  total: number;
};

export type CustomerQuoteRef = {
  id: string;
  created_at: string;
  status: string;
  source: string;
  quantity: number | null;
  quoted_amount: number | null;
};

export type CustomerRow = {
  /** Canonical phone key — also the stable row id for the DataTable. */
  phone: string;
  /** Name from the customer's most recent order or quote. */
  name: string;
  /** Most recent non-empty email across both sources. */
  email: string | null;
  orders_count: number;
  quotes_count: number;
  /**
   * Sum of order totals EXCLUDING cancelled orders — money that never ships
   * is not lifetime value (decision logged in plan §14).
   */
  lifetime_value: number;
  /** Max created_at across both sources. */
  last_activity: string;
  /** Most recent order number, null for quote-only customers. */
  last_order_no: string | null;
  orders: CustomerOrderRef[];
  quotes: CustomerQuoteRef[];
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Newest-first directory. Returns null when either source read fails so the
 * page can show the kit error state (plan 9c.1.4) — a half-populated
 * directory would silently misreport lifetime value, so all-or-nothing wins.
 */
export async function listCustomers(): Promise<CustomerRow[] | null> {
  const supabase = await createClient();

  const [ordersRes, quotesRes] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_no, created_at, status, payment_status, total, customer_name, customer_phone, customer_email",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("quote_requests")
      .select(
        "id, created_at, status, source, quantity, quoted_amount, contact_name, phone, email",
      )
      .order("created_at", { ascending: false }),
  ]);

  if (ordersRes.error || quotesRes.error) return null;

  type Bucket = {
    name: string;
    email: string | null;
    lastActivity: string;
    lastOrderAt: string | null;
    lastOrderNo: string | null;
    orders: CustomerOrderRef[];
    quotes: CustomerQuoteRef[];
  };
  const byPhone = new Map<string, Bucket>();

  const bucketFor = (rawPhone: string): Bucket => {
    const key = normalizePhone(rawPhone) || rawPhone.trim();
    let bucket = byPhone.get(key);
    if (!bucket) {
      bucket = {
        name: "",
        email: null,
        lastActivity: "",
        lastOrderAt: null,
        lastOrderNo: null,
        orders: [],
        quotes: [],
      };
      byPhone.set(key, bucket);
    }
    return bucket;
  };

  for (const raw of ordersRes.data ?? []) {
    const row = raw as unknown as Record<string, unknown>;
    const bucket = bucketFor(String(row.customer_phone ?? ""));
    const createdAt = String(row.created_at ?? "");
    // Orders came back newest-first, so the first non-empty name/email and
    // the first order seen per bucket are the most recent ones.
    if (!bucket.name) bucket.name = String(row.customer_name ?? "");
    if (!bucket.email && row.customer_email) {
      bucket.email = String(row.customer_email);
    }
    if (createdAt > bucket.lastActivity) bucket.lastActivity = createdAt;
    if (!bucket.lastOrderAt) {
      bucket.lastOrderAt = createdAt;
      bucket.lastOrderNo = String(row.order_no ?? "");
    }
    bucket.orders.push({
      id: String(row.id),
      order_no: String(row.order_no ?? ""),
      created_at: createdAt,
      status: String(row.status ?? ""),
      payment_status: String(row.payment_status ?? ""),
      total: num(row.total),
    });
  }

  for (const raw of quotesRes.data ?? []) {
    const row = raw as unknown as Record<string, unknown>;
    const bucket = bucketFor(String(row.phone ?? ""));
    const createdAt = String(row.created_at ?? "");
    if (!bucket.name) bucket.name = String(row.contact_name ?? "");
    if (!bucket.email && row.email) bucket.email = String(row.email);
    if (createdAt > bucket.lastActivity) bucket.lastActivity = createdAt;
    bucket.quotes.push({
      id: String(row.id),
      created_at: createdAt,
      status: String(row.status ?? ""),
      source: String(row.source ?? "form"),
      quantity: row.quantity == null ? null : num(row.quantity),
      quoted_amount:
        row.quoted_amount == null ? null : num(row.quoted_amount),
    });
  }

  const rows: CustomerRow[] = [];
  for (const [phone, bucket] of byPhone) {
    rows.push({
      phone,
      name: bucket.name || phone,
      email: bucket.email,
      orders_count: bucket.orders.length,
      quotes_count: bucket.quotes.length,
      lifetime_value: Math.round(
        bucket.orders
          .filter((o) => o.status !== "cancelled")
          .reduce((sum, o) => sum + o.total, 0) *
          100,
      ) / 100,
      last_activity: bucket.lastActivity,
      last_order_no: bucket.lastOrderNo,
      orders: bucket.orders,
      quotes: bucket.quotes,
    });
  }

  // Newest activity first — the customer a salesperson most likely needs.
  rows.sort((a, b) => b.last_activity.localeCompare(a.last_activity));
  return rows;
}
