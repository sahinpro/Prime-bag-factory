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
  "/order/lookup",
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
  // Wait for the streamed (Partial Prerender) subtree to swap in. During the
  // client-side resume the layout's fallback <main> and the resolved one briefly
  // coexist, so a snapshot or interaction taken too early sees two landmarks.
  // `toHaveCount(1)` is the deterministic settle signal. Do NOT use `networkidle`:
  // under `next start` the App Router keeps a `?_rsc=` prefetch request in flight
  // for the life of the page, so idle never fires and the audit would time out.
  await expect(page.locator("main")).toHaveCount(1);
}

for (const locale of locales) {
  for (const theme of themes) {
    for (const path of PAGES) {
      test(`${locale} ${theme} ${path} has no axe violations`, async ({
        page,
      }) => {
        await gotoWithTheme(page, `/${locale}${path}`, theme);
        // gotoWithTheme has already waited for the streamed content to settle,
        // so this audits the real page — not the Suspense fallback shell.
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
  const href = await page
    .locator('main a[href*="/product/"]')
    .first()
    .getAttribute("href")
    .catch(() => null);
  test.skip(!href, "no product in the catalog to audit");
  // gotoWithTheme waits for the streamed product segment to finish swapping in
  // (a single <main>) before axe runs, so the audit sees the resolved page.
  await gotoWithTheme(page, href!, theme);
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
