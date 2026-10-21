import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Quote → bulk order conversion (plan §15.2 F1). Seeds a priced quote on the
 * local stack (the A2 fence guarantees it is never live), opens its admin
 * detail, checks the region with axe (light + narrow), then drives the
 * "Convert to order" confirm dialog and proves the RPC produced a linked bulk
 * order at the exact quoted amount, flipped the quote to Won and wrote one
 * audit row. Cleanup cascades the order and removes the seeded quote.
 */

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function seedQuote() {
  const db = adminDb();
  const suffix = String(Math.floor(100000 + Math.random() * 900000));
  const { data, error } = await db
    .from("quote_requests")
    .insert({
      source: "builder",
      contact_name: "E2E Convert Buyer",
      company_name: `E2E Convert ${suffix}`,
      phone: `017${suffix}00`,
      email: `e2e-${suffix}@example.test`,
      quantity: 250,
      quoted_amount: 1000,
      status: "quoted",
      customization: { size: { width: 12, height: 14 } },
    })
    .select("id, company_name")
    .single();
  expect(error).toBeNull();
  if (!data) throw new Error("quote seed failed");
  return { db, quoteId: data.id, company: data.company_name! };
}

async function openQuote(page: Page, quoteId: string): Promise<boolean> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/admin/quotes/${quoteId}`);
  if (page.url().includes("/admin/login")) return false;
  return true;
}

test("quote detail (convert region) is accessible", async ({ page }) => {
  const { db, quoteId, company } = await seedQuote();
  try {
    for (const width of [1280, 375]) {
      const authenticated = await openQuote(page, quoteId);
      test.skip(
        !authenticated,
        "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
      );
      await page.setViewportSize({ width, height: 900 });
      await expect(
        page.getByRole("heading", { level: 1, name: company }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Convert to order" }),
      ).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    }
  } finally {
    await db.from("quote_requests").delete().eq("id", quoteId);
  }
});

test("converting a priced quote creates a linked bulk order and marks it won", async ({
  page,
}) => {
  const { db, quoteId, company } = await seedQuote();
  let orderId: string | null = null;
  try {
    const authenticated = await openQuote(page, quoteId);
    test.skip(
      !authenticated,
      "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
    );
    await expect(
      page.getByRole("heading", { level: 1, name: company }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Convert to order" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { level: 2, name: /Convert this quote/i }),
    ).toBeVisible();
    // The confirm names the negotiated price (BDT 1,000.00).
    await expect(dialog).toContainText("1,000");

    await dialog.getByRole("button", { name: "Create order" }).click();
    await page.waitForURL(/\/admin\/orders\/[0-9a-f-]{36}/, {
      timeout: 15_000,
    });
    orderId = new URL(page.url()).pathname.split("/").pop()!;

    // The order landed on the detail page.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const { data: order } = await db
      .from("orders")
      .select("type, source, total, subtotal, source_quote_id")
      .eq("id", orderId)
      .single();
    expect(order).toMatchObject({
      type: "bulk",
      source: "admin",
      total: 1000,
      subtotal: 1000,
      source_quote_id: quoteId,
    });

    const { data: quote } = await db
      .from("quote_requests")
      .select("status")
      .eq("id", quoteId)
      .single();
    expect(quote?.status).toBe("won");

    const { count } = await db
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "quote.convert_to_order")
      .eq("record_id", orderId);
    expect(count).toBe(1);
  } finally {
    if (orderId) {
      await db
        .from("notifications")
        .delete()
        .eq("template", "new_order")
        .contains("payload", { order_id: orderId });
      await db.from("audit_logs").delete().eq("record_id", orderId);
      await db.from("orders").delete().eq("id", orderId);
    }
    await db.from("quote_requests").delete().eq("id", quoteId);
  }
});
