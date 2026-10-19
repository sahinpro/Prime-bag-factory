import { getTranslations } from "next-intl/server";

import { YearStamp } from "@/components/site/year-stamp";
import { Link } from "@/i18n/navigation";
import { publicEnv } from "@/lib/env";

/**
 * Public site footer (plan §8). Kept to destinations that exist now: an Explore
 * column (home / search / quote) and a Get-in-touch block. The policy/legal and
 * Company columns arrive with the static pages in the same phase (Task 6) so we
 * never ship a link to a page that does not exist yet.
 */
export async function SiteFooter({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: "footer" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const contact = await getTranslations({ locale, namespace: "contact" });
  const siteName = (await getTranslations({ locale, namespace: "metadata" }))(
    "title",
  );
  const digits = publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/[^\d]/g, "");

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto grid container gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <p className="text-base font-semibold text-foreground">{siteName}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {t("tagline")}
          </p>
        </div>

        <nav aria-label={t("explore")} className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("explore")}
          </h2>
          <ul className="space-y-2">
            <li>
              <Link
                href="/"
                locale={locale}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {nav("home")}
              </Link>
            </li>
            <li>
              <Link
                href="/search"
                locale={locale}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {nav("search")}
              </Link>
            </li>
            <li>
              <Link
                href="/quote"
                locale={locale}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                {nav("quote")}
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label={t("company")} className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("company")}
          </h2>
          <ul className="space-y-2">
            {(
              [
                ["/about", nav("about")],
                ["/clients", nav("clients")],
                ["/faq", nav("faq")],
                ["/legal", nav("legal")],
                ["/contact", nav("contact")],
              ] as const
            ).map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href}
                  locale={locale}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("getInTouch")}
          </h2>
          <address className="space-y-2 text-sm text-muted-foreground not-italic">
            <p>
              <span className="font-medium text-foreground">
                {t("phone")}:{" "}
              </span>
              <a
                href={`https://wa.me/${digits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground"
              >
                {publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER}
              </a>
            </p>
            <p>
              <span className="font-medium text-foreground">
                {t("addressLabel")}:{" "}
              </span>
              {t("address")}
            </p>
          </address>
          <p className="sr-only">{contact("whatsapp")}</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-8 text-sm text-muted-foreground">
        © <YearStamp /> {siteName}. {t("rights")}
      </div>
    </footer>
  );
}
