import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Unseen badges: the sidebar Quotes/Orders badges count UNSEEN new quotes /
 * pending orders (`first_viewed_at IS NULL`). This spec seeds one of each on
 * the local stack (the A2 fence guarantees it is never live), proves the
 * badges include them, then opens each detail through a client-side
 * navigation and asserts the badge drops WITHOUT a hard reload — the
 * <MarkSeen /> effect → `mark_seen` RPC → `updateTag(admin_counts)` round
 * trip. A third test shows the unseen dot in the lists and keeps axe green.
 */

function adminDb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Live unseen badge count, computed exactly as server/admin-counts.ts does. */
async function unseenCount(
  db: SupabaseClient,
  table: "quote_requests" | "orders",
  status: string,
): Promise<number> {
  const { count } = await db
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("status", status)
    .is("first_viewed_at", null);
  return count ?? 0;
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

async function seedQuote(db: SupabaseClient) {
  const suffix = String(Math.floor(100000 + Math.random() * 900000));
  const { data, error } = await db
    .from("quote_requests")
    .insert({
      contact_name: "E2E Unseen Buyer",
      company_name: `E2E Unseen ${suffix}`,
      phone: `017${suffix}00`,
      status: "new",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  if (!data) throw new Error("quote seed failed");
  return { quoteId: data.id, company: `E2E Unseen ${suffix}` };
}

async function seedOrder(db: SupabaseClient) {
  const suffix = String(Math.floor(100000 + Math.random() * 900000));
  const { data, error } = await db
    .from("orders")
    .insert({
      order_no: `PBF-E2E-UNSEEN-${suffix}`,
      status: "pending",
      customer_name: "E2E Unseen Customer",
      customer_phone: `018${suffix}00`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  if (!data) throw new Error("order seed failed");
  return { orderId: data.id, orderNo: `PBF-E2E-UNSEEN-${suffix}` };
}

async function gotoAdmin(page: Page): Promise<boolean> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin");
  if (page.url().includes("/admin/login")) return false;
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard" }),
  ).toBeVisible();
  return true;
}

/**
 * A direct service-role seed bypasses the app's `revalidateTag`, so the
 * `"use cache"` badges entry can serve up to its 30s revalidate window. Settle
 * it with fresh navigations (each render re-reads the count) until the badge
 * equals the live DB number — worst case ~2 windows.
 */
async function settleBadge(
  page: Page,
  label: string,
  expected: number | null,
): Promise<void> {
  await expect
    .poll(
      async () => {
        await page.goto("/admin");
        await expect(
          page.getByRole("heading", { level: 1, name: "Dashboard" }),
        ).toBeVisible();
        return badgeValue(page, label);
      },
      { timeout: 90_000 },
    )
    .toBe(expected);
}

test("opening a new quote marks it seen and drops the badge (no reload)", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const db = adminDb();
  const { quoteId, company } = await seedQuote(db);
  try {
    const before = await unseenCount(db, "quote_requests", "new");
    const authenticated = await gotoAdmin(page);
    test.skip(
      !authenticated,
      "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
    );
    // The seeded quote raised the badge — it is part of the live count.
    expect(before).toBeGreaterThan(0);
    await settleBadge(page, "Quotes", before);

    // Client-side navigation: list → Open → detail (no page.goto).
    await page.getByRole("link", { name: "Quotes", exact: true }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Quotes" }),
    ).toBeVisible();
    await page
      .getByRole("link", { name: `Open : ${company}` })
      .first()
      .click();
    await page.waitForURL(`/admin/quotes/${quoteId}`);

    // The <MarkSeen /> effect fires the RPC; updateTag refreshes the sidebar
    // on this very page — poll until the badge is back to the pre-seed count.
    await expect
      .poll(() => badgeValue(page, "Quotes"), { timeout: 20_000 })
      .toBe(before - 1 > 0 ? before - 1 : null);

    const { data: row } = await db
      .from("quote_requests")
      .select("first_viewed_at, status")
      .eq("id", quoteId)
      .single();
    expect(row?.first_viewed_at).not.toBeNull();
    expect(row?.status).toBe("new"); // status workflow untouched
  } finally {
    await db.from("quote_requests").delete().eq("id", quoteId);
  }
});

test("opening a pending order marks it seen and drops the badge (no reload)", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const db = adminDb();
  const { orderId, orderNo } = await seedOrder(db);
  try {
    const before = await unseenCount(db, "orders", "pending");
    const authenticated = await gotoAdmin(page);
    test.skip(
      !authenticated,
      "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
    );
    await settleBadge(page, "Orders", before > 0 ? before : null);

    await page
      .getByRole("link", { name: /Orders/ })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Orders" }),
    ).toBeVisible();
    await page.getByRole("link", { name: `Open : order ${orderNo}` }).click();
    await page.waitForURL(`/admin/orders/${orderId}`);

    // Seed carries no pending orders, so opening mine clears the badge.
    await expect
      .poll(() => badgeValue(page, "Orders"), { timeout: 20_000 })
      .toBe(before - 1 > 0 ? before - 1 : null);

    const { data: row } = await db
      .from("orders")
      .select("first_viewed_at, status")
      .eq("id", orderId)
      .single();
    expect(row?.first_viewed_at).not.toBeNull();
    expect(row?.status).toBe("pending");
  } finally {
    await db.from("orders").delete().eq("id", orderId);
  }
});

test("unseen rows show the indicator and the lists stay accessible", async ({
  page,
}) => {
  const db = adminDb();
  const { quoteId, company } = await seedQuote(db);
  try {
    const authenticated = await gotoAdmin(page);
    test.skip(
      !authenticated,
      "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
    );
    await page.getByRole("link", { name: "Quotes", exact: true }).click();
    const row = page.getByRole("row").filter({ hasText: company });
    await expect(row.getByText("Unseen", { exact: true })).toBeVisible(); // sr-only, still "visible"
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  } finally {
    await db.from("quote_requests").delete().eq("id", quoteId);
  }
});
