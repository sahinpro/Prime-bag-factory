import { describe, expect, it } from "vitest";

import { staffLoginSchema } from "@/lib/validators/staff-login";

describe("staffLoginSchema", () => {
  it("accepts valid credentials and an admin return path", () => {
    expect(
      staffLoginSchema.safeParse({
        email: "staff@example.com",
        password: "safe-password",
        next: "/admin/products",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid emails and empty passwords", () => {
    expect(
      staffLoginSchema.safeParse({
        email: "not-an-email",
        password: "",
      }).success,
    ).toBe(false);
  });
});
