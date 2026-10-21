import { createClient } from "@supabase/supabase-js";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Admin Settings (plan §9 / order-of-work step 9): the company-profile and
 * notification-delivery screens. Saves go through `saveCompany` /
 * `saveNotificationCron` (owner/manager, zod, audit) which upsert the jsonb
 * `settings` rows. This spec asserts the page is axe-clean and that a company
 * name edit round-trips to the DB, then restores the original value so the seed
 * stays intact for the other admin specs. The local-stack service client is
 * fenced to never touch live by test-env.ts.
 */

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function gotoSettings(page: Page): Promise<boolean> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/admin/settings");
  if (page.url().includes("/admin/login")) return false;
  await expect(
    page.getByRole("heading", { level: 1, name: "Settings" }),
  ).toBeVisible();
  return true;
}

test("settings page is axe-clean", async ({ page }) => {
  const authenticated = await gotoSettings(page);
  test.skip(
    !authenticated,
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
  );

  await expect(
    page.getByRole("heading", { level: 2, name: "Company profile" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Notifications" }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("a company profile edit round-trips to the settings row", async ({
  page,
}) => {
  const db = adminDb();
  const { data: original } = await db
    .from("settings")
    .select("value")
    .eq("key", "company")
    .maybeSingle();
  const originalName =
    (original?.value as { name?: string } | undefined)?.name ??
    "Prime Bag Factory";
  const suffix = String(Math.floor(100000 + Math.random() * 900000));
  const editedName = `E2E Company ${suffix}`;

  try {
    const authenticated = await gotoSettings(page);
    test.skip(
      !authenticated,
      "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
    );

    const nameInput = page.getByLabel("Company name");
    await expect(nameInput).toHaveValue(originalName);

    await nameInput.fill(editedName);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("status")).toContainText(
      "Company profile saved.",
    );

    const { data: saved } = await db
      .from("settings")
      .select("value")
      .eq("key", "company")
      .single();
    expect((saved!.value as { name: string }).name).toBe(editedName);

    // The mutation must leave an audit trail naming the settings table.
    const { count } = await db
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "settings.company");
    expect(count).not.toBeNull();
    expect(count! ).toBeGreaterThan(0);
  } finally {
    await db
      .from("settings")
      .update({
        value: {
          ...(original?.value as Record<string, unknown> | undefined),
          name: originalName,
        },
      })
      .eq("key", "company");
  }
});
