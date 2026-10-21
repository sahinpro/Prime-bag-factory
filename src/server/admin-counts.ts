import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { CACHE_TAGS } from "@/lib/cache-tags";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sidebar count badges (plan 15.2 C3): the three live counts the admin shell
 * shows on Quotes / Orders / Inventory. Cached briefly and invalidated by every
 * writer (tag `admin_counts`), never by session.
 *
 * It reads through the **service-role** client, not the cookie session, for two
 * reasons: a `"use cache"` function may not touch request cookies, and the value
 * is safe to share — the RLS grants on `orders`, `quote_requests` and
 * `product_variants` give every role that actually SEES a badge (sales/manager/
 * owner for quotes+orders, inventory/manager/owner for low stock) the full
 * table, so the service count is exactly what that role would derive from its
 * own session. Money is never returned here — only counts.
 */

export type AdminNavCounts = {
  quotes_new: number;
  orders_pending: number;
  inventory_low: number;
};

export async function getAdminNavCounts(): Promise<AdminNavCounts> {
  "use cache";
  cacheLife("adminCounts");
  cacheTag(CACHE_TAGS.adminCounts);

  const supabase = createAdminClient();

  const [quotes, orders, variants] = await Promise.all([
    supabase
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    // Low stock mirrors the dashboard widget: active variants whose derived
    // available (stock - reserved) sits below the threshold. The count is a
    // plain read; no stock is ever written here.
    supabase
      .from("product_variants")
      .select("stock_qty, reserved_qty, low_stock_threshold")
      .eq("is_active", true),
  ]);

  const lowStock = (variants.data ?? []).reduce(
    (n, v) =>
      (v.stock_qty ?? 0) - (v.reserved_qty ?? 0) < (v.low_stock_threshold ?? 0)
        ? n + 1
        : n,
    0,
  );

  return {
    quotes_new: quotes.count ?? 0,
    orders_pending: orders.count ?? 0,
    inventory_low: lowStock,
  };
}
