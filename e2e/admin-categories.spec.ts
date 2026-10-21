import { expect, test } from "@playwright/test";

/**
 * Categories tree reorder (plan 9c.8). Regression for the sibling bug: the tree
 * is a flattened DFS, but `sort_order` only compares *siblings*, so the old
 * flat `arrayMove` made "Move down" on a parent swap it with its own child — a
 * silent no-op. Reorder must now move whole subtrees among siblings only.
 */

// A tree row is the only `li` that contains the drag grip ("Reorder …"); this
// keeps the selectors off the sidebar nav, whose active link also uses
// `aria-current`.
const ROW = 'li:has(button[aria-label^="Reorder"])';

async function rowNames(page: import("@playwright/test").Page): Promise<string[]> {
  return page.locator(`${ROW} button[aria-current]`).allTextContents();
}

test("the first row has no Move up (no previous sibling)", async ({ page }) => {
  await page.goto("/admin/categories");
  test.skip(
    page.url().includes("/admin/login"),
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
  );
  const firstRow = page.locator(ROW).first();
  await expect(firstRow).toBeVisible();
  await expect(
    firstRow.getByRole("button", { name: /up$/ }),
  ).toBeDisabled();
});

test("Move down on a row with a next sibling reorders the tree", async ({
  page,
}) => {
  await page.goto("/admin/categories");
  test.skip(
    page.url().includes("/admin/login"),
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
  );
  await expect(page.locator(ROW).first()).toBeVisible();

  const before = await rowNames(page);

  // The first row whose "Move down" is enabled has a next sibling; clicking it
  // must change the visible order (previously a no-op when the neighbour was a
  // child rather than a sibling).
  const enabledDown = page
    .locator(`${ROW} button[aria-label$=" down"]:not([disabled])`)
    .first();
  await expect(enabledDown).toHaveCount(1);
  await enabledDown.click();

  await expect
    .poll(async () => (await rowNames(page)).join("|"), { timeout: 10_000 })
    .not.toBe(before.join("|"));

  // Reorder never adds or removes rows.
  await expect(page.locator(ROW)).toHaveCount(before.length);
});
