import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Shipping zones admin (plan §9 / 15.2 E2): the DataTable + side Sheet editor for
 * the checkout fee config — create, edit the fee, delete, and the C4 nav link.
 * Writes go through the `saveShippingZone` / `deleteShippingZone` actions (owner/
 * manager, zod, audit); the DB is asserted through the local-stack service client
 * (the A2 fence in test-env.ts guarantees it is never live). The authoritative fee
 * charged at checkout is recomputed server-side in `place_order` — this spec only
 * proves the admin config path lands in `shipping_zones`.
 */

/** Local-stack service client (the playwright config's A2 fence guarantees it). */
function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function gotoShipping(page: Page): Promise<boolean> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/shipping");
  if (page.url().includes("/admin/login")) return false;

  await expect(
    page.getByRole("heading", { level: 1, name: "Shipping zones" }),
  ).toBeVisible();
  return true;
}

test("create, edit and delete a shipping zone, and the nav link is present", async ({
  page,
}) => {
  const db = adminDb();
  const suffix = String(Math.floor(100000 + Math.random() * 900000));
  const name = `E2E Zone ${suffix}`;

  try {
    const authenticated = await gotoShipping(page);
    test.skip(
      !authenticated,
      "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
    );

    // ---- create ----
    await page.getByRole("button", { name: "New zone" }).click();
    const sheet = page.getByRole("dialog");
    await expect(
      sheet.getByRole("heading", { level: 2, name: "New shipping zone" }),
    ).toBeVisible();

    await sheet.getByRole("textbox", { name: "Zone name" }).fill(name);
    await sheet.getByLabel("Fee (BDT)").fill("55");
    await sheet.getByLabel(/Free over/).fill("1500");
    await sheet.getByRole("button", { name: "Save" }).click();

    const row = page.locator("table").locator("tr").filter({ hasText: name });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText("Active");

    const { data: created } = await db
      .from("shipping_zones")
      .select("id, fee, free_over, is_active")
      .eq("name_en", name)
      .maybeSingle();
    expect(created).not.toBeNull();
    expect(Number(created!.fee)).toBe(55);
    expect(Number(created!.free_over)).toBe(1500);
    expect(created!.is_active).toBe(true);

    // ---- edit the fee ----
    await row.getByRole("button", { name: /Edit/ }).click();
    await expect(
      sheet.getByRole("heading", { level: 2, name: "Edit shipping zone" }),
    ).toBeVisible();
    await sheet.getByLabel("Fee (BDT)").fill("65");
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(row).toContainText("65");

    const { data: edited } = await db
      .from("shipping_zones")
      .select("fee")
      .eq("id", created!.id)
      .single();
    expect(Number(edited!.fee)).toBe(65);

    // ---- delete ----
    await row.getByRole("button", { name: /Edit/ }).click();
    await sheet.getByRole("button", { name: "Delete" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete zone" })
      .click();

    await expect(row).toHaveCount(0);
    const { data: afterDelete } = await db
      .from("shipping_zones")
      .select("id")
      .eq("id", created!.id)
      .maybeSingle();
    expect(afterDelete).toBeNull();

    // ---- nav (C4): the Shipping link is now live in the Operations group ----
    const sidebar = page.getByRole("complementary", { name: "Admin sidebar" });
    await expect(sidebar.getByRole("link", { name: "Shipping" })).toBeVisible();
  } finally {
    await db.from("shipping_zones").delete().eq("name_en", name);
  }
});
