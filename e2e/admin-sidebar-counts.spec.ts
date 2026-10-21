import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Sidebar count badges (plan §15.2 C3). The protected layout feeds
 * `getAdminNavCounts()` (a service-role, briefly-cached read) into `AdminShell`,
 * which renders a badge on Quotes / Orders / Inventory when the count is > 0.
 * This spec proves the badges are data-driven: each rendered number must equal
 * the same count recomputed from the local DB (the A2 fence guarantees local).
 * No rows are written — a badge is only asserted for a count that is non-zero,
 * so the spec stays deterministic whatever the seed currently holds.
 */

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Recompute the three counts exactly as `server/admin-counts.ts` does. */
async function expectedCounts() {
  const db = adminDb();
  const [quotes, orders, variants] = await Promise.all([
    db
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new"),
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    db
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
    Quotes: quotes.count ?? 0,
    Orders: orders.count ?? 0,
    Inventory: lowStock,
  };
}

/** Read a nav badge's trailing integer, or null when the badge is absent. */
async function badgeValue(page: Page, label: string): Promise<number | null> {
  const badge = page
    .locator('[data-slot="sidebar-menu-badge"]')
    .filter({ hasText: `${label}: ` });
  if ((await badge.count()) === 0) return null;
  const text = (await badge.first().textContent()) ?? "";
  const m = text.match(/(\d+)\s*$/);
  return m ? Number(m[1]) : null;
}

test("sidebar badges match the live counts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin");
  test.skip(
    page.url().includes("/admin/login"),
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
  );
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard" }),
  ).toBeVisible();

  const expected = await expectedCounts();

  for (const [label, count] of Object.entries(expected)) {
    // The cache revalidates on a 30s ceiling; poll so a pre-warmed entry from an
    // earlier admin spec (which revalidateTag's on write) settles to the truth.
    await expect
      .poll(() => badgeValue(page, label), { timeout: 40_000 })
      .toBe(count > 0 ? count : null);
  }
});
