import { describe, expect, it } from "vitest";

import {
  extensionForMime,
  isQuoteAttachmentPath,
} from "./quote-attachment";

describe("isQuoteAttachmentPath", () => {
  it("accepts a server-minted <yyyy>/<uuid>.<ext> path for every allowed extension", () => {
    for (const ext of ["png", "jpg", "jpeg", "webp", "pdf"]) {
      expect(
        isQuoteAttachmentPath(
          `2026/0f8e0c2e-1111-4111-8111-111111111111.${ext}`,
        ),
      ).toBe(true);
    }
  });

  it.each([
    // Not our shape at all.
    "https://res.cloudinary.com/demo/image/upload/Primebagfactory/artwork/a.png",
    "https://evil.example/2026/0f8e0c2e-1111-4111-8111-111111111111.png",
    "javascript:alert(1)",
    // Traversal / absolute / missing folder.
    "../../etc/passwd.png",
    "/2026/0f8e0c2e-1111-4111-8111-111111111111.png",
    "0f8e0c2e-1111-4111-8111-111111111111.png",
    "2026/sub/dir/0f8e0c2e-1111-4111-8111-111111111111.png",
    // Bad basename or extension.
    "2026/not-a-uuid.png",
    "2026/0f8e0c2e-1111-4111-8111-111111111111.svg",
    "2026/0f8e0c2e-1111-4111-8111-111111111111.exe",
    "2026/0f8e0c2e-1111-4111-8111-111111111111",
    // Uppercase UUID is not what crypto.randomUUID emits.
    "2026/0F8E0C2E-1111-4111-8111-111111111111.png",
    // Second dot / query string smuggle.
    "2026/0f8e0c2e-1111-4111-8111-111111111111.png.png",
    "2026/0f8e0c2e-1111-4111-8111-111111111111.png?x=1",
    // Year must be four digits.
    "26/0f8e0c2e-1111-4111-8111-111111111111.png",
  ])("rejects %s", (value) => {
    expect(isQuoteAttachmentPath(value)).toBe(false);
  });
});

describe("extensionForMime", () => {
  it("maps the four allowed types to a short extension", () => {
    expect(extensionForMime("image/png")).toBe("png");
    expect(extensionForMime("image/jpeg")).toBe("jpg");
    expect(extensionForMime("image/webp")).toBe("webp");
    expect(extensionForMime("application/pdf")).toBe("pdf");
  });

  it("rejects every other type, svg included", () => {
    expect(extensionForMime("image/svg+xml")).toBeNull();
    expect(extensionForMime("text/html")).toBeNull();
    expect(extensionForMime("application/octet-stream")).toBeNull();
    expect(extensionForMime("")).toBeNull();
  });
});
