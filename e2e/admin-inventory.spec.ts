import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Inventory admin (plan §9 Inventory / 15.2 E1): the variant ledger list with
 * derived available = stock − reserved, the adjust dialog (the
 * `admin_adjust_stock` RPC — a movement row plus the delta), the oversell
 * guard, the movement drawer with the low-stock threshold, the CSV export and
 * the C4 nav un-hide. Seeding goes through the local-stack service client
 * (the A2 fence in test-env.ts guarantees it is never live); deleting the
 * product cascades the variant and its movements away in cleanup.
 */

/** Local-stack service client (the playwright config's A2 fence guarantees it). */
function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/**
 * A tracked variant with 50 on hand and 10 reserved (available 40), a random
 * SKU so search lands on exactly one row and re-runs never collide.
 */
async function seedVariant() {
  const db = adminDb();
  const suffix = String(Math.floor(100000 + Math.random() * 900000));
  const slug = `e2e-inventory-${suffix}`;
  const sku = `E2E-INV-${suffix}`;

  const { data: product, error: productError } = await db
    .from("products")
    .insert({
      slug,
      type: "buy_now",
      title_en: "E2E inventory bag",
      moq: 5,
      stock_mode: "tracked",
      status: "published",
    })
    .select("id")
    .single();
  expect(productError).toBeNull();
  if (!product) throw new Error("product seed failed");

  const { data: variant, error: variantError } = await db
    .from("product_variants")
    .insert({
      product_id: product.id,
      sku,
      color_name: "Black",
      stock_qty: 50,
      reserved_qty: 10,
      low_stock_threshold: 0,
    })
    .select("id")
    .single();
  expect(variantError).toBeNull();
  if (!variant) throw new Error("variant seed failed");

  return { db, slug, sku, variantId: variant.id };
}

/** Open the list, wait for hydration to settle, search for `term`. */
async function gotoInventory(
  page: Page,
  term?: string,
): Promise<boolean> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/inventory");
  if (page.url().includes("/admin/login")) return false;

  await expect(
    page.getByRole("heading", { level: 1, name: "Inventory" }),
  ).toBeVisible();
  if (term) {
    // Same settle guard as the customers spec: under CPU contention the
    // client tree can transiently double-mount during hydration.
    const search = page.getByLabel("Search inventory");
    await expect(search).toHaveCount(1, { timeout: 10_000 });
    await search.fill(term);
  }
  return true;
}

test("adjust writes a movement, the ledger refuses oversell, the threshold flags low stock", async ({
  page,
}) => {
  const { db, slug, sku, variantId } = await seedVariant();

  try {
    const authenticated = await gotoInventory(page, sku);
    test.skip(
      !authenticated,
      "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
    );

    // Derived columns: 50 on hand, 10 reserved, 40 available, threshold 0.
    const row = page.locator("table").locator("tr").filter({ hasText: sku });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("40");
    await expect(row).toContainText("In stock");

    // ---- increase by 25 through the dialog (the admin_adjust_stock RPC) ----
    await row.getByRole("button", { name: `Adjust stock for ${sku}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { level: 2, name: "Adjust stock" }),
    ).toBeVisible();
    await expect(dialog).toContainText("currently 50 on hand");

    await dialog.getByLabel("Quantity").fill("25");
    await expect(dialog.getByText(/New stock on hand:/)).toContainText("75");
    await dialog.getByLabel("Note").fill("e2e restock");
    await dialog.getByRole("button", { name: "Record movement" }).click();
    await expect(dialog).toBeHidden();

    await expect(row).toContainText("65"); // available 75 − 10

    const { data: movements } = await db
      .from("inventory_movements")
      .select("delta, reason, ref_type, ref_id, note, created_by")
      .eq("variant_id", variantId);
    if (!movements) throw new Error("movement read failed");
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      delta: 25,
      reason: "purchase",
      ref_type: "manual",
      ref_id: null,
      note: "e2e restock",
    });
    expect(movements[0].created_by).not.toBeNull();

    // ---- decrease that would cross zero: refused, ledger untouched ----
    await row.getByRole("button", { name: `Adjust stock for ${sku}` }).click();
    await dialog.getByLabel("Direction").click();
    await page.getByRole("option", { name: /Decrease/ }).click();
    await dialog.getByLabel("Quantity").fill("999");
    await dialog.getByLabel("Note").fill("push below zero");
    await dialog.getByRole("button", { name: "Record movement" }).click();

    // The dialog stays open and the RPC's error is surfaced in the status line.
    await expect(
      dialog.getByRole("status").filter({ hasText: /not enough on hand/i }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    const { data: guarded } = await db
      .from("product_variants")
      .select("stock_qty")
      .eq("id", variantId)
      .single();
    if (!guarded) throw new Error("variant read failed");
    expect(guarded.stock_qty).toBe(75);

    // ---- movement drawer: the trail, then the low-stock threshold ----
    await row.getByRole("button", { name: `History for ${sku}` }).click();
    const drawer = page.getByRole("dialog");
    await expect(
      drawer.getByRole("heading", { level: 2, name: sku }),
    ).toBeVisible();
    await expect(drawer).toContainText("Purchase / restock");
    await expect(drawer).toContainText("+25");
    await expect(drawer).toContainText("e2e restock");

    await drawer.getByLabel("Low-stock threshold").fill("80");
    await drawer.getByRole("button", { name: "Save" }).click();
    await expect(
      drawer.getByRole("status").filter({ hasText: "Threshold saved." }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    // available 65 ≤ threshold 80 → the row flips to the low badge.
    await expect(row).toContainText("Low stock");

    // The toggle narrows the list to exactly this variant (URL-synced).
    await page.getByRole("button", { name: "Low stock only" }).click();
    await expect(page).toHaveURL(/low=1/);
    await expect(row).toHaveCount(1);
  } finally {
    await db.from("products").delete().eq("slug", slug);
  }
});

test("Export CSV downloads the current stock position", async ({ page }) => {
  const { db, slug, sku } = await seedVariant();

  try {
    const authenticated = await gotoInventory(page);
    test.skip(
      !authenticated,
      "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
    );

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export CSV" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      /^inventory-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const path = await download.path();
    const csv = fs.readFileSync(path!, "utf8");
    expect(csv).toContain(
      "sku,product,color,size,stock_mode,stock_qty,reserved_qty,available,low_stock_threshold,status,active",
    );
    expect(csv).toContain(`${sku},`);
  } finally {
    await db.from("products").delete().eq("slug", slug);
  }
});

test("nav shows the un-hidden Inventory link and still hides unbuilt pages (C4)", async ({
  page,
}) => {
  const authenticated = await gotoInventory(page);
  test.skip(
    !authenticated,
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
  );

  const sidebar = page.getByRole("complementary", { name: "Admin sidebar" });
  await expect(sidebar.getByRole("link", { name: "Inventory" })).toBeVisible();
  // Settings shipped with the Settings track and is now linked; only these
  // remain unbuilt and hidden.
  for (const unbuilt of ["Users", "Audit log"]) {
    await expect(
      sidebar.getByRole("link", { name: unbuilt }),
    ).toHaveCount(0);
  }
});
