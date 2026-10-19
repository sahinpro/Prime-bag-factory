import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Phase 5 cart smoke (plan task 1): add a buy_now product from its detail page
// and confirm it lands in the cart. Skips cleanly when the dev catalog has no
// buy_now product with stock — same discovery pattern as public-pages audits.
test("add to cart from product detail shows the line in /cart", async ({
  page,
}) => {
  await page.goto("/en/search");
  await expect(page.locator("main")).toBeVisible();
  const href = await page
    .locator('main a[href*="/product/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  test.skip(!href, "no product in the catalog to buy");

  await page.goto(href!);
  const add = page.getByRole("button", { name: "Add to cart" });
  // Wait for the streamed configurator before judging the product type — an
  // immediate count() races the PPR fallback under parallel load.
  const hasAdd = await add
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  test.skip(!hasAdd, "first product is not buy_now");
  // A cold Turbopack dev server serves the page long before React hydrates,
  // and `toBeEnabled` cannot prove hydration (the button is enabled in static
  // HTML too) — a single early click is then a silent no-op. Re-click until
  // the confirmation appears; clicks before hydration do nothing, so the cart
  // gains at most one extra bump of the same variant (one line either way).
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
  await page.getByRole("link", { name: "Cart," }).click();

  await expect(page).toHaveURL(/\/en\/cart/);
  await expect(
    page.getByRole("heading", { name: "Order summary" }),
  ).toBeVisible();
  await expect(page.locator("main li")).toHaveCount(1);
  // The hydrated cart rows, steppers and summary only exist here — the empty
  // state is audited in public-pages.spec.ts.
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
