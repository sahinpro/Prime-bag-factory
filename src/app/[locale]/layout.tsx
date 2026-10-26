import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import localFont from "next/font/local";
import { notFound } from "next/navigation";

import { ThemeProvider } from "@/components/site/theme-provider";
import { ThemeScript } from "@/components/site/theme-script";
import { isLocale, routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { jsonLd, siteUrl } from "@/lib/seo";

import "../globals.css";

// Inter and Noto Serif Bengali are self-hosted (plan Decision Log 2026-10-21):
// next/font/google's build-time download of fonts.googleapis.com intermittently
// fails under Turbopack on CI runners, breaking the build. The woff2 files live
// in src/app/fonts (sourced from @fontsource/inter and
// @fontsource/noto-serif-bengali).
const inter = localFont({
  src: [
    { path: "../fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-inter",
  // Plan §8 performance pass (line 947 lever): LCP on these pages is text,
  // and "swap" made it wait for the font under Lighthouse's 4x CPU throttle.
  // "optional" paints the first frame with the system font immediately; the
  // brand font is used as soon as it is cached. Revert to "swap" only with an
  // owner sign-off — it trades the 90+ gate for guaranteed font consistency.
  display: "optional",
});

const notoSerifBengali = localFont({
  src: [
    { path: "../fonts/noto-serif-bengali-bengali-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/noto-serif-bengali-bengali-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-bn",
  display: "optional",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Next 16 instant-navigation validation (instant-shell-url-data): this root
// layout reads the [locale] URL param above every public page (the server half
// of next-intl's NextIntlClientProvider also awaits request data while it
// renders), so a locale-switch navigation can never show instant UI from here.
// A <Suspense> fallback at this level would blank the whole page shell (theme
// script + JSON-LD + header), so this is the documented [block] escape hatch —
// same opt-out style as the admin pages. The layout's own config does not cover
// navigations whose boundary is this segment; each page under [locale] exports
// `instant = false` as well (that is what silences the dev validation). The
// routes are fully prerendered via generateStaticParams, so real users still
// get complete static HTML.
export const instant = false;

export async function generateMetadata(
  props: LayoutProps<"/[locale]">,
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: `${siteUrl}/${locale}`,
      languages: {
        en: `${siteUrl}/en`,
        bn: `${siteUrl}/bn`,
        "x-default": `${siteUrl}/en`,
      },
    },
    icons: {
      // Crisp vector mark; `src/app/favicon.ico` still covers legacy browsers.
      icon: [{ url: "/brand/logo-mark.svg", type: "image/svg+xml" }],
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations({ locale, namespace: "metadata" });

  // Site-wide Organization schema (plan 8 SEO). LocalBusiness/PostalAddress are
  // added at launch with the real address; a bare Organization with logo +
  // contact-point is safe now and lets Google build the entity graph early.
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: t("title"),
    url: siteUrl(`/${locale}`),
    logo: siteUrl("/brand/Logo black.png"),
    sameAs: publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER
      ? [
          `https://wa.me/${publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^\d]/g, "")}`,
        ]
      : undefined,
  };

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable}${
        locale === "bn" ? ` ${notoSerifBengali.variable}` : ""
      } h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {jsonLd(organization)}
        <ThemeScript />
        <ThemeProvider>
          {/* locale + messages are passed explicitly so the provider's server
              wrapper never has to await request data (it would fall back to
              reading the locale from headers) — keeps it resolution-free for
              locale-switch navigations. */}
          <NextIntlClientProvider locale={locale} messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
