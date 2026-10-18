import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CartView } from "@/components/site/cart-view";
import { isLocale, type Locale } from "@/i18n/routing";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : "en";
  const t = await getTranslations({ locale: l, namespace: "cart" });
  return {
    // The cart is personal, session-ish state — never index it (plan 8 SEO).
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

export default async function CartPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "cart" });

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10"
    >
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <CartView />
    </main>
  );
}
