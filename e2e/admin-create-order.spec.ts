import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin-created orders (plan 15.2 E3): staff key a phone / WhatsApp / walk-in
 * order on `/admin/orders/new`, the picker prices a buy-now variant live, and a
 * successful save runs the `admin_create_order` RPC — an order with source
 * 'admin' + a channel, the line re-priced in Postgres, stock reserved for a
 * tracked variant and an `audit_logs` row. Money is asserted against the DB,
 * never the client, so a preview bug could not hide a wrong total (AGENTS).
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
 * A published buy-now product (MOQ 5) with one tracked 100-stock variant at a
 * flat 100/unit, plus a dedicated zone (fee 50, never free) so the total is
 * deterministic: 10 × 100 + 50 = 1050.
 */
async function seedOrderable() {
  const db = adminDb();
  const suffix = String(Math.floor(100000 + Math.random() * 900000));
  const slug = `e2e-admin-order-${suffix}`;
  const sku = `E2E-AO-${suffix}`;
  const title = `E2E walk-in bag ${suffix}`;
  const zoneName = `E2E zone ${suffix}`;

  const { data: zone } = await db
    .from("shipping_zones")
    .insert({ name_en: zoneName, fee: 50, free_over: null, is_active: true })
    .select("id")
    .single();

  const { data: product } = await db
    .from("products")
    .insert({
      slug,
      type: "buy_now",
      title_en: title,
      moq: 5,
      stock_mode: "tracked",
      status: "published",
    })
    .select("id")
    .single();

  const { data: variant } = await db
    .from("product_variants")
    .insert({
      product_id: product!.id,
      sku,
      color_name: "Black",
      stock_qty: 100,
      reserved_qty: 0,
      low_stock_threshold: 0,
    })
    .select("id")
    .single();

  await db.from("price_tiers").insert({
    product_id: product!.id,
    min_qty: 5,
    max_qty: null,
    unit_price: 100,
  });

  return {
    db,
    slug,
    sku,
    title,
    zoneName,
    zoneId: zone!.id,
    variantId: variant!.id,
  };
}

async function openNewOrder(page: Page): Promise<boolean> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/orders/new");
  if (page.url().includes("/admin/login")) return false;
  await expect(
    page.getByRole("heading", { level: 1, name: "New order" }),
  ).toBeVisible();
  return true;
}

test("a staff-created order prices, reserves stock and writes the source + audit", async ({
  page,
}) => {
  const seed = await seedOrderable();
  const phone = `017${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  const name = `E2E walk-in customer ${seed.sku}`;

  try {
    const authenticated = await openNewOrder(page);
    test.skip(
      !authenticated,
      "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
    );

    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Phone", { exact: true }).fill(phone);

    // Search the picker, add the seeded product (defaults to one line at MOQ 5).
    await page.getByLabel("Add a product").fill(seed.title);
    await page.getByRole("button", { name: new RegExp(seed.sku) }).click();

    // Raise the quantity to 10 for a predictable subtotal.
    await page.getByLabel("Qty").fill("10");

    // Pin the deterministic shipping zone so the fee is exactly 50.
    await page.getByLabel("Shipping zone").click();
    await page.getByRole("option", { name: new RegExp(seed.zoneName) }).click();

    await page.getByRole("button", { name: "Create order" }).click();

    // Success routes to the fresh order detail (the plan's "go to order").
    await expect(page).toHaveURL(/\/admin\/orders\/[0-9a-f-]{36}$/, {
      timeout: 15_000,
    });
    await expect(
      page.getByRole("heading", { level: 1, name: /PBF-\d{6}-\d{4}/ }),
    ).toBeVisible();

    // ---- the database, not the client, is the truth ----
    const { data: order } = await adminDb()
      .from("orders")
      .select(
        "id, order_no, source, channel, status, subtotal, shipping_fee, discount, total, customer_phone",
      )
      .eq("customer_name", name)
      .maybeSingle();
    expect(order).not.toBeNull();
    expect(order!.source).toBe("admin");
    expect(order!.channel).toBe("phone");
    expect(order!.status).toBe("confirmed");
    expect(Number(order!.subtotal)).toBe(1000); // 10 × 100, repriced server-side
    expect(Number(order!.shipping_fee)).toBe(50);
    expect(Number(order!.discount)).toBe(0);
    expect(Number(order!.total)).toBe(1050);
    expect(order!.customer_phone).toBe(phone);

    const orderId = order!.id;

    // Stock reserved for the tracked variant: 100 → 90 available, one movement.
    const { data: variant } = await adminDb()
      .from("product_variants")
      .select("reserved_qty")
      .eq("id", seed.variantId)
      .single();
    expect(Number(variant!.reserved_qty)).toBe(10);

    const { count: movements } = await adminDb()
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", seed.variantId)
      .eq("reason", "sale");
    expect(movements).toBe(1);

    // The audit trail records the actor, the action and the order id.
    const { data: audit } = await adminDb()
      .from("audit_logs")
      .select("action, actor_id, record_id")
      .eq("table_name", "orders")
      .eq("record_id", orderId)
      .maybeSingle();
    expect(audit?.action).toBe("admin_create_order");
    expect(audit?.actor_id).not.toBeNull();
  } finally {
    const db = seed.db;
    const { data: created } = await db
      .from("orders")
      .select("id")
      .eq("customer_name", name)
      .maybeSingle();
    if (created) {
      await db.from("audit_logs").delete().eq("record_id", created.id);
      await db.from("orders").delete().eq("id", created.id);
    }
    // Deleting the product cascades the variant, its tiers and the movements.
    await db.from("products").delete().eq("slug", seed.slug);
    await db.from("shipping_zones").delete().eq("id", seed.zoneId);
  }
});
