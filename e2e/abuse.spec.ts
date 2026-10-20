import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

// Plan 15.2 B3 — abuse-protection e2e against the local stack. Proves the
// track's named Done-when items that live in the browser: the 4th checkout
// from one phone inside an hour is rejected, and the (previously unthrottled,
// finding R1) upload-signature endpoint answers 429 past its per-IP budget.
// A honeypot submit must still look like success.
//
// These tests DO place real orders on the local database (that is what the
// local stack and `db reset` are for). Phones and IPs are randomized per run
// so repeated runs never inherit an exhausted window.

/** Local test traffic shares 127.0.0.1 — give each test its own IP bucket. */
function randomIp(): string {
  return `203.0.${Math.floor(Math.random() * 255)}.${Math.floor(1 + Math.random() * 254)}`;
}

async function addFirstBuyNow(page: Page): Promise<boolean> {
  await page.goto("/en/search");
  // While the page streams, the Suspense fallback `main` and the real one
  // coexist — wait on the product link itself, never on `main` visibility.
  const firstProduct = page.locator('main a[href*="/product/"]').first();
  const href = await firstProduct
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => firstProduct.getAttribute("href"))
    .catch(() => null);
  if (!href) return false;

  await page.goto(href);
  const add = page.getByRole("button", { name: "Add to cart" });
  const hasAdd = await add
    .waitFor({ state: "visible", timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!hasAdd) return false;
  const added = page.getByRole("link", { name: "Added — view cart" });
  await expect
    .poll(
      async () => {
        if (await added.isVisible()) return true;
        await add.click();
        return false;
      },
      { timeout: 30_000, intervals: [500] },
    )
    .toBe(true);
  return true;
}

/** Fill the required customer fields; labels come from the checkout messages. */
async function fillCustomer(page: Page, phone: string) {
  await page.locator('input[name="customer_name"]').fill("Track B Tester");
  await page.locator('input[name="customer_phone"]').fill(phone);
  await page.locator('input[name="district"]').fill("Dhaka");
  await page.locator('input[name="area"]').fill("Mirpur");
  await page.locator('[name="address_line"]').fill("12 Test Road"); // textarea
  await page
    .locator('input[name="shipping_zone"]')
    .first()
    .check({ force: true });
}

const RATE_LIMIT_TEXT = /too many attempts/i;

test("the 4th checkout from one phone in an hour is rejected", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
  test.skip(!(await addFirstBuyNow(page)), "no buy-now product in the catalog");
  const phone = `017${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

  for (let attempt = 1; attempt <= 4; attempt++) {
    if (attempt > 1) {
      // A successful order clears the cart; put a line back in.
      test.skip(!(await addFirstBuyNow(page)), "no buy-now product");
    }
    await page.goto("/en/checkout");
    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await fillCustomer(page, phone);

    const place = page.getByRole("button", { name: "Place order", exact: true });
    test.skip(!(await place.isEnabled()), "MOQ or stock blocks this cart");
    await place.click();

    // Wait for the outcome: either the rate-limit alert or a settled result
    // (success panel "Order placed", or any server-side form alert — both
    // mean the submission reached the server and consumed the window).
    const rateLimited = page.getByText(RATE_LIMIT_TEXT);
    const settled =
      attempt === 4
        ? rateLimited
            .waitFor({ state: "visible", timeout: 30_000 })
            .then(() => true)
            .catch(() => false)
        : Promise.race([
            rateLimited
              .waitFor({ state: "visible", timeout: 30_000 })
              .then(() => true),
            page
              .getByText(/your order is placed/i)
              .waitFor({ state: "visible", timeout: 30_000 })
              .then(() => false),
            page
              .locator("form p[role='alert']")
              .first()
              .waitFor({ state: "visible", timeout: 30_000 })
              .then(() => false),
          ]).catch(() => false);

    const limited = await settled;
    if (attempt < 4) {
      expect(limited, `attempt ${attempt} must not be rate-limited`).toBe(false);
    } else {
      // checkout_phone allows 3 per hour — this is the 4th submission.
      expect(limited, `attempt ${attempt} must be rate-limited`).toBe(true);
    }
  }

  // Item-0 live proof: this phone burned a full window, yet no rate_limits
  // key carries the phone number — the identity half is salted-hashed.
  const { data: leaking } = await adminDb()
    .from("rate_limits")
    .select("key")
    .like("key", `%${phone}%`);
  expect(leaking).toEqual([]);
});

test("a honeypot submit still pretends success", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
  test.skip(!(await addFirstBuyNow(page)), "no buy-now product in the catalog");
  await page.goto("/en/checkout");
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  // Fixed phone, four baited submits — one more than checkout_phone allows.
  const phone = `017${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

  for (let attempt = 1; attempt <= 4; attempt++) {
    await fillCustomer(page, phone);

    // The hidden website field is the honeypot; a bot fills it, a human cannot.
    // The inputs are uncontrolled, so a plain value set lands in FormData.
    await page
      .locator('input[name="website"]')
      .evaluate((el) => {
        (el as HTMLInputElement).value = "https://spam.example";
      });
    // The fake-success path returns before any DB work, so the "Placing
    // order…" blip is too fast to catch — prove the round trip by waiting
    // for the server-action POST. Then assert the baited submit only
    // pretends: no order panel, and no rate-limit alert even past the
    // phone's 3/hour budget (the counters never see baited traffic).
    const actionRoundTrip = page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().includes("/en/checkout"),
      { timeout: 30_000 },
    );
    // Click the real submit — same path a baited bot's form post takes.
    await page
      .getByRole("button", { name: "Place order", exact: true })
      .click();
    await actionRoundTrip;

    await expect(page.getByText(/your order is placed/i)).toHaveCount(0);
    await expect(page.getByText(RATE_LIMIT_TEXT)).toHaveCount(0);
  }
});

/** Local-stack service client (A2 fence guarantees these are test values). */
function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

test("a blocked phone gets the generic checkout error", async ({ page }) => {
  test.setTimeout(120_000);
  const phone = `017${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  const db = adminDb();
  const { error: inserted } = await db
    .from("blocked_contacts")
    .insert({ type: "phone", value: phone, reason: "e2e abuse spec" });
  expect(inserted).toBeNull();

  try {
    test.skip(!(await addFirstBuyNow(page)), "no buy-now product in the catalog");
    await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
    await page.goto("/en/checkout");
    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await fillCustomer(page, phone);
    await page
      .getByRole("button", { name: "Place order", exact: true })
      .click();

    // B4 contract: the block answers with the generic failure — identical to
    // any other server error, never naming the blocklist, never the rate
    // text, and no order is created.
    await expect(
      page.getByText(/something went wrong/i),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(RATE_LIMIT_TEXT)).toHaveCount(0);
    await expect(page.getByText(/your order is placed/i)).toHaveCount(0);
  } finally {
    await db
      .from("blocked_contacts")
      .delete()
      .eq("type", "phone")
      .eq("value", phone);
  }
});

test("order lookup answers identically for a wrong number or a wrong phone", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
  test.skip(!(await addFirstBuyNow(page)), "no buy-now product in the catalog");

  // One real order gives a valid (number, phone) pair to half-break.
  const phone = `017${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
  await page.goto("/en/checkout");
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  await fillCustomer(page, phone);
  const place = page.getByRole("button", { name: "Place order", exact: true });
  test.skip(!(await place.isEnabled()), "MOQ or stock blocks this cart");
  await place.click();
  // The success panel heading is "Thank you — your order is placed".
  await expect(page.getByText(/your order is placed/i)).toBeVisible({
    timeout: 30_000,
  });
  const orderNo = (await page.locator("#order-head").textContent())!.trim();

  const alert = page.locator("main p[role='alert']");

  // (a) real number + wrong phone.
  await page.goto(`/en/order/${orderNo}`);
  await page.locator('input[name="customer_phone"]').fill("01700000000");
  await page.getByRole("button", { name: "Find order" }).click();
  await expect(alert).toBeVisible({ timeout: 30_000 });
  const wrongPhoneText = (await alert.textContent())!.trim();

  // (b) well-formed but nonexistent number + the real phone.
  await page.goto("/en/order/PBF-260101-0001");
  await page.locator('input[name="customer_phone"]').fill(phone);
  await page.getByRole("button", { name: "Find order" }).click();
  await expect(alert).toBeVisible({ timeout: 30_000 });
  const wrongNumberText = (await alert.textContent())!.trim();

  // B5 contract (plan 15.2): one identical not-found answer — the flood
  // learns nothing about which half was wrong, nor that a half exists at all.
  expect(wrongPhoneText).toMatch(/no order matches/i);
  expect(wrongNumberText).toBe(wrongPhoneText);
  expect(wrongPhoneText).not.toContain(phone);
  expect(wrongPhoneText).not.toContain(orderNo);
});

test("upload-signature answers 429 past its per-IP budget", async ({
  request,
}) => {
  const ip = randomIp();
  const statuses: number[] = [];
  for (let i = 0; i < 22; i++) {
    const res = await request.get("/api/upload-signature?folder=artwork", {
      headers: { "x-forwarded-for": ip },
    });
    statuses.push(res.status());
  }
  // upload_ip = 20/hour: the first 20 pass (200, or 503 when Cloudinary is
  // unconfigured locally — that is not a limiter answer), and past the budget
  // the endpoint must answer exactly 429.
  expect(statuses.slice(0, 20).every((s) => s !== 429)).toBe(true);
  expect(statuses.slice(20)).toEqual([429, 429]);
});
