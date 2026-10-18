import AxeBuilder from "@axe-core/playwright";
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
  const open = page
    .getByRole("link", { name: /^Open\s*:\s*order / })
    .first();
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

  const tabs = page.getByRole("navigation", { name: "Filter orders by status" });
  await expect(tabs).toBeVisible();
  for (const label of ["Pending", "Shipped", "Delivered", "Cancelled"]) {
    await expect(tabs.getByRole("link", { name: new RegExp(label) })).toBeVisible();
  }

  for (const column of ["Order", "Customer", "Total", "Paid", "Status", "Payment"]) {
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
  await expect(page.getByRole("link", { name: "Packing slip" })).toHaveAttribute(
    "href",
    /\/admin\/print\/orders\/.+\/packing$/,
  );

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
