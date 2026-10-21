import type { Metadata } from "next";
import localFont from "next/font/local";

import { ThemeProvider } from "@/components/site/theme-provider";
import { ThemeScript } from "@/components/site/theme-script";

import "../globals.css";

// Inter is self-hosted (plan Decision Log 2026-10-21): next/font/google's
// build-time download of fonts.googleapis.com intermittently fails under
// Turbopack on CI runners, breaking the build. The woff2 files live in
// src/app/fonts (sourced from @fontsource/inter).
const inter = localFont({
  src: [
    { path: "../fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
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

export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <ThemeScript />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
