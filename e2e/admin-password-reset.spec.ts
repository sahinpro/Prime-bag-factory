import { expect, test } from "@playwright/test";

// Admin password-recovery e2e (owner track, 2026-10-22). Runs unauthenticated
// in the `chromium` project. The reset email itself is never opened here —
// the local GoTrue mailer (Inbucket) is out of scope; the flow past the link
// is covered by the confirm-handler unit test and the axe matrix.

const GENERIC_SUCCESS =
  "If that email belongs to an admin account, a password reset link is on its way.";

test("login links to the forgot-password page", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();

  await expect(page).toHaveURL(/\/admin\/forgot-password$/);
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
});

test("forgot password answers an unknown email with the generic success", async ({
  page,
}) => {
  await page.goto("/admin/forgot-password");
  await page.getByLabel("Email").fill("nobody-not-a-real-account@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();

  const status = page.getByRole("status");
  await expect(status).toContainText(GENERIC_SUCCESS);
});

test("forgot password answers a known staff email identically (no enumeration)", async ({
  page,
}) => {
  const email = process.env.E2E_STAFF_EMAIL;
  test.skip(!email, "E2E_STAFF_EMAIL not set — cannot compare the known case.");

  await page.goto("/admin/forgot-password");
  await page.getByLabel("Email").fill(email!);
  await page.getByRole("button", { name: "Send reset link" }).click();

  const status = page.getByRole("status");
  await expect(status).toContainText(GENERIC_SUCCESS);
  // The visible result is the same as the unknown-email case: no wording that
  // could only be true when the account exists.
  await expect(
    page.getByText(/we sent a link to that email|account not found/i),
  ).toHaveCount(0);
});

test("reset password without a recovery session bounces to forgot with the generic note", async ({
  page,
}) => {
  await page.goto("/admin/reset-password");

  await expect(page).toHaveURL(/\/admin\/forgot-password\?reason=invalid$/);
  // Scoped to `main`: the redirect also fires Next's route announcer, another
  // `role="alert"` outside the page content (strict mode).
  await expect(
    page.getByRole("main").getByRole("alert"),
  ).toContainText(
    "That reset link is invalid or has expired. Request a new one.",
  );
});

test("the confirm handler with no code lands on the same generic failure", async ({
  page,
}) => {
  await page.goto("/admin/auth/confirm");

  await expect(page).toHaveURL(/\/admin\/forgot-password\?reason=invalid$/);
});
