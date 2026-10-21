import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Staff pages: never cached, never indexed.
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Public catalog reads cache under this profile. The plan's backstop was a
  // 300s ISR revalidate; no built-in profile equals five minutes, so define it.
  // On-demand `revalidateTag("catalog")` from admin saves is the primary
  // invalidation — this TTL is only the safety net if a tag call is ever missed.
  cacheLife: {
    catalog: {
      stale: 60, // serve the previous entry for 60s while it regenerates
      revalidate: 300, // background-refresh after 5 minutes
      expire: 3600, // hard-serve-stale ceiling of 1 hour
    },
  },
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
