import { describe, expect, it } from "vitest";

import { companySchema, notificationCronSchema } from "./settings";

/**
 * Settings validators (plan §9, order-of-work step 9). The `settings` table
 * stores free-form jsonb, so these schemas are the only guard on the shape the
 * /admin/settings screen persists. Blank strings are normalised to null (an
 * unset field), the company name is the one required field, and the cron URL
 * must be http(s) so the scheduler can never be pointed at a bogus scheme.
 */

describe("companySchema", () => {
  const base = { name: "Prime Bag Factory", phone: "", whatsapp: "", email: "" };

  it("accepts a complete profile and coerces blanks to null", () => {
    const parsed = companySchema.safeParse({
      ...base,
      phone: " +8801700000000 ",
      email: "info@example.com",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Prime Bag Factory");
      expect(parsed.data.phone).toBe("+8801700000000");
      expect(parsed.data.whatsapp).toBeNull();
      expect(parsed.data.email).toBe("info@example.com");
    }
  });

  it("requires a non-blank company name", () => {
    expect(companySchema.safeParse({ ...base, name: "" }).success).toBe(false);
    expect(companySchema.safeParse({ ...base, name: "   " }).success).toBe(false);
  });

  it("rejects a malformed email but accepts a blank one", () => {
    expect(companySchema.safeParse({ ...base, email: "not-an-email" }).success)
      .toBe(false);
    const blank = companySchema.safeParse({ ...base, email: "" });
    expect(blank.success).toBe(true);
    if (blank.success) expect(blank.data.email).toBeNull();
  });

  it("enforces the name length cap", () => {
    expect(companySchema.safeParse({ ...base, name: "a".repeat(121) }).success)
      .toBe(false);
  });
});

describe("notificationCronSchema", () => {
  it("leaves the sender inert when both fields are blank", () => {
    const parsed = notificationCronSchema.safeParse({ url: "", secret: "" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.url).toBeNull();
      expect(parsed.data.secret).toBeNull();
    }
  });

  it("accepts a valid http(s) url and keeps the secret", () => {
    const parsed = notificationCronSchema.safeParse({
      url: "https://app.example.com/api/cron/send-notifications",
      secret: "s3cr3t-value",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.url).toBe("https://app.example.com/api/cron/send-notifications");
      expect(parsed.data.secret).toBe("s3cr3t-value");
    }
  });

  it("refuses a url that is not http(s)", () => {
    for (const bad of ["ftp://x", "javascript:alert(1)", "://nope"]) {
      expect(notificationCronSchema.safeParse({ url: bad, secret: "" }).success)
        .toBe(false);
    }
  });
});
