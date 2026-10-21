/**
 * Cache tag names (plan 3b "Cache tags"). Every public read that is memoized
 * with `"use cache"` tags itself with one of these; every admin mutation that
 * changes that data calls `revalidateTag`/`updateTag` with the same string, so
 * the two sides can never drift. Keeping them in one file is the whole point —
 * a tag typed by hand in a query and again in an action is a tag that silently
 * stops invalidating.
 *
 * `catalog` is the broad tag every catalog-shaped read carries (nav, listings,
 * search, home rails, swatches, sitemap, category/collection/product detail).
 * Admin catalog saves revalidate `catalog` — one call refreshes the whole public
 * site. The per-entity tags (`product:{slug}`, `category:{slug}`) exist so a
 * future single-entity invalidation can target one page without touching the
 * rest; detail reads carry both, so invalidating `catalog` still reaches them.
 */

export const CACHE_TAGS = {
  /** Broad tag shared by every public catalog read. */
  catalog: "catalog",
  /** Runtime flags / company data (plan 3b). */
  settings: "settings",
  /** One published product's detail page. */
  product: (slug: string) => `product:${slug}`,
  /** One category landing page. */
  category: (slug: string) => `category:${slug}`,
  /** A named content collection (faqs, legal, clients). */
  content: (key: string) => `content:${key}`,
} as const;
