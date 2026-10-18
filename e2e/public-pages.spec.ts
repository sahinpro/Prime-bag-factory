import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Phase 3 public pages (plan §11): every new destination gets an axe run in both
// locales and both themes. Home is covered separately in home.spec.ts.
const locales = ["en", "bn"] as const;
const themes = ["light", "dark"] as const;

const PAGES = [
  "/quote",
  "/builder",
  "/search",
  "/cart",
  "/checkout",
  // The lookup form for an order that does not exist — the only public order
  // page reachable without a real order number.
  "/order/PBF-251018-0001",
  "/about",
  "/contact",
  "/faq",
  "/legal",
  "/clients",
] as const;

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
    for (const path of PAGES) {
      test(`${locale} ${theme} ${path} has no axe violations`, async ({
        page,
      }) => {
        await gotoWithTheme(page, `/${locale}${path}`, theme);
        // Wait for the streamed (Partial Prerender) content to land before
        // analyzing, so we audit the real page and not the shell fallback.
        await expect(page.locator("main")).toBeVisible();
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  }
}

// Detail pages depend on a real slug; discover one from the search results grid
// and audit it. Skips cleanly when the catalog has no matching rows.
async function auditFirstProduct(
  page: Page,
  locale: string,
  theme: (typeof themes)[number],
) {
  await gotoWithTheme(page, `/${locale}/search`, theme);
  await expect(page.locator("main")).toBeVisible();
  const href = await page
    .locator('main a[href*="/product/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  test.skip(!href, "no product in the catalog to audit");
  await gotoWithTheme(page, href!, theme);
  // The product segment is streamed (Partial Rendering): while the client swaps
  // the resumed subtree in, dev keeps a second copy of the layout's <main> in the
  // DOM, so let the stream settle and match the landmark leniently before auditing.
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main").first()).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

for (const locale of locales) {
  for (const theme of themes) {
    test(`${locale} ${theme} first product detail has no axe violations`, async ({
      page,
    }) => {
      await auditFirstProduct(page, locale, theme);
    });
  }
}
