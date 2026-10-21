import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";

import { ThemeProvider } from "@/components/site/theme-provider";
import { ThemeScript } from "@/components/site/theme-script";

import "../globals.css";

// Inter is self-hosted (plan Decision Log 2026-10-21): next/font/google's
// build-time download of fonts.googleapis.com intermittently fails under
// Turbopack on CI runners, breaking the build. The woff2 files live in
// src/app/fonts (sourced from @fontsource/inter).
const inter = localFont({
  src: [
    {
      path: "../fonts/inter-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../fonts/inter-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../fonts/inter-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../fonts/inter-latin-700-normal.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Prime Bag Factory Admin",
    template: "%s · Prime Bag Factory Admin",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // D6 (plan §15): the proxy mints a per-request nonce for `/admin/*` and passes
  // it as an internal `x-nonce` header. Reading it here keeps the whole admin
  // tree dynamic (it already is — every page uses `connection()`) and stamps our
  // own inline theme bootstrap; Next stamps its framework scripts automatically.
  // The public `[locale]` layout never reads headers, so it stays static/PPR.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <ThemeScript nonce={nonce} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
