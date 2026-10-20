import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Admin, auth and any API route are never indexed.
      disallow: ["/admin/", "/api/"],
    },
    sitemap: siteUrl("/sitemap.xml"),
    host: siteUrl("/"),
  };
}
