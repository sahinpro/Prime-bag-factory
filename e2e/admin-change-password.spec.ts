import { expect, test } from "@playwright/test";

// Change-password e2e for the logged-in staff user menu (owner track,
// 2026-10-22). Runs in the `admin` project (serial, one worker) — it mutates
// the shared staff account's password, so it must never race other admin
// specs. Verified against the local GoTrue: a password update revokes the
// account's OTHER sessions, which would silently kill the storageState session
// every later admin test reuses. So the happy path rotates to a temp password,
// rotates BACK, and then re-signs in through the UI to re-mint
// `e2e/.auth/admin.json` — `auth.setup.ts` runs before this file every time,
// its credentials keep working, and later specs get a live session again.

const email = process.env.E2E_STAFF_EMAIL;
const password = process.env.E2E_STAFF_PASSWORD;
const TEMP_PASSWORD = "rotate-me-2026-temp-pass";

test.describe("change password", () => {
  test.skip(
    !email || !password,
    "E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD not set — the account is not rotatable.",
  );

  async function submit(
    page: import("@playwright/test").Page,
    current: string,
    next: string,
  ) {
    await page.goto("/admin/change-password");
    await page.getByLabel("Current password").fill(current);
    await page.getByLabel("New password", { exact: true }).fill(next);
    await page.getByLabel("Confirm new password").fill(next);
    await page.getByRole("button", { name: "Update password" }).click();
  }

  test("a wrong current password is refused", async ({ page }) => {
    await submit(page, "totally-wrong-current-pass", TEMP_PASSWORD);

    // Scoped to `main`: Next's route announcer is another `role="alert"`.
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Current password is incorrect.",
    );
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("happy path: rotate the password and rotate it back", async ({
    page,
  }) => {
    await submit(page, password!, TEMP_PASSWORD);
    await expect(page.getByRole("main").getByRole("status")).toContainText(
      "Password updated.",
    );

    // The temp password is now the CURRENT one — proving the first change
    // actually took effect — then restore the original for the rest of the
    // harness.
    await submit(page, TEMP_PASSWORD, password!);
    await expect(page.getByRole("main").getByRole("status")).toContainText(
      "Password updated.",
    );

    // Both rotations revoked the shared session — re-mint it with a fresh UI
    // sign-in so every later admin-project test authenticates again.
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(email!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL((url) => url.pathname === "/admin", {
      timeout: 20000,
    });
    await page.context().storageState({ path: "e2e/.auth/admin.json" });
  });
});
