import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// axe checks for the public staff sign-in page (plan Phase 2 task 6). Runs in the
// `chromium` project — no auth needed. Light and dark at 375 / 768 / 1280 / 1440.

const themes = ["light", "dark"] as const;
const widths = [375, 768, 1280, 1440] as const;

async function gotoWithTheme(
  page: Page,
  theme: (typeof themes)[number],
  width: number,
) {
  await page.addInitScript((value) => {
    localStorage.setItem("theme", value);
  }, theme);
  await page.emulateMedia({ colorScheme: theme });
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/admin/login");
  await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
}

for (const theme of themes) {
  for (const width of widths) {
    test(`admin login ${theme} @ ${width}px has no axe violations`, async ({
      page,
    }) => {
      await gotoWithTheme(page, theme, width);
      await expect(
        page.getByRole("heading", { name: "Staff sign in" }),
      ).toBeVisible();

      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
