import { describe, expect, it } from "vitest";

import type { MediaAsset } from "@/lib/media.types";
import {
  basenameOf,
  findAssetUsage,
  isMediaFolder,
  isOursPublicId,
  prefixFor,
} from "@/server/media";

// Pure Media Library rules (owner request 2026-10-25): the folder whitelist,
// the "is this ours?" guard that keeps the Admin API inside the
// Primebagfactory/ tree, and the in-use scan that blocks a destructive delete.

const SAMPLE_ID = "Primebagfactory/products/file_hbehre";

describe("prefixFor", () => {
  it("roots every listing at the project folder", () => {
    expect(prefixFor(null)).toBe("Primebagfactory");
    expect(prefixFor("products")).toBe("Primebagfactory/products");
  });
});

describe("isMediaFolder", () => {
  it("accepts only the fixed upload folders", () => {
    expect(isMediaFolder("swatches")).toBe(true);
    expect(isMediaFolder("portfolios")).toBe(false);
    expect(isMediaFolder("../products")).toBe(false);
    expect(isMediaFolder(undefined)).toBe(false);
  });
});

describe("isOursPublicId", () => {
  it("rejects ids outside the project tree", () => {
    expect(isOursPublicId("Primebagfactory/products/file_a")).toBe(true);
    expect(isOursPublicId("portfolios/logo.png")).toBe(false);
    // A sibling folder that merely starts with the same letters is not ours.
    expect(isOursPublicId("Primebagfactoryother/x")).toBe(false);
  });
});

describe("basenameOf", () => {
  it("returns the last path segment", () => {
    expect(basenameOf("Primebagfactory/categories/file_uk1mli")).toBe(
      "file_uk1mli",
    );
    expect(basenameOf("file_x")).toBe("file_x");
  });
});

// Minimal stand-in for the Supabase client: every table answers with the
// counts in `counts`, an error when the key is listed in `failing`, and a
// missing count when it is listed in `blank` (a 200 without a count header).
function fakeSupabase(
  counts: Record<string, number>,
  failing: string[] = [],
  blank: string[] = [],
) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            ilike() {
              const promise = failing.includes(table)
                ? { error: { message: "boom" }, count: null }
                : blank.includes(table)
                  ? { error: { message: "" }, count: null }
                  : { error: null, count: counts[table] ?? 0 };
              // The real builder is a thenable, so mimic that shape.
              return {
                then: (resolve: (v: unknown) => void) =>
                  Promise.resolve(promise).then(resolve),
              } as never;
            },
          };
        },
      };
    },
  } as never;
}

describe("findAssetUsage", () => {
  const publicId = SAMPLE_ID;

  it("sums every catalog table that references the asset", async () => {
    const usage = await findAssetUsage(
      fakeSupabase({ product_images: 2, categories: 1, clients: 1 }),
      publicId,
    );
    expect(usage.total).toBe(4);
    expect(usage.failedTables).toEqual([]);
    expect(usage.hits.map((h) => `${h.count} ${h.label}`).sort()).toEqual([
      "1 category",
      "1 site logo",
      "2 product image(s)",
    ]);
  });

  it("reports zero for an unreferenced asset", async () => {
    const usage = await findAssetUsage(fakeSupabase({}), publicId);
    expect(usage.total).toBe(0);
    expect(usage.hits).toEqual([]);
    expect(usage.failedTables).toEqual([]);
  });

  it("treats a failed scan as in use, so delete stays safe", async () => {
    const usage = await findAssetUsage(
      fakeSupabase({}, ["collections"]),
      publicId,
    );
    expect(usage.total).toBeGreaterThan(0);
    expect(usage.failedTables).toEqual(["collections"]);
  });

  it("flags an empty error body (bad column) as a failed scan", async () => {
    // PostgREST answers 400 for a nonexistent column and the client can hand
    // back an error with no message — that must never read as "not in use".
    const usage = await findAssetUsage(
      fakeSupabase({}, [], ["clients"]),
      publicId,
    );
    expect(usage.failedTables).toEqual(["clients"]);
    expect(usage.total).toBeGreaterThan(0);
  });
});

// Guards the shape the grid renders: an asset row must carry a thumbnail and
// a folder the picker can group by.
describe("MediaAsset contract", () => {
  it("keeps the fields the tile shows", () => {
    const asset: MediaAsset = {
      publicId: SAMPLE_ID,
      folder: "products",
      basename: basenameOf(SAMPLE_ID),
      bytes: 318018,
      format: "png",
      width: 1000,
      height: 750,
      createdAt: "2026-10-17T10:00:00Z",
      secureUrl:
        "https://res.cloudinary.com/demo/image/upload/Primebagfactory/products/file_hbehre.png",
      thumbUrl:
        "https://res.cloudinary.com/demo/image/upload/f_fill/Primebagfactory/products/file_hbehre.png",
    };
    expect(asset.basename).toBe("file_hbehre");
    expect(isMediaFolder(asset.folder)).toBe(true);
    expect(asset.thumbUrl).toBeTruthy();
  });
});
