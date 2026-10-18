import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Phase 5 checkout smoke (plan task 2): the cart must survive the hop into
// checkout (server-hydrated lines, zone radios, the 50% advance rows), the form
// must validate client-side with the same rules the server uses, and the order
// lookup must answer only when number + phone both match. Nothing here places a
// real order — `place_order` reserves stock and mints an order number.

async function addFirstBuyNow(page: Page): Promise<boolean> {
  await page.goto("/en/search");
  await expect(page.locator("main")).toBeVisible();
  const href = await page
    .locator('main a[href*="/product/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (!href) return false;

  await page.goto(href);
  const add = page.getByRole("button", { name: "Add to cart" });
  if ((await add.count()) === 0) return false;
  await expect(add).toBeEnabled({ timeout: 10_000 });
  await add.click();
  await expect(
    page.getByRole("link", { name: "Added — view cart" }),
  ).toBeVisible();
  return true;
}

test("the cart carries into checkout with the advance summary", async ({
  page,
}) => {
  test.skip(!(await addFirstBuyNow(page)), "no buy-now product in the catalog");

  await page.goto("/en/cart");
  const toCheckout = page.getByRole("link", { name: "Proceed to checkout" });
  await expect(toCheckout).toBeVisible();
  await toCheckout.click();

  await expect(page).toHaveURL(/\/en\/checkout$/);
  await expect(page.getByRole("heading", { name: "Your items" })).toBeVisible();
  // One line, re-hydrated from the database rather than from localStorage.
  await expect(page.locator("form li")).toHaveCount(1);
  await expect(page.getByText("Shipping zone")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  await expect(page.getByText("50% advance due")).toBeVisible();
  await expect(page.getByText("Balance on delivery")).toBeVisible();
  await expect(page.getByText(/We will call to confirm/)).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("checkout blocks a submit with empty customer fields", async ({
  page,
}) => {
  test.skip(!(await addFirstBuyNow(page)), "no buy-now product in the catalog");
  await page.goto("/en/checkout");
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();

  const place = page.getByRole("button", { name: "Place order", exact: true });
  await expect(place).toBeVisible();
  test.skip(
    !(await place.isEnabled()),
    "MOQ or stock already blocks this cart",
  );

  await place.click();
  // Next's route announcer also carries role="alert", so look inside the form.
  const alerts = page.locator("form p[role='alert']");
  await expect(alerts.first()).toBeVisible();
  // Nothing was written: the page stays on checkout with its fields untouched.
  await expect(page).toHaveURL(/\/en\/checkout$/);
});

test("an unknown phone never reveals whether the order exists", async ({
  page,
}) => {
  await page.goto("/en/order/PBF-251018-0001");
  await expect(
    page.getByRole("heading", { name: "Track your order" }),
  ).toBeVisible();

  await page.getByLabel("Order number").fill("PBF-251018-0001");
  await page.getByLabel("Phone").fill("01700000000");
  await page.getByRole("button", { name: "Find order" }).click();

  const alert = page.locator("form p[role='alert']");
  await expect(alert).toBeVisible();
  await expect(alert).toContainText(/No order matches/i);
});
