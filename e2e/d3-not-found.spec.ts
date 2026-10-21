import { expect, test } from "@playwright/test";

// D3 (plan §15): the localized public 404 renders inside the [locale] layout,
// so on /bn the Bangla 18px floor must hold for visible text.
const locales = ["en", "bn"] as const;

const HEADINGS: Record<(typeof locales)[number], string> = {
  en: "Page not found",
  bn: "পেজটি পাওয়া যায়নি",
};

for (const locale of locales) {
  test(`${locale} unknown route shows the localized 404`, async ({ page }) => {
    await page.goto(`/${locale}/this-route-does-not-exist`);
    await expect(
      page.getByRole("heading", { level: 1, name: HEADINGS[locale] }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: locale === "en" ? "Go to homepage" : "হোমপেজে যান" }),
    ).toBeVisible();
  });

  test(`${locale} 404 body text is at least 18px`, async ({ page }) => {
    await page.goto(`/${locale}/this-route-does-not-exist`);
    const heading = page.getByRole("heading", { level: 1 });
    const size = await heading.evaluate((el) =>
      parseFloat(getComputedStyle(el).fontSize),
    );
    expect(size).toBeGreaterThanOrEqual(18);
  });
}
