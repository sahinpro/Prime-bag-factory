import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const locales = ["en", "bn"] as const;
const themes = ["light", "dark"] as const;

async function gotoWithTheme(
  page: Page,
  path: string,
  theme: (typeof themes)[number],
) {
  await page.addInitScript((value) => {
    localStorage.setItem("theme", value);
  }, theme);
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(path);
  await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
}

for (const locale of locales) {
  for (const theme of themes) {
    test(`${locale} ${theme} home has no axe violations`, async ({ page }) => {
      await gotoWithTheme(page, `/${locale}`, theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
}

test("language switcher keeps the page", async ({ page }) => {
  await page.goto("/en?q=bags");
  await page.getByRole("link", { name: /বাং/ }).click();
  await expect(page).toHaveURL(/\/bn\?q=bags/);
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
});

test("header height does not change between en and bn", async ({ page }) => {
  await page.goto("/en");
  const enHeight = await page
    .locator("header")
    .evaluate((el) => el.getBoundingClientRect().height);
  await page.goto("/bn");
  const bnHeight = await page
    .locator("header")
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(bnHeight).toBe(enHeight);
});

test("header Get a quote reaches /quote on desktop and mobile; language switch keeps the path", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en/about");
  await page
    .getByRole("banner")
    .getByRole("link", { name: "Get a quote" })
    .click();
  await expect(page).toHaveURL(/\/en\/quote$/);

  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/en/about");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Get a quote" }).click();
  await expect(page).toHaveURL(/\/en\/quote$/);

  await page.getByRole("link", { name: /বাং/ }).click();
  await expect(page).toHaveURL(/\/bn\/quote$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "bn");
});

test("G3 policy slugs redirect to /legal", async ({ page }) => {
  await page.goto("/en/privacy");
  await expect(page).toHaveURL(/\/en\/legal$/);
});

test("site shell screenshots", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({
    path: "e2e/screenshots/header-footer-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 800 });
  await page.screenshot({
    path: "e2e/screenshots/header-footer-mobile-375.png",
    fullPage: true,
  });
});
