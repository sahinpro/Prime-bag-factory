import { describe, expect, it } from "vitest";

import { getSafeAdminRedirectPath } from "@/lib/auth-redirect";

describe("getSafeAdminRedirectPath", () => {
  it("keeps an admin destination and its query string", () => {
    expect(getSafeAdminRedirectPath("/admin/orders?page=2")).toBe(
      "/admin/orders?page=2",
    );
  });

  it.each([
    undefined,
    "https://example.com/",
    "//example.com/",
    "/admin/login",
    "/admin/login?next=/admin",
    "/products",
  ])("rejects unsafe or non-admin destinations: %s", (path) => {
    expect(getSafeAdminRedirectPath(path)).toBe("/admin");
  });
});
