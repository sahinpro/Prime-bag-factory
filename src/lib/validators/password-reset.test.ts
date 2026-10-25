import { describe, expect, it } from "vitest";

import {
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validators/password-reset";

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    const result = forgotPasswordSchema.safeParse({
      email: "owner@example.com",
    });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe("owner@example.com");
  });

  it("rejects a non-email string", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "not-an-email" }).success,
    ).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts two identical 12+ char passwords", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "long-enough-pass",
        confirm: "long-enough-pass",
      }).success,
    ).toBe(true);
  });

  it("rejects passwords shorter than 12 characters", () => {
    const result = resetPasswordSchema.safeParse({
      password: "short",
      confirm: "short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched confirmations on the confirm field", () => {
    const result = resetPasswordSchema.safeParse({
      password: "long-enough-pass",
      confirm: "long-enough-pas2",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirm"]);
  });
});

describe("changePasswordSchema", () => {
  it("accepts a full valid triple", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old-password",
        password: "brand-new-password",
        confirm: "brand-new-password",
      }).success,
    ).toBe(true);
  });

  it("requires the current password and a long new one", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "",
        password: "short",
        confirm: "short",
      }).success,
    ).toBe(false);
  });

  it("rejects mismatched confirmations", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old-password",
        password: "brand-new-password",
        confirm: "brand-new-pasword",
      }).success,
    ).toBe(false);
  });
});
