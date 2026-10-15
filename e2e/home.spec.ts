import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const locale of ["en", "bn"] as const) {
  test(`${locale} home has no axe violations`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("language switcher keeps the page", async ({ page }) => {
  await page.goto("/en?q=bags");
  await page.getByRole("link", { name: "বাংলা" }).click();
  await expect(page).toHaveURL(/\/bn\?q=bags/);
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
});
