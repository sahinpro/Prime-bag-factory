import { WhatsappIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/site/icon";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { isLocale, type Locale } from "@/i18n/routing";
import { publicEnv } from "@/lib/env";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: "contactPage" });
  return buildMetadata({
    locale,
    path: `/${locale}/contact`,
    title: t("title"),
    description: t("intro"),
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const l = locale as Locale;
  const [t, footer] = await Promise.all([
    getTranslations({ locale: l, namespace: "contactPage" }),
    getTranslations({ locale: l, namespace: "footer" }),
  ]);

  const wa = publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^\d]/g, "");

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      <div className="flex flex-col gap-4 rounded-card border bg-surface p-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("whatsappLabel")}</span>
          <Button asChild className="w-fit">
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon icon={WhatsappIcon} size={16} aria-hidden="true" />
              {t("whatsappLabel")}
            </a>
          </Button>
        </div>

        <address className="not-italic">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium">{t("addressLabel")}</span>
            <span className="text-muted-foreground">{footer("address")}</span>
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <span className="text-sm font-medium">{t("hoursLabel")}</span>
            <span className="text-muted-foreground">{t("hours")}</span>
          </div>
        </address>

        <Button variant="outline" asChild className="w-fit">
          <Link href="/quote" locale={l}>
            {t("title")}
          </Link>
        </Button>
      </div>
    </main>
  );
}
