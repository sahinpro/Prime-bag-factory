import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Inline the small atomic (Tailwind) stylesheet into the <head> so the
    // hero text — the LCP element on the public pages — paints without waiting
    // on a render-blocking CSS request. Production builds only. See plan §Phase 3 T8.
    inlineCss: true,
  },
  images: {
    remotePatterns: [
      // Cloudinary serves all public catalog media (owner decision, see plan
      // Decision Log 2026-10-17). Supabase Storage stays for private quote
      // attachments and is whitelisted when that phase lands.
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
