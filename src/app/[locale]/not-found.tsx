import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { Compass01Icon, Home01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/site/icon";

// Localized public 404 (plan §15 D3 / R8). Renders inside the [locale] layout,
// so the Bangla font + 18px floor apply. The content sits in <main> so the
// html[lang="bn"] main type rules cover it even though the (site) chrome is not
// present on a 404. not-found boundaries receive no props, so the locale comes
// from the active request context the layout already set.
export default async function LocaleNotFound() {
  const t = await getTranslations("errors.notFound");

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-muted-foreground">
        <Icon icon={Compass01Icon} size={24} aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">{t("title")}</h1>
        <p className="mx-auto max-w-md text-base text-muted-foreground">
          {t("description")}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:bg-brand-hover"
        >
          <Icon icon={Home01Icon} size={16} aria-hidden="true" />
          {t("home")}
        </Link>
        <Link
          href="/search"
          className="inline-flex items-center rounded-lg border border-border px-4 py-2 text-base font-medium text-foreground hover:bg-muted"
        >
          {t("browse")}
        </Link>
      </div>
    </main>
  );
}
