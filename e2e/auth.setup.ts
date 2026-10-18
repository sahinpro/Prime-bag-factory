import { expect, test as setup } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

// Authenticates a staff account and saves storageState for the `admin` project.
// There is no committed staff user (see supabase/seed.sql and
// scripts/create-first-owner.ts), so credentials come from env. When they are
// absent we still write a baseline (empty) storageState so the dependent project
// does not error on a missing file; its tests then detect the login redirect and
// skip themselves.
//
// The password may contain shell-special characters (quotes). Always pass it in
// SINGLE quotes, e.g.  E2E_STAFF_PASSWORD='pa"ss,word' .
//
//   E2E_STAFF_EMAIL=... E2E_STAFF_PASSWORD=... bun run test:e2e

const authFile = "e2e/.auth/admin.json";
const baselineStorageState = { cookies: [], origins: [] };

setup("authenticate staff admin", async ({ page }) => {
  mkdirSync("e2e/.auth", { recursive: true });
  writeFileSync(authFile, JSON.stringify(baselineStorageState, null, 2));

  const email = process.env.E2E_STAFF_EMAIL;
  const password = process.env.E2E_STAFF_PASSWORD;

  setup.skip(
    !email || !password,
    "E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD not set — admin a11y tests will skip.",
  );

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();

  // A successful login lands on the dashboard at exactly `/admin`. Match the
  // pathname precisely — a loose /\/admin/ would also match /admin/login and
  // "pass" on a failed login. If credentials are wrong we stay on /admin/login,
  // this times out, and setup FAILS loudly instead of writing a bogus state.
  await page.waitForURL((url) => url.pathname === "/admin", { timeout: 20000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible({
    timeout: 20000,
  });

  const state = await page.context().storageState({ path: authFile });
  const hasSession = state.cookies.some((cookie) =>
    cookie.name.includes("auth-token"),
  );
  if (!hasSession) {
    throw new Error(
      "Login reached /admin but produced no Supabase auth-token cookie — " +
        "the admin a11y tests would silently skip. Check the staff account's role.",
    );
  }
});
