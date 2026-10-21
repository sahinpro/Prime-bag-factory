import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

/**
 * D4 (plan §15 / order-of-work step 10): a signed-in user with the `customer`
 * role, or a session with no matching profile, must not reach any admin surface.
 *
 * Admin is protected in two layers, and this spec exercises both for exactly the
 * two forbidden identities:
 *   1. the staff login (`signIn`) refuses to MINT a session for a customer or a
 *      profile-less user (it signs them straight back out), and
 *   2. with no admin session in the cookie jar, `src/proxy.ts` and the protected
 *      layout redirect every `/admin` route to `/admin/login`.
 * Defense in depth — `requireRole()` never lists `customer` in any action's
 * allowed roles, and the security-definer RPCs raise `not_allowed` — is covered
 * by the action guards and the pgTAP suites; this spec proves the page-load and
 * session-mint gates end-to-end.
 *
 * Runs in the `chromium` project (no storageState) so the browser starts cold;
 * the A2 fence in test-env.ts keeps the service client pointed at the local
 * stack only.
 */

const PASSWORD = "D4-guard-test-pw";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Routes a forbidden session must never be able to load. `/admin` and a print
 * sheet live outside the `(protected)` group, so they are called out here too. */
const GUARDED_ROUTES = [
  "/admin",
  "/admin/orders",
  "/admin/settings",
  "/admin/products/new",
  "/admin/print/orders/00000000-0000-0000-0000-000000000000/invoice",
] as const;

async function attemptLogin(page: Page, email: string, password: string) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a customer-role account cannot sign in to admin or load any admin page", async ({
  page,
}) => {
  const db = serviceClient();
  const email = `d4-customer-${Date.now()}@example.test`;

  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !created?.user) {
    test.skip(true, `Could not seed a customer user: ${error?.message}`);
  }
  const userId = created!.user!.id;

  try {
    // A profile row with the customer role — staff, but not an admin identity.
    const { error: profileError } = await db
      .from("profiles")
      .insert({ id: userId, full_name: "D4 Customer", role: "customer" });
    expect(profileError).toBeNull();

    await attemptLogin(page, email, PASSWORD);

    // The login form refuses to mint a session for a customer.
    await expect(page.locator("#login-error")).toContainText("not authorized");
    expect(new URL(page.url()).pathname).toBe("/admin/login");

    // No session was issued: every guarded route bounces to the login screen.
    for (const route of GUARDED_ROUTES) {
      await page.goto(route);
      expect(new URL(page.url()).pathname, `route ${route}`).toBe(
        "/admin/login",
      );
    }
  } finally {
    await db.auth.admin.deleteUser(userId);
  }
});

test("a profile-less account cannot sign in to admin or load any admin page", async ({
  page,
}) => {
  const db = serviceClient();
  const email = `d4-noprofile-${Date.now()}@example.test`;

  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !created?.user) {
    test.skip(true, `Could not seed a profile-less user: ${error?.message}`);
  }
  const userId = created!.user!.id;

  try {
    // Deliberately NO profile row — an auth user with nothing in `profiles`.

    await attemptLogin(page, email, PASSWORD);

    await expect(page.locator("#login-error")).toContainText("not authorized");
    expect(new URL(page.url()).pathname).toBe("/admin/login");

    for (const route of GUARDED_ROUTES) {
      await page.goto(route);
      expect(new URL(page.url()).pathname, `route ${route}`).toBe(
        "/admin/login",
      );
    }
  } finally {
    await db.auth.admin.deleteUser(userId);
  }
});
