import { expect, test, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import path from "node:path";

/**
 * Media Library (`/admin/media`, owner request 2026-10-25). Covers the three
 * things the owner asked for: admin can UPLOAD into Cloudinary, can DELETE
 * (and is refused while the catalog still references the file), and can REUSE
 * an existing asset from inside a form.
 *
 * Cloudinary has no sandbox, so the spec is written to leave the account
 * exactly as it found it: the uploaded asset is deleted again inside the same
 * test (with a `finally` retry), and the in-use case is refused BEFORE any
 * delete reaches Cloudinary, so no real asset is destroyed there. The seeded
 * `categories` row lives on the local stack only (the A2 fence in
 * `e2e/test-env.ts` aborts the whole suite otherwise).
 */

const FIXTURE = path.join(process.cwd(), "public", "bags", "bag2.jpeg");

function db(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const tiles = (page: Page) =>
  page.getByRole("list", { name: "Media assets" }).getByRole("listitem");

/** Every tile renders its public id in the name's `title` attribute. */
const tileTitles = (page: Page) => page.locator("li p[title]");

/** Public ids currently on screen — used to spot exactly what an upload added. */
async function titledIds(page: Page): Promise<string[]> {
  await expect
    .poll(() => tileTitles(page).count(), { timeout: 30_000 })
    .toBeGreaterThan(0);
  return await tileTitles(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute("title") ?? ""),
  );
}

async function openLibrary(page: Page): Promise<boolean> {
  await page.goto("/admin/media");
  const heading = page.getByRole("heading", {
    level: 1,
    name: "Media Library",
  });
  await expect(heading).toBeVisible();
  // Cloudinary unconfigured or unreachable renders the error state instead.
  const failed = page.getByText("Could not reach Cloudinary");
  if (await failed.isVisible()) return false;
  await expect(
    page.getByRole("tab", { name: "All", exact: true }),
  ).toBeVisible();
  return true;
}

/** Best-effort cleanup: delete a named tile through the UI. */
async function deleteTileByName(page: Page, name: string): Promise<void> {
  await page.goto("/admin/media");
  const trigger = page.getByRole("button", { name: `Delete ${name}` });
  if ((await trigger.count()) === 0) return;
  await trigger.first().click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Delete ${name}` }),
  ).toHaveCount(0, { timeout: 30_000 });
}

test("lists only the Primebagfactory tree, with folder tabs and a search box", async ({
  page,
}) => {
  test.setTimeout(120_000);
  test.skip(
    !(await openLibrary(page)),
    "Cloudinary is not reachable in this environment.",
  );

  await expect
    .poll(() => tiles(page).count(), { timeout: 30_000 })
    .toBeGreaterThan(0);
  // Scope lock, asserted in the browser: every visible tile is ours.
  const total = await tileTitles(page).count();
  await expect(page.locator("li p[title^='Primebagfactory/']")).toHaveCount(
    total,
  );
  await expect(page.getByText("portfolios/")).toHaveCount(0);
  await expect(page.getByText(/Page \d+ · \d+ images?/)).toBeVisible();

  // Folder tab navigation is URL-synced and re-roots the Cloudinary prefix.
  await page.getByRole("tab", { name: "products", exact: true }).click();
  await expect(page).toHaveURL(/folder=products/);
  await expect
    .poll(() => tiles(page).count(), { timeout: 30_000 })
    .toBeGreaterThan(0);
  await expect(
    page.locator("li p[title^='Primebagfactory/products/']"),
  ).toHaveCount(await tiles(page).count());

  // Search is URL-synced too and filters by name.
  await page.goto("/admin/media");
  await page.getByPlaceholder(/Search by file name/).fill("file_uk1mli");
  await expect(page).toHaveURL(/q=file_uk1mli/);
  await expect
    .poll(() => tileTitles(page).count(), { timeout: 30_000 })
    .toBeLessThanOrEqual(1);
});

test("admin can upload an image and delete it again", async ({ page }) => {
  test.setTimeout(180_000);
  test.skip(
    !(await openLibrary(page)),
    "Cloudinary is not reachable in this environment.",
  );

  await expect
    .poll(() => tiles(page).count(), { timeout: 30_000 })
    .toBeGreaterThan(0);
  const before = await tiles(page).count();
  const idsBefore = new Set(await titledIds(page));
  let uploaded = "";
  try {
    // Upload through the header dialog (folder "All" → products folder).
    await page.getByRole("button", { name: "Upload", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Upload an image" }),
    ).toBeVisible();
    await dialog.locator('input[type="file"]').setInputFiles(FIXTURE);

    // The dialog closes itself on success and the page refreshes, so the new
    // tile is found by diffing the ids on screen (not by position: Cloudinary
    // orders a prefix listing by public id, and the page re-sorts by upload
    // time, which is only reliable inside the current page).
    await expect(dialog).toBeHidden({ timeout: 60_000 });
    await expect
      .poll(async () => (await titledIds(page)).length, { timeout: 60_000 })
      .toBe(before + 1);
    uploaded = (await titledIds(page)).find((id) => !idsBefore.has(id)) ?? "";
    expect(uploaded).toMatch(/^Primebagfactory\/products\/[\w.-]+$/);

    // Delete it again — ConfirmDialog is required for a destructive action.
    const name = uploaded.split("/").pop()!;
    await page.getByRole("button", { name: `Delete ${name}` }).click();
    const confirm = page.getByRole("dialog");
    await expect(
      confirm.getByRole("heading", { name: `Delete ${name}?` }),
    ).toBeVisible();
    await confirm.getByRole("button", { name: "Delete", exact: true }).click();

    await expect
      .poll(() => tiles(page).count(), { timeout: 60_000 })
      .toBe(before);
    await expect(
      page.getByRole("button", { name: `Delete ${name}` }),
    ).toHaveCount(0);

    // The delete leaves an audit trail (plan D1). Writing the Cloudinary id
    // into the uuid `record_id` used to be rejected by Postgres, so the row
    // vanished with only a console warning — assert the trail really exists.
    const { data: auditRow } = await db()
      .from("audit_logs")
      .select("action,diff,created_at")
      .eq("action", "media.delete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    expect((auditRow?.diff as { public_id?: string } | null)?.public_id).toBe(
      uploaded,
    );
    uploaded = "";
  } finally {
    if (uploaded) {
      await deleteTileByName(page, uploaded.split("/").pop()!).catch(() => {});
    }
  }
});

test("refuses to delete an image the catalog still references", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const client = db();
  test.skip(
    !(await openLibrary(page)),
    "Cloudinary is not reachable in this environment.",
  );

  await expect
    .poll(() => tiles(page).count(), { timeout: 30_000 })
    .toBeGreaterThan(0);
  const title = (await titledIds(page))[0] ?? "";
  const basename = title.split("/").pop()!;
  const slug = `e2e-media-guard-${basename.slice(-6).replace(/\W/g, "x")}`;

  // Point a local-stack category at the asset by basename — exactly what the
  // server-side usage scan looks for across the catalog image columns.
  const { error: seedError } = await client
    .from("categories")
    .insert({ slug, name_en: slug, image_path: `x/${basename}` });
  expect(seedError).toBeNull();

  try {
    await page.getByRole("button", { name: `Delete ${basename}` }).click();
    const confirm = page.getByRole("dialog");
    await confirm.getByRole("button", { name: "Delete", exact: true }).click();

    // Refused before touching Cloudinary, and the tile stays.
    await expect(
      page.getByText("Delete refused", { exact: false }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Still in use by 1 category/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Delete ${basename}` }),
    ).toBeVisible();
  } finally {
    await client.from("categories").delete().eq("slug", slug);
  }
});

test("reuses an existing asset from inside a form (Library picker)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // The design-system page demos the kit uploader with `allowLibrary`, which
  // is the same wiring the category/collection/swatch/product editors use.
  await page.goto("/admin/design-system");
  const library = page.getByRole("button", { name: "Library" }).first();
  await expect(library).toBeVisible();
  await library.click();

  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Media Library" }),
  ).toBeVisible();
  const grid = dialog.getByRole("list", { name: "Choose an image" });
  await expect
    .poll(() => grid.getByRole("listitem").count(), { timeout: 30_000 })
    .toBeGreaterThan(0);

  await grid
    .getByRole("button", { name: /^Use image / })
    .first()
    .click();
  await expect(dialog).toBeHidden();
});
