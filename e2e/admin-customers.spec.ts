import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Customers directory (plan §9): rows derived from orders + quote_requests
 * grouped by the canonical phone, and the detail drawer with both histories.
 * Seeding goes through the local-stack service client (the A2 fence in
 * test-env.ts guarantees it is never live) — the directory is a derived read,
 * so no place_order side effects (stock, order-number burn) are involved.
 */

/** Local-stack service client (the playwright config's A2 fence guarantees it). */
function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

test("the directory groups an order and a quote onto one customer and the drawer shows both", async ({
  page,
}) => {
  const db = adminDb();
  // Random phone per run so search lands on exactly one row and re-runs
  // never collide on the unique order_no.
  const canonical = `017${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  const orderNo = `PBF-999999-${String(
    Math.floor(1000 + Math.random() * 9000),
  )}`;
  const name = `E2e Customer ${canonical.slice(-4)}`;

  const { error: orderSeed } = await db.from("orders").insert({
    order_no: orderNo,
    customer_name: name,
    // Stored with the +88 prefix on purpose — the grouping must collapse it
    // onto the same row as the messy quote phone below.
    customer_phone: `+88${canonical}`,
    total: 1234.5,
  });
  expect(orderSeed).toBeNull();

  const { error: quoteSeed } = await db.from("quote_requests").insert({
    source: "form",
    contact_name: name,
    // Spaces in the middle — normalizePhone strips them.
    phone: `${canonical.slice(0, 4)} ${canonical.slice(4, 7)} ${canonical.slice(7)}`,
  });
  expect(quoteSeed).toBeNull();

  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/customers");
    test.skip(
      page.url().includes("/admin/login"),
      "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Customers" }),
    ).toBeVisible();

    // One grouped row: the search finds it by the canonical phone. Scoped to
    // the <table> because the DataTable keeps the (css-hidden) mobile card
    // copy in the DOM at desktop widths.
    // Under CI CPU contention App Router can briefly keep two copies of the
    // client tree mounted during hydration, so the search input transiently
    // matches twice; wait for it to settle to one before acting.
    const search = page.getByLabel("Search customers");
    await expect(search).toHaveCount(1, { timeout: 10_000 });
    await search.fill(canonical);
    const row = page.locator("table").getByRole("button", {
      name: new RegExp(`open history for ${canonical}`),
    });
    await expect(row).toHaveCount(1);

    await row.click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { level: 2, name })).toBeVisible();
    // Both histories, each linking to its real detail page.
    await expect(drawer.getByRole("link", { name: orderNo })).toBeVisible();
    await expect(
      drawer.getByRole("link", { name: "Form request" }),
    ).toBeVisible();
    // Quick links carry the 880-prefixed digits.
    await expect(
      drawer.getByRole("link", { name: "WhatsApp" }),
    ).toHaveAttribute("href", new RegExp(`wa\\.me/88${canonical}`));

    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  } finally {
    await db.from("orders").delete().eq("order_no", orderNo);
    await db
      .from("quote_requests")
      .delete()
      .eq("contact_name", name)
      .eq("source", "form");
  }
});

test("nav hides links to pages that are not built yet (C4)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/customers");
  test.skip(
    page.url().includes("/admin/login"),
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
  );

  const sidebar = page.getByRole("complementary", { name: "Admin sidebar" });
  await expect(sidebar.getByRole("link", { name: "Customers" })).toBeVisible();
  // Inventory shipped with E1 and Settings with the Settings track, so both are
  // now linked. Only these remain unbuilt and hidden.
  for (const unbuilt of ["Users", "Audit log"]) {
    await expect(sidebar.getByRole("link", { name: unbuilt })).toHaveCount(0);
  }
});
