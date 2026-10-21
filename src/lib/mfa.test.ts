import { describe, expect, it } from "vitest";

import { shouldBlockForMfa } from "@/lib/mfa";

// Plan §15 D2 — the enforcement decision is a pure predicate so the three
// behaviours the owner asked for can be proven without a running Supabase:
//   • flag OFF  → never block (existing harness and every session unchanged)
//   • flag ON + owner/manager below AAL2 → block (bounce to the challenge)
//   • flag ON + AAL2 → allow
// Non-management staff (sales/inventory) are never gated, even with the flag on,
// because enforcement is scoped to owner/manager only.
describe("shouldBlockForMfa", () => {
  it("never blocks while enforcement is off", () => {
    expect(shouldBlockForMfa({ requireMfa: false, role: "owner", aal: "aal1" })).toBe(
      false,
    );
    expect(
      shouldBlockForMfa({ requireMfa: false, role: "manager", aal: null }),
    ).toBe(false);
  });

  it("blocks an owner or manager sitting below AAL2 when the flag is on", () => {
    expect(shouldBlockForMfa({ requireMfa: true, role: "owner", aal: "aal1" })).toBe(
      true,
    );
    expect(shouldBlockForMfa({ requireMfa: true, role: "manager", aal: "aal1" })).toBe(
      true,
    );
    expect(
      shouldBlockForMfa({ requireMfa: true, role: "owner", aal: null }),
    ).toBe(true);
  });

  it("allows an owner or manager who has reached AAL2", () => {
    expect(shouldBlockForMfa({ requireMfa: true, role: "owner", aal: "aal2" })).toBe(
      false,
    );
    expect(
      shouldBlockForMfa({ requireMfa: true, role: "manager", aal: "aal2" }),
    ).toBe(false);
  });

  it("never gates non-management roles, even with the flag on", () => {
    for (const role of ["sales", "inventory", "customer"]) {
      expect(shouldBlockForMfa({ requireMfa: true, role, aal: "aal1" })).toBe(
        false,
      );
    }
  });
});
