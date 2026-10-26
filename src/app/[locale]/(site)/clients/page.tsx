import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { Media } from "@/components/site/media";
import { isLocale, type Locale } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";
import { listClients } from "@/server/content";
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
  const t = await getTranslations({ locale, namespace: "clients" });
  return buildMetadata({
    locale,
    path: `/${locale}/clients`,
    title: t("title"),
    description: t("intro"),
  });
}

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const l = locale as Locale;
  const [t, clients] = await Promise.all([
    getTranslations({ locale: l, namespace: "clients" }),
    listClients(),
  ]);

  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10"
    >
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
      </header>

      {clients.length > 0 ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {clients.map((client) => (
            <li
              key={client.id}
              className="flex items-center justify-center rounded-card border bg-surface p-4"
            >
              <span className="sr-only">{client.name}</span>
              <Media
                src={client.logo_path}
                alt={client.name}
                sizes="(min-width: 768px) 25vw, 50vw"
                className="aspect-4/3 w-full"
                imgClassName="object-contain"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-card border bg-surface-2 p-8 text-center text-muted-foreground">
          {t("empty")}
        </p>
      )}
    </main>
  );
}
