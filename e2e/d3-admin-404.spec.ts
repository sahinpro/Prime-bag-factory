import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// D3 (plan §15): the admin 404 page joins the authed axe matrix — light and
// dark at 375 / 768 / 1280 / 1440. Runs in the `admin` project; skips cleanly
// when no staff session is present.
const themes = ["light", "dark"] as const;
const widths = [375, 768, 1280, 1440] as const;

async function gotoAdmin404(
  page: Page,
  theme: (typeof themes)[number],
  width: number,
): Promise<boolean> {
  await page.addInitScript((value) => {
    localStorage.setItem("theme", value);
  }, theme);
  await page.emulateMedia({ colorScheme: theme });
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/admin/this-route-does-not-exist");
  if (page.url().includes("/admin/login")) return false;
  await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
  return true;
}

for (const theme of themes) {
  for (const width of widths) {
    test(`admin 404 ${theme} @ ${width}px has no axe violations`, async ({
      page,
    }) => {
      const authenticated = await gotoAdmin404(page, theme, width);
      test.skip(
        !authenticated,
        "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
      );
      await expect(
        page.getByRole("heading", { level: 1, name: "Page not found" }),
      ).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
  }
}
