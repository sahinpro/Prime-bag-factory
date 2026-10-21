import { describe, expect, it } from "vitest";

import {
  EMAIL_MAX_ATTEMPTS,
  cronAuthorized,
  emailOutcome,
  newOrderEmail,
} from "@/server/notifications";

const payload = {
  order_id: "11111111-1111-4111-8111-111111111111",
  order_no: "PBF-261021-0007",
  source: "web",
  customer_name: "Rahim",
  total: 550,
  customer_phone: "01700000091",
  address_line: "12 Secret Road",
};

describe("newOrderEmail", () => {
  it("names the order and links the admin page", () => {
    const mail = newOrderEmail(payload, "https://primebagfactorybd.com");
    expect(mail?.subject).toBe("New web order PBF-261021-0007 — Rahim");
    expect(mail?.text).toContain("Order: PBF-261021-0007");
    expect(mail?.text).toContain("Channel: web");
    expect(mail?.text).toContain("Customer: Rahim");
    expect(mail?.text).toContain(
      "Open in admin: https://primebagfactorybd.com/admin/orders/11111111-1111-4111-8111-111111111111",
    );
  });

  it("does not copy a phone or an address into the message", () => {
    const mail = newOrderEmail(payload, "https://primebagfactorybd.com");
    expect(mail?.text).not.toContain("01700000091");
    expect(mail?.text).not.toContain("Secret Road");
    expect(mail?.subject).not.toContain("01700000091");
  });

  it("labels an admin order and strips line breaks from the name", () => {
    const mail = newOrderEmail(
      {
        ...payload,
        source: "admin",
        customer_name: "Rahim\nBcc: attacker@evil.test",
      },
      "https://primebagfactorybd.com",
    );
    expect(mail?.subject.startsWith("New admin order")).toBe(true);
    expect(mail?.subject).not.toContain("\n");
    expect(mail?.text).not.toContain("\nBcc");
  });

  it("returns null when the order id or number is missing", () => {
    expect(newOrderEmail({ customer_name: "Rahim" }, "https://x.test")).toBeNull();
  });
});

describe("emailOutcome", () => {
  it("marks a clean send as sent", () => {
    expect(emailOutcome(1, null)).toEqual({ status: "sent", lastError: null });
  });

  it("keeps a failed attempt pending until the cap", () => {
    expect(emailOutcome(1, "timeout")).toEqual({
      status: "pending",
      lastError: "timeout",
    });
    expect(emailOutcome(EMAIL_MAX_ATTEMPTS - 1, "timeout").status).toBe(
      "pending",
    );
  });

  it("fails the row once attempts reach the cap", () => {
    expect(emailOutcome(EMAIL_MAX_ATTEMPTS, "mailbox rejected")).toEqual({
      status: "failed",
      lastError: "mailbox rejected",
    });
  });

  it("truncates a long provider error", () => {
    const error = "x".repeat(800);
    expect(emailOutcome(1, error).lastError).toHaveLength(500);
  });
});

describe("cronAuthorized", () => {
  it("accepts the bearer secret and rejects everything else", () => {
    expect(cronAuthorized("Bearer local-secret", "local-secret")).toBe(true);
    expect(cronAuthorized("Bearer wrong", "local-secret")).toBe(false);
    expect(cronAuthorized("local-secret", "local-secret")).toBe(false);
    expect(cronAuthorized(null, "local-secret")).toBe(false);
    expect(cronAuthorized("Bearer local-secret", undefined)).toBe(false);
    expect(cronAuthorized("Bearer local-secret", "")).toBe(false);
  });
});
