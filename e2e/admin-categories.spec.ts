import { expect, test } from "@playwright/test";

/**
 * Categories tree reorder (plan 9c.8). The tree is NESTED — each sibling group is
 * its own SortableContext and `sort_order` only compares *siblings*, so dragging
 * (and the keyboard Move buttons) reorder within a group only; reparenting stays
 * in the editor. These specs prove the reorder works and persists to the DB, and
 * cover the old regression where a parent swapped with its own child (a no-op).
 *
 * Seed shape (supabase/seed.sql): two top-level groups — "Delivery & Cold-chain
 * Bags" (children "Food & Pizza", "Grocery & Milk") and "Backpacks" (child
 * "Laptop & Office").
 */

// A row is the div whose direct child is the drag grip; nested `<ul>/<li>` would
// make an `li` selector also match ancestors of a dragged row.
const ROW = 'div:has(> button[aria-label^="Reorder"])';
const topLevels = ["Delivery & Cold-chain Bags", "Backpacks"];

function skipUnlessSignedIn(page: import("@playwright/test").Page) {
  test.skip(
    page.url().includes("/admin/login"),
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
  );
}

async function rowTitles(
  page: import("@playwright/test").Page,
): Promise<string[]> {
  return page
    .locator(ROW)
    .locator("> button[aria-current] > span.truncate:not([lang])")
    .allTextContents();
}

/** Only the top-level rows (the group whose parent is the root) in DOM order. */
async function topLevelTitles(
  page: import("@playwright/test").Page,
): Promise<string[]> {
  const all = await rowTitles(page);
  return all.filter((t) => topLevels.includes(t));
}

/**
 * dnd-kit's PointerSensor activates after a 4px move, so drive raw pointer
 * events: press the source grip, nudge past the threshold, travel to the target
 * grip, release.
 */
async function dragReorder(
  page: import("@playwright/test").Page,
  fromName: string,
  toName: string,
) {
  const from = page.getByRole("button", { name: `Reorder ${fromName}` });
  const to = page.getByRole("button", { name: `Reorder ${toName}` });
  const fb = await from.boundingBox();
  const tb = await to.boundingBox();
  if (!fb || !tb)
    throw new Error(`No bounding box for ${fromName} / ${toName}`);
  const fx = fb.x + fb.width / 2;
  const fy = fb.y + fb.height / 2;
  await page.mouse.move(fx, fy);
  await page.mouse.down();
  await page.mouse.move(fx + 8, fy, { steps: 2 });
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, {
    steps: 12,
  });
  await page.mouse.up();
}

test("the first row has no Move up (no previous sibling)", async ({ page }) => {
  await page.goto("/admin/categories");
  skipUnlessSignedIn(page);
  const firstRow = page.locator(ROW).first();
  await expect(firstRow).toBeVisible();
  await expect(firstRow.getByRole("button", { name: /up$/ })).toBeDisabled();
});

test("keyboard Move down swaps two top-level categories and persists", async ({
  page,
}) => {
  await page.goto("/admin/categories");
  skipUnlessSignedIn(page);
  await expect(page.locator(ROW).first()).toBeVisible();

  const before = await topLevelTitles(page);
  expect(before.length).toBeGreaterThanOrEqual(2);

  // Move the first top-level row down past its sibling.
  const firstRow = page.locator(ROW).first();
  await firstRow.getByRole("button", { name: /down$/ }).click();

  await expect
    .poll(() => topLevelTitles(page), { timeout: 10_000 })
    .not.toEqual(before);
  const after = await topLevelTitles(page);
  expect(after).toEqual([...before.slice(1), before[0]]);

  // Optimistic order must equal what the DB actually stored.
  await page.reload();
  await expect(page.locator(ROW).first()).toBeVisible();
  expect(await topLevelTitles(page)).toEqual(after);
});

test("dragging a top-level category below its sibling reorders and persists", async ({
  page,
}) => {
  await page.goto("/admin/categories");
  skipUnlessSignedIn(page);
  await expect(page.locator(ROW).first()).toBeVisible();

  const before = await topLevelTitles(page);
  const [first, second] = before;
  await dragReorder(page, first, second);

  await expect
    .poll(() => topLevelTitles(page), { timeout: 10_000 })
    .not.toEqual(before);

  await page.reload();
  await expect(page.locator(ROW).first()).toBeVisible();
  expect(await topLevelTitles(page)).not.toEqual(before);
});

test("dragging a child within its siblings reorders that group only", async ({
  page,
}) => {
  await page.goto("/admin/categories");
  skipUnlessSignedIn(page);
  await expect(page.locator(ROW).first()).toBeVisible();

  // "Food & Pizza" and "Grocery & Milk" share the "Delivery" parent.
  const childrenRow = page.getByRole("button", {
    name: "Reorder Food & Pizza",
  });
  await expect(childrenRow).toBeVisible();

  const before = await rowTitles(page);
  await dragReorder(page, "Food & Pizza", "Grocery & Milk");

  await expect
    .poll(() => rowTitles(page), { timeout: 10_000 })
    .not.toEqual(before);

  // Only the two children swapped; the top-level group is untouched.
  const after = await rowTitles(page);
  expect(after.filter((t) => topLevels.includes(t))).toEqual(
    before.filter((t) => topLevels.includes(t)),
  );
});
