import type { MetadataRoute } from "next";

import { routing } from "@/i18n/routing";
import { siteUrl } from "@/lib/seo";
import {
  listSitemapCategories,
  listSitemapCollections,
  listSitemapProducts,
} from "@/server/catalog";

// Static, non-data-driven routes that always exist under every locale.
const STATIC_PATHS = [
  "",
  "/search",
  "/quote",
  "/builder",
  "/about",
  "/clients",
  "/faq",
  "/legal",
  "/contact",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, collections] = await Promise.all([
    listSitemapProducts(),
    listSitemapCategories(),
    listSitemapCollections(),
  ]);

  // Build the path per entity, then emit one entry per locale so hreflang-style
  // alternates are covered by the localized URLs Google expects.
  const paths: { path: string; lastmod?: Date }[] = [];

  for (const s of STATIC_PATHS) paths.push({ path: s });
  for (const c of categories) paths.push({ path: `/category/${c}` });
  for (const col of collections) paths.push({ path: `/collection/${col}` });
  for (const p of products)
    paths.push({ path: `/product/${p.slug}`, lastmod: new Date(p.updated_at) });

  const entries: MetadataRoute.Sitemap = [];
  for (const locale of routing.locales) {
    for (const { path, lastmod } of paths) {
      entries.push({
        url: siteUrl(`/${locale}${path}`),
        lastModified: lastmod,
        changeFrequency: path.startsWith("/product") ? "weekly" : "monthly",
        priority: path === "" ? 1 : 0.7,
      });
    }
  }

  return entries;
}
