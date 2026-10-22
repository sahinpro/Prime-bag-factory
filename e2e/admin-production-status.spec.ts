import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Production status + artwork approval (plan §15.2 F2). Seeds a linked bulk
 * order on the local stack (the A2 fence guarantees it is never live), opens
 * its admin detail, checks the Production region with axe (light + narrow),
 * then drives one pipeline move and proves the RPC stored the status, wrote an
 * audit row and enqueued an admin-bell notification. Cleanup removes the
 * seeded order, quote, notifications and audit rows.
 */

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function seedBulkOrder() {
  const db = adminDb();
  const suffix = String(Math.floor(100000 + Math.random() * 900000));
  const { data: quote, error: quoteError } = await db
    .from("quote_requests")
    .insert({
      source: "builder",
      contact_name: "E2E Production Buyer",
      company_name: `E2E Prod ${suffix}`,
      phone: `017${suffix}00`,
      quantity: 500,
      quoted_amount: 5000,
      status: "won",
    })
    .select("id")
    .single();
  expect(quoteError).toBeNull();
  if (!quote) throw new Error("quote seed failed");

  const orderNo = `PBF-E2E-${suffix}`;
  const { data: order, error: orderError } = await db
    .from("orders")
    .insert({
      order_no: orderNo,
      type: "bulk",
      status: "confirmed",
      customer_name: `E2E Prod ${suffix}`,
      customer_phone: `017${suffix}00`,
      total: 5000,
      subtotal: 5000,
      source_quote_id: quote.id,
    })
    .select("id")
    .single();
  expect(orderError).toBeNull();
  if (!order) throw new Error("order seed failed");

  return { db, orderId: order.id, quoteId: quote.id, orderNo };
}

async function openOrder(page: Page, orderId: string): Promise<boolean> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/admin/orders/${orderId}`);
  if (page.url().includes("/admin/login")) return false;
  return true;
}

test("order detail (production region) is accessible", async ({ page }) => {
  const { db, orderId, orderNo } = await seedBulkOrder();
  try {
    for (const width of [1280, 375]) {
      const authenticated = await openOrder(page, orderId);
      test.skip(
        !authenticated,
        "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
      );
      await page.setViewportSize({ width, height: 900 });
      await expect(
        page.getByRole("heading", { level: 1, name: orderNo }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: "Production" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Start: Awaiting artwork" }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Production spec sheet" }),
      ).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    }
  } finally {
    await cleanup(db, orderId);
  }
});

test("a production move stores the status, writes audit and notifies", async ({
  page,
}) => {
  const { db, orderId } = await seedBulkOrder();
  try {
    const authenticated = await openOrder(page, orderId);
    test.skip(
      !authenticated,
      "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
    );

    await page.getByRole("button", { name: "Start: Awaiting artwork" }).click();
    // The pipeline advances to the next allowed step.
    await expect(
      page.getByRole("button", { name: "Move to Artwork approved" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page
        .getByRole("list", { name: "Production pipeline" })
        .locator('[aria-current="step"]'),
    ).toContainText("Awaiting artwork");

    const { data: order } = await db
      .from("orders")
      .select("production_status")
      .eq("id", orderId)
      .single();
    expect(order?.production_status).toBe("awaiting_artwork");

    const { count: audits } = await db
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "order.production_status")
      .eq("record_id", orderId);
    expect(audits).toBe(1);

    const { count: notes } = await db
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("template", "production_status")
      .contains("payload", { order_id: orderId });
    expect(notes).toBe(1);
  } finally {
    await cleanup(db, orderId);
  }
});

async function cleanup(db: ReturnType<typeof adminDb>, orderId: string) {
  await db
    .from("notifications")
    .delete()
    .in("template", ["new_order", "production_status"])
    .contains("payload", { order_id: orderId });
  await db.from("audit_logs").delete().eq("record_id", orderId);
  const { data: order } = await db
    .from("orders")
    .select("source_quote_id")
    .eq("id", orderId)
    .single();
  await db.from("orders").delete().eq("id", orderId);
  if (order?.source_quote_id) {
    await db.from("quote_requests").delete().eq("id", order.source_quote_id);
  }
}
