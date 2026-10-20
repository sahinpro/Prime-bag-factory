import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

/**
 * Plan 15.2 B6 — the private artwork round trip, end to end against the local
 * stack: a customer uploads artwork (browser → signed upload URL → private
 * `quote-attachments` bucket), submits the quote with only the server-minted
 * object path, then staff open the file through a short-lived signed read URL
 * on the admin quote detail. Proves the whole deny-all + signed-URL design:
 * the object is unreachable anonymously yet reachable via the minted URL.
 *
 * Runs in the `admin` project (it needs a staff session for the detail page and
 * does the public upload first in the same worker). Skips when no staff account
 * is provisioned, exactly like the other admin specs.
 */

/** Local-stack service client (the A2 fence guarantees these are test values). */
function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Test traffic shares 127.0.0.1 — give the run its own IP rate-limit bucket. */
function randomIp(): string {
  return `203.0.${Math.floor(Math.random() * 255)}.${Math.floor(1 + Math.random() * 254)}`;
}

// A valid 1×1 PNG. The upload widget only checks MIME + size, and the bucket
// allows image/png, so this tiny fixture exercises the real signed-upload path.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

const STORAGE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

test("private artwork: upload → quote → staff open it via a signed URL", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);

  // Skip cleanly when no staff account is provisioned (baseline storageState).
  await page.goto("/admin/quotes");
  test.skip(
    page.url().includes("/admin/login"),
    "Set E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD with a provisioned staff account.",
  );

  await page.setExtraHTTPHeaders({ "x-forwarded-for": randomIp() });
  const phone = `017${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

  // 1. Customer fills the quote form and attaches artwork.
  await page.goto("/en/quote");
  await page.getByLabel("Your name").fill("Track B Artwork Tester");
  await page.getByLabel("Phone").fill(phone);

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles({
    name: "artwork.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });

  // The widget flips to its done state (file name shown, no preview image) and
  // stores the server-minted object path in the hidden field.
  await expect(page.getByTitle("artwork.png")).toBeVisible({ timeout: 30_000 });
  const hidden = page.locator('input[name="attachment_path"]');
  await expect(hidden).not.toHaveValue("", { timeout: 30_000 });
  const objectPath = await hidden.inputValue();
  // Server-generated `<yyyy>/<uuid>.png` — never a caller-chosen name or URL.
  expect(objectPath).toMatch(
    /^\d{4}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.png$/,
  );

  // 2. Submit the quote.
  await page.getByRole("button", { name: "Send request" }).click();
  await expect(
    page.getByRole("heading", { name: "Request received" }),
  ).toBeVisible({ timeout: 30_000 });

  // Confirm only the object path (not any URL) reached the row.
  const db = adminDb();
  const { data: quote } = await db
    .from("quote_requests")
    .select("id, attachment_path")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  expect(quote?.attachment_path).toBe(objectPath);

  // 3. The object is private: a plain (unsigned) read is refused.
  const unsigned = await request.get(
    `${STORAGE_URL}/storage/v1/object/quote-attachments/${objectPath}`,
  );
  expect(unsigned.ok()).toBe(false);

  // Staff open the detail and read the artwork via a minted signed URL.
  await page.goto(`/admin/quotes/${quote!.id}`);
  const link = page.getByRole("link", { name: "Open full size" }).first();
  await expect(link).toBeVisible({ timeout: 30_000 });
  const signedUrl = await link.getAttribute("href");
  expect(signedUrl).toContain("/storage/v1/object/sign/quote-attachments/");
  expect(signedUrl).toContain("token=");

  // The preview <img> points at the same signed read URL. `.first()` because the
  // streamed admin route can briefly hold two copies of the resolved subtree.
  await expect(
    page.getByAltText(/Artwork attachment for request/).first(),
  ).toHaveAttribute("src", /\/object\/sign\/quote-attachments\/.+token=/);

  // The signed URL really serves the bytes — proof the deny-all policy does not
  // block the signed path staff use, and the round trip is intact.
  const signed = await request.get(signedUrl!);
  expect(signed.status()).toBe(200);
  expect(await signed.body()).toEqual(TINY_PNG);
});
