import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * Admin orders (plan Phase 5 task 3): the list with its status pipeline and the
 * fulfilment detail — items, payments ledger, status history, the record-payment
 * form and the two print views.
 *
 * Read-only on purpose. A status move changes reserved stock and a payment writes
 * the ledger, so those paths are verified against the live `admin_set_order_status`
 * / `admin_record_payment` functions by hand on a test order; this suite only
 * proves the screens render, are labelled and stay accessible.
 */

async function openOrders(page: Page): Promise<boolean> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/orders");
  if (page.url().includes("/admin/login")) return false;
  await expect(
    page.getByRole("heading", { level: 1, name: "Orders" }),
  ).toBeVisible();
  return true;
}

async function openFirstOrder(page: Page): Promise<boolean> {
  // The kit's action column is "Open" plus an sr-only ": order <no>", so the
  // computed name is "Open : order PBF-…" — the space before the colon is real.
  const open = page.getByRole("link", { name: /^Open\s*:\s*order / }).first();
  if ((await open.count()) === 0) return false;
  await open.click();
  await expect(
    page.getByRole("heading", { level: 1, name: /PBF-\d{6}-\d{4}/ }),
  ).toBeVisible();
  return true;
}

test("the orders list carries the pipeline and the advance columns", async ({
  page,
}) => {
  const authenticated = await openOrders(page);
  test.skip(
    authenticated === false,
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
  );

  const tabs = page.getByRole("navigation", {
    name: "Filter orders by status",
  });
  await expect(tabs).toBeVisible();
  for (const label of ["Pending", "Shipped", "Delivered", "Cancelled"]) {
    await expect(
      tabs.getByRole("link", { name: new RegExp(label) }),
    ).toBeVisible();
  }

  for (const column of [
    "Order",
    "Customer",
    "Total",
    "Paid",
    "Status",
    "Payment",
  ]) {
    await expect(
      page.getByRole("columnheader", { name: column, exact: true }),
    ).toBeVisible();
  }
});

test("an order detail shows items, ledger, history and print links", async ({
  page,
}) => {
  const authenticated = await openOrders(page);
  test.skip(
    authenticated === false,
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
  );

  const hasOrders = await openFirstOrder(page);
  test.skip(hasOrders === false, "No orders in this project yet.");

  await expect(
    page.getByRole("heading", { level: 2, name: "Items" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Payments" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Status history" }),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Order fulfilment pipeline" }),
  ).toBeVisible();

  // The 50% advance is the whole point of the screen: it must be on page.
  await expect(page.getByText(/Advance due/).first()).toBeVisible();

  await expect(page.getByRole("link", { name: "Invoice" })).toHaveAttribute(
    "href",
    /\/admin\/print\/orders\/.+\/invoice$/,
  );
  await expect(
    page.getByRole("link", { name: "Packing slip" }),
  ).toHaveAttribute("href", /\/admin\/print\/orders\/.+\/packing$/);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("the order detail can block the customer's phone (B4)", async ({
  page,
}) => {
  const authenticated = await openOrders(page);
  test.skip(
    authenticated === false,
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
  );

  const hasOrders = await openFirstOrder(page);
  test.skip(hasOrders === false, "No orders in this project yet.");

  // Plan 15.2 B4: the escape hatch lives in the customer card and writes a
  // normalized phone to blocked_contacts (unique (type, value) makes a
  // double-block a friendly no-op, so this test is re-runnable).
  const trigger = page.getByRole("button", { name: "Block this phone" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Block this phone?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Block phone" }).click();

  await expect(page.getByText("Phone blocked.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(dialog).toBeHidden();
});

/** Local-stack service client (the playwright config's A2 fence guarantees it). */
function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

test("the blocklist page lists a blocked phone and unblocks it with an audit note",
  async ({ page }) => {
    const db = adminDb();
    // Random phone per run — the list is newest-first, so the seeded row lands
    // on page 1, and a re-run never collides on the unique (type, value).
    const phone = `017${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
    const { data: blocked, error: seeded } = await db
      .from("blocked_contacts")
      .insert({ type: "phone", value: phone, reason: "e2e B4b seed" })
      .select()
      .single();
    expect(seeded).toBeNull();

    try {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/admin/blocked-contacts");
      test.skip(
        page.url().includes("/admin/login"),
        "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
      );
      await expect(
        page.getByRole("heading", { level: 1, name: "Blocked contacts" }),
      ).toBeVisible();

      // Search narrows the list to the seeded row and proves the filter works.
      await page.getByLabel("Search blocked contacts").fill(phone);
      await expect(
        page.getByRole("button", { name: new RegExp(`Unblock.*${phone}`) }),
      ).toBeVisible({ timeout: 15_000 });

      await page
        .getByRole("button", { name: new RegExp(`Unblock.*${phone}`) })
        .click();
      const dialog = page.getByRole("dialog", { name: "Unblock this contact?" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Unblock", exact: true }).click();

      await expect(
        page.getByText("Phone unblocked — the customer can order again."),
      ).toBeVisible({ timeout: 15_000 });
      await expect(dialog).toBeHidden();
      // After the refresh the row is gone; only the search box still holds it.
      await expect(
        page.getByRole("button", { name: new RegExp(`Unblock.*${phone}`) }),
      ).toHaveCount(0);

      // The RPC deleted the row and wrote the audit note in one transaction.
      const { data: stillBlocked } = await db
        .from("blocked_contacts")
        .select("id")
        .eq("id", blocked.id)
        .maybeSingle();
      expect(stillBlocked).toBeNull();

      const { data: audit } = await db
        .from("audit_logs")
        .select("action, actor_id, diff")
        .eq("table_name", "blocked_contacts")
        .eq("record_id", blocked.id)
        .maybeSingle();
      expect(audit?.action).toBe("unblock");
      expect(audit?.actor_id).not.toBeNull(); // the signed-in staff member
      expect(audit?.diff?.value).toBe(phone);
      expect(audit?.diff?.reason).toBe("e2e B4b seed");
    } finally {
      // Leave no residue: the block row (if the unblock failed) and the audit.
      await db.from("blocked_contacts").delete().eq("id", blocked.id);
      await db
        .from("audit_logs")
        .delete()
        .eq("table_name", "blocked_contacts")
        .eq("record_id", blocked.id);
    }
  });
