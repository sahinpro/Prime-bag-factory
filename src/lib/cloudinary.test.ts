import { describe, expect, it } from "vitest";

import { derivePublicId } from "./cloudinary";

/**
 * Owner request 2026-10-26: uploads must keep their original file name as the
 * Cloudinary public id, never an auto-generated hash. The name is sanitized,
 * not slugified — letters, digits, spaces, dots, hyphens and underscores live.
 */
describe("derivePublicId", () => {
  it("keeps a plain name without its extension", () => {
    expect(derivePublicId("black-crossbody.png")).toBe("black-crossbody");
    expect(derivePublicId("canvas tote v2.JPEG")).toBe("canvas-tote-v2");
  });

  it("strips path components the browser may include", () => {
    expect(derivePublicId("C:/Users/me/hero image.jpg")).toBe("hero-image");
    expect(derivePublicId("../etc/passwd")).toBe("passwd");
  });

  it("drops characters Cloudinary rejects but keeps the rest", () => {
    expect(derivePublicId("bag (2026) #sale%.png")).toBe("bag-2026-sale");
    expect(derivePublicId("logo,'\"final[1].webp")).toBe("logofinal1");
  });

  it("trims leading/trailing separators and collapses repeated hyphens", () => {
    expect(derivePublicId("  --my__bag--  .png")).toBe("my__bag");
    expect(derivePublicId("a   b.png")).toBe("a-b");
  });

  it("caps the name length", () => {
    expect(derivePublicId(`${"x".repeat(200)}.png`)).toHaveLength(120);
  });

  it("returns empty for names with nothing usable (fallback to generated)", () => {
    expect(derivePublicId("নতুন-ছবি.png")).toBe(""); // Bangla-only stem
    expect(derivePublicId("...")).toBe("");
    expect(derivePublicId("photograph")).toBe("photograph");
    expect(derivePublicId("1234")).toBe("1234");
    expect(derivePublicId("")).toBe("");
  });
});
