import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// axe checks for the authenticated admin pages (plan Phase 2 task 6 / 9c.10):
// dashboard and design-system, in light and dark, at 375 / 768 / 1280 / 1440 px.
// Runs in the `admin` project (see playwright.config.ts). Without staff
// credentials in env, the auth setup leaves an empty session and each test here
// detects the login redirect and skips.

const themes = ["light", "dark"] as const;
const widths = [375, 768, 1280, 1440] as const;

const pages = [
  { path: "/admin", heading: "Dashboard" },
  { path: "/admin/design-system", heading: "Admin design system" },
  { path: "/admin/categories", heading: "Categories" },
  { path: "/admin/collections", heading: "Collections" },
  { path: "/admin/swatches", heading: "Swatch Library" },
  { path: "/admin/media", heading: "Media Library" },
  { path: "/admin/products", heading: "Products" },
  { path: "/admin/products/new", heading: "New product" },
  { path: "/admin/quotes", heading: "Quotes" },
  { path: "/admin/orders", heading: "Orders" },
  { path: "/admin/orders/new", heading: "New order" },
  { path: "/admin/customers", heading: "Customers" },
  { path: "/admin/inventory", heading: "Inventory" },
  { path: "/admin/shipping", heading: "Shipping zones" },
  { path: "/admin/settings", heading: "Settings" },
  { path: "/admin/blocked-contacts", heading: "Blocked contacts" },
  { path: "/admin/change-password", heading: "Change password" },
  // Password-recovery pages (2026-10-22). Forgot/reset live outside the
  // session guard, so they are axe-checked even without staff credentials.
  { path: "/admin/forgot-password", heading: "Reset your password" },
  { path: "/admin/reset-password", heading: "Choose a new password" },
] as const;

async function gotoAdminWithTheme(
  page: Page,
  path: string,
  theme: (typeof themes)[number],
  width: number,
): Promise<boolean> {
  await page.addInitScript((value) => {
    localStorage.setItem("theme", value);
  }, theme);
  await page.emulateMedia({ colorScheme: theme });
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);

  // Not authenticated → the proxy redirects to staff sign in.
  if (page.url().includes("/admin/login")) return false;

  await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
  return true;
}

for (const target of pages) {
  for (const theme of themes) {
    for (const width of widths) {
      test(`admin ${target.path} ${theme} @ ${width}px has no axe violations`, async ({
        page,
      }) => {
        const authenticated = await gotoAdminWithTheme(
          page,
          target.path,
          theme,
          width,
        );
        test.skip(
          !authenticated,
          "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
        );

        await expect(
          page.getByRole("heading", { level: 1, name: target.heading }),
        ).toBeVisible();

        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }
}
