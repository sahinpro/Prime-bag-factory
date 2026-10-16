import { expect, test, type Page } from "@playwright/test";

const bnPages = ["/bn"];
const themes = ["light", "dark"] as const;
const minPx = 18;

type TooSmall = {
  text: string;
  size: number;
  tag: string;
  className: string;
};

async function gotoWithTheme(page: Page, path: string, theme: (typeof themes)[number]) {
  await page.addInitScript((value) => {
    localStorage.setItem("theme", value);
  }, theme);
  await page.emulateMedia({ colorScheme: theme });
  await page.goto(path);
  await expect(page.locator("html")).toHaveClass(new RegExp(`\\b${theme}\\b`));
}

async function collectTooSmall(page: Page): Promise<TooSmall[]> {
  return page.evaluate((min) => {
    const failures: TooSmall[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

    const isExcluded = (el: Element | null) => {
      if (!el) {
        return true;
      }
      if (el.closest("svg") || el.closest("nextjs-portal") || el.closest("script")) {
        return true;
      }
      if (el.closest(".sr-only") || el.closest("header")) {
        return true;
      }
      return false;
    };

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent?.replace(/\s+/g, " ").trim();
      if (!text) {
        continue;
      }

      const el = node.parentElement;
      if (isExcluded(el) || !el) {
        continue;
      }

      const style = getComputedStyle(el);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number.parseFloat(style.opacity) === 0
      ) {
        continue;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        continue;
      }

      const size = Number.parseFloat(style.fontSize);
      if (size < min) {
        failures.push({
          text: text.slice(0, 80),
          size,
          tag: el.tagName,
          className: typeof el.className === "string" ? el.className : "",
        });
      }
    }

    return failures;
  }, minPx);
}

for (const path of bnPages) {
  for (const theme of themes) {
    test(`${path} ${theme} visible text is at least ${minPx}px`, async ({
      page,
    }) => {
      await gotoWithTheme(page, path, theme);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await collectTooSmall(page)).toEqual([]);

      const headingFont = await page
        .getByRole("heading", { level: 1 })
        .evaluate((el) => getComputedStyle(el).fontFamily);
      expect(headingFont.toLowerCase()).toContain("inter");
      expect(headingFont.toLowerCase()).not.toContain("noto");
    });
  }
}
