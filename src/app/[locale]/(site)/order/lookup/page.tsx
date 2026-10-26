import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { OrderLookup } from "@/components/site/order-status";
import { isLocale, type Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";
// Public locale pages sit under the [locale] segment, which next-intl reads above
// every page (root layout + provider). Navigations into this route may block on
// that URL data; the route is fully prerendered via generateStaticParams. See
// src/app/[locale]/layout.tsx for the full rationale.
export const instant = false;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "order" });
  return buildMetadata({
    locale,
    path: `/${locale}/order/lookup`,
    title: t("title"),
    description: t("subtitle"),
  });
}

export default async function OrderLookupPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const l = locale as Locale;
  const t = await getTranslations({ locale: l, namespace: "order" });

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <OrderLookup orderNo="" />
    </main>
  );
}
