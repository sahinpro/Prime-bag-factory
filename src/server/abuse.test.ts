// Plan 15.2 B2 — unit tests for the pure parts of src/server/abuse.ts:
// XFF parsing, salted IP/phone hashing and phone canonicalization. The
// DB-facing helpers (getRateLimitRules / limit / isAllowed) are thin wrappers
// over the settings row and the B1 RPC; the RPC itself is proven in
// supabase/tests/track_b_rate_limits.test.sql.

import { describe, expect, it } from "vitest";

import {
  RATE_LIMIT_DEFAULTS,
  firstForwardedHop,
  hashClientIp,
  hashPhone,
  normalizePhone,
  pickClientIp,
} from "@/server/abuse";

describe("firstForwardedHop", () => {
  it("takes the first hop of a comma-separated list", () => {
    expect(firstForwardedHop("203.0.113.7, 70.41.3.18, 150.172.238.24")).toBe(
      "203.0.113.7",
    );
  });

  it("trims whitespace and accepts a single hop", () => {
    expect(firstForwardedHop(" 203.0.113.7 ")).toBe("203.0.113.7");
  });

  it("returns null for missing or empty headers", () => {
    expect(firstForwardedHop(null)).toBeNull();
    expect(firstForwardedHop(undefined)).toBeNull();
    expect(firstForwardedHop("")).toBeNull();
    // A malformed leading-comma header yields null — callers skip the IP rule
    // rather than trusting a later hop they did not parse.
    expect(firstForwardedHop(" ,,1.2.3.4")).toBeNull();
  });
});

describe("pickClientIp", () => {
  const headers = (values: Record<string, string>) => (name: string) =>
    values[name] ?? null;

  it("off Vercel reads the x-forwarded-for first hop (local dev, e2e)", () => {
    expect(
      pickClientIp(
        headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }),
        false,
      ),
    ).toBe("203.0.113.7");
  });

  it("on Vercel ignores the spoofable x-forwarded-for entirely", () => {
    expect(
      pickClientIp(
        headers({
          "x-forwarded-for": "1.2.3.4",
          "x-vercel-forwarded-for": "203.0.113.9, 10.0.0.1",
        }),
        true,
      ),
    ).toBe("203.0.113.9");
  });

  it("on Vercel falls back to x-real-ip, never to x-forwarded-for", () => {
    expect(
      pickClientIp(
        headers({
          "x-forwarded-for": "1.2.3.4",
          "x-real-ip": "203.0.113.9",
        }),
        true,
      ),
    ).toBe("203.0.113.9");
    expect(pickClientIp(headers({ "x-forwarded-for": "1.2.3.4" }), true)).toBe(
      null,
    );
  });
});

describe("hashClientIp", () => {
  it("is deterministic for the same ip and salt", () => {
    expect(hashClientIp("203.0.113.7", "salt-a")).toBe(
      hashClientIp("203.0.113.7", "salt-a"),
    );
  });

  it("never contains the raw ip", () => {
    expect(hashClientIp("203.0.113.7", "salt-a")).not.toContain("203.0.113.7");
  });

  it("changes with the salt (no cross-environment rainbow tables)", () => {
    expect(hashClientIp("203.0.113.7", "salt-a")).not.toBe(
      hashClientIp("203.0.113.7", "salt-b"),
    );
  });

  it("produces a 64-char hex digest", () => {
    expect(hashClientIp("203.0.113.7", "salt-a")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("normalizePhone", () => {
  it("keeps the canonical 01… form", () => {
    expect(normalizePhone("01711223344")).toBe("01711223344");
  });

  it("collapses +880 and 880 variants onto the local form", () => {
    expect(normalizePhone("+8801711223344")).toBe("01711223344");
    expect(normalizePhone("8801711223344")).toBe("01711223344");
  });

  it("strips spaces, dashes and parentheses", () => {
    expect(normalizePhone("01711-22 33 (44)")).toBe("01711223344");
  });

  it("converts Bangla digits", () => {
    expect(normalizePhone("০১৭১১২২৩৩৪৪")).toBe("01711223344");
  });
});

describe("hashPhone", () => {
  it("produces a 64-char hex digest that is never the phone", () => {
    const h = hashPhone("01711223344", "salt-a");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("01711223344");
  });

  it("collapses every written format onto one bucket (normalize first)", () => {
    expect(hashPhone("+8801711223344", "salt-a")).toBe(
      hashPhone("01711223344", "salt-a"),
    );
    expect(hashPhone("01711-22 33 (44)", "salt-a")).toBe(
      hashPhone("01711223344", "salt-a"),
    );
    expect(hashPhone("০১৭১১২২৩৩৪৪", "salt-a")).toBe(
      hashPhone("01711223344", "salt-a"),
    );
  });

  it("uses the same salted recipe as the IP hash", () => {
    expect(hashPhone("+8801711223344", "salt-a")).toBe(
      hashClientIp(normalizePhone("+8801711223344"), "salt-a"),
    );
  });

  it("changes with the salt and with the phone", () => {
    expect(hashPhone("01711223344", "salt-a")).not.toBe(
      hashPhone("01711223344", "salt-b"),
    );
    expect(hashPhone("01711223344", "salt-a")).not.toBe(
      hashPhone("01822334455", "salt-a"),
    );
  });
});

describe("RATE_LIMIT_DEFAULTS", () => {
  it("matches the owner-approved plan numbers", () => {
    expect(RATE_LIMIT_DEFAULTS).toEqual({
      checkout_phone: { limit: 3, windowSeconds: 3600 },
      checkout_ip: { limit: 10, windowSeconds: 3600 },
      lookup_ip: { limit: 10, windowSeconds: 600 },
      lookup_order: { limit: 5, windowSeconds: 3600 },
      quote_ip: { limit: 5, windowSeconds: 3600 },
      upload_ip: { limit: 20, windowSeconds: 3600 },
      // Password-recovery track (2026-10-22): plan is silent on these two,
      // chosen simple defaults, noted in the Decision Log.
      admin_reset_ip: { limit: 10, windowSeconds: 3600 },
      admin_reset_email: { limit: 5, windowSeconds: 3600 },
    });
  });
});
