import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { CheckoutForm } from "@/components/site/checkout-form";
import { isLocale, type Locale } from "@/i18n/routing";
import { getCheckoutFlags, listShippingZones } from "@/server/checkout";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l: Locale = isLocale(locale) ? locale : "en";
  const t = await getTranslations({ locale: l, namespace: "checkout" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  setRequestLocale(locale);

  // Zone fees and the commerce feature flags are money and config: they are read
  // per request and never served from a prerendered shell (plan 3b marks cart,
  // checkout and order lookup as dynamic).
  await connection();

  const t = await getTranslations({ locale, namespace: "checkout" });
  const [flags, zones] = await Promise.all([
    getCheckoutFlags(),
    listShippingZones(),
  ]);

  if (flags.maintenance_mode || !flags.checkout_enabled) {
    return (
      <main
        id="main"
        className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10"
      >
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="rounded-card border bg-surface p-6 text-muted-foreground">
          {t("closed")}
        </p>
      </main>
    );
  }

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-10"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("intro")}</p>
      </div>
      <CheckoutForm zones={zones} />
    </main>
  );
}
