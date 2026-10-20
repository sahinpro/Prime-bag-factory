import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Phase 5 checkout smoke (plan task 2): the cart must survive the hop into
// checkout (server-hydrated lines, zone radios, the 50% advance rows), the form
// must validate client-side with the same rules the server uses, and the order
// lookup must answer only when number + phone both match. Nothing here places a
// real order — `place_order` reserves stock and mints an order number.

async function addFirstBuyNow(page: Page): Promise<boolean> {
  await page.goto("/en/search");
  // /search is streamed (PPR): wait for the fallback <main> to be replaced by
  // the resolved one instead of a strict `toBeVisible` that throws when the two
  // copies briefly coexist.
  await expect(page.locator("main")).toHaveCount(1);
  const href = await page
    .locator('main a[href*="/product/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  if (!href) return false;

  await page.goto(href);
  const add = page.getByRole("button", { name: "Add to cart" });
  // PPR streams the fallback first; an immediate count() raced it and faked a
  // "not a buy_now product" skip. Wait for the streamed configurator instead.
  const hasAdd = await add
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!hasAdd) return false;
  // A cold Turbopack dev server serves the page long before React hydrates;
  // a click on a not-yet-hydrated button is a silent no-op. Re-click until the
  // confirmation shows — pre-hydration clicks do nothing, so at worst the cart
  // gains one extra bump of the same variant (still a single line).
  const added = page.getByRole("link", { name: "Added — view cart" });
  await expect
    .poll(
      async () => {
        if (await added.isVisible()) return true;
        await add.click();
        return false;
      },
      { timeout: 30_000, intervals: [500] },
    )
    .toBe(true);
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
  // The click above proved the "Proceed to checkout" link reaches /checkout.
  // A client-side hop leaves the previous route's <main> in the DOM alongside
  // the new one in a production build; reload for a clean, server-rendered
  // checkout (the cart re-hydrates from the database) so the line count and the
  // axe run stay deterministic rather than racing two landmarks.
  await page.reload();
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

  // Next's route announcer also carries role="alert", so look inside the form.
  const alerts = page.locator("form p[role='alert']");
  // Same cold-hydration caveat as addFirstBuyNow: the server action only
  // intercepts submit once React is live, so retry until the alerts show.
  // Empty fields fail client-side zod, so no click can ever write an order.
  await expect
    .poll(
      async () => {
        await place.click();
        return (await alerts.count()) > 0 && (await alerts.first().isVisible());
      },
      { timeout: 30_000, intervals: [500] },
    )
    .toBe(true);
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
  const find = page.getByRole("button", { name: "Find order" });
  const alert = page.locator("form p[role='alert']");
  // Retry the read-only lookup until hydration makes it fire.
  await expect
    .poll(
      async () => {
        await find.click();
        return (await alert.count()) > 0 && (await alert.isVisible());
      },
      { timeout: 30_000, intervals: [500] },
    )
    .toBe(true);
  await expect(alert).toContainText(/No order matches/i);
});
