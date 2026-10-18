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
  test.skip((await add.count()) === 0, "first product is not buy_now");
  await expect(add).toBeEnabled({ timeout: 10_000 });
  await add.click();

  await expect(
    page.getByRole("link", { name: "Added — view cart" }),
  ).toBeVisible();
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
