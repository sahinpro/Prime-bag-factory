import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { Inter, Noto_Serif_Bengali } from "next/font/google";
import { notFound } from "next/navigation";

import { ThemeProvider } from "@/components/site/theme-provider";
import { ThemeScript } from "@/components/site/theme-script";
import { isLocale, routing } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { jsonLd, siteUrl } from "@/lib/seo";

import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const notoSerifBengali = Noto_Serif_Bengali({
  subsets: ["bengali"],
  variable: "--font-bn",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

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
      icon: "/brand/favicon-source.svg",
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
      className={`${inter.variable} ${notoSerifBengali.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        {jsonLd(organization)}
        <ThemeScript />
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            {children}
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
