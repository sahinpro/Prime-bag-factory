import { describe, expect, it } from "vitest";

import { isOwnArtworkUrl } from "./artwork-url";

describe("isOwnArtworkUrl", () => {
  it("accepts a Cloudinary delivery URL in the artwork folder", () => {
    expect(
      isOwnArtworkUrl(
        "https://res.cloudinary.com/demo/image/upload/v1/Primebagfactory/artwork/logo.png",
      ),
    ).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "http://res.cloudinary.com/demo/image/upload/Primebagfactory/artwork/a.png",
    "https://evil.example/Primebagfactory/artwork/a.png",
    "https://res.cloudinary.com.evil.example/Primebagfactory/artwork/a.png",
    "https://user:pw@res.cloudinary.com/demo/image/upload/Primebagfactory/artwork/a.png",
    "https://res.cloudinary.com/demo/image/upload/Primebagfactory/products/a.png",
    "/Primebagfactory/artwork/a.png",
    "not a url",
  ])("rejects %s", (value) => {
    expect(isOwnArtworkUrl(value)).toBe(false);
  });
});
