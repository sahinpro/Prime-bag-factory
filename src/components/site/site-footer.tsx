import {
  ArrowDown01Icon,
  Call02Icon,
  Facebook02Icon,
  InstagramIcon,
  Linkedin02Icon,
  Location01Icon,
  Mail01Icon,
  WhatsappIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import { Icon } from "@/components/site/icon";
import { getTranslations } from "next-intl/server";

import type { HeaderCategory } from "@/components/site/header-category";
import { Logo } from "@/components/site/logo";
import { YearStamp } from "@/components/site/year-stamp";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import type { PublicCompany } from "@/server/public-settings";
import { whatsappHref } from "@/server/public-settings";

type FooterLink = { href: string; label: string };

function FooterNav({
  title,
  links,
  locale,
}: {
  title: string;
  links: FooterLink[];
  locale: string;
}) {
  return (
    <nav aria-label={title} className="space-y-3">
      <h2 className="text-base font-semibold text-ivory">{title}</h2>
      <ul className="space-y-2">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              locale={locale}
              className="text-base text-ivory/80 transition-colors duration-150 hover:text-ivory motion-reduce:transition-none"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FooterAccordion({
  title,
  links,
  locale,
}: {
  title: string;
  links: FooterLink[];
  locale: string;
}) {
  return (
    <details className="group border-b border-ivory/20">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-base font-semibold text-ivory [&::-webkit-details-marker]:hidden">
        {title}
        <Icon
          icon={ArrowDown01Icon}
          size={16}
          aria-hidden="true"
          className="transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <ul className="space-y-1 pb-3">
        {links.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              locale={locale}
              className="flex min-h-11 items-center text-base text-ivory/80 hover:text-ivory"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

export async function SiteFooter({
  locale,
  categories,
  company,
}: {
  locale: string;
  categories: HeaderCategory[];
  company: PublicCompany;
}) {
  const t = await getTranslations({ locale, namespace: "footer" });
  const nav = await getTranslations({ locale, namespace: "nav" });
  const hoursT = await getTranslations({ locale, namespace: "contactPage" });
  const siteName = company.name;
  const wa = whatsappHref(company.whatsapp);
  const address = company.address || t("address");
  const hours = company.hours || hoursT("hours");

  const shop: FooterLink[] = [
    ...categories.slice(0, 6).map((c) => ({
      href: `/category/${c.slug}`,
      label:
        locale === "bn" && c.name_bn && c.name_bn.trim() !== ""
          ? c.name_bn
          : c.name_en,
    })),
    { href: "/quote", label: nav("getQuote") },
    { href: "/builder", label: nav("builder") },
    { href: "/order/lookup", label: nav("orderLookup") },
  ];

  const companyLinks: FooterLink[] = [
    { href: "/about", label: nav("about") },
    { href: "/clients", label: nav("clients") },
    { href: "/faq", label: nav("faq") },
    { href: "/contact", label: nav("contact") },
  ];

  const legal: FooterLink[] = [
    { href: "/terms", label: t("terms") },
    { href: "/privacy", label: t("privacy") },
    { href: "/returns", label: t("returns") },
    { href: "/shipping", label: t("shipping") },
    { href: "/custom-order", label: t("customOrder") },
  ];

  const social = (
    [
      { href: company.facebook, label: t("facebook"), icon: Facebook02Icon },
      { href: company.instagram, label: t("instagram"), icon: InstagramIcon },
      { href: company.youtube, label: t("youtube"), icon: YoutubeIcon },
      { href: company.linkedin, label: t("linkedin"), icon: Linkedin02Icon },
    ] as const
  ).filter((s) => s.href);

  return (
    <footer className="mt-auto bg-ink text-ivory">
      <div className="mx-auto container px-4 pt-12">
        <div className="hidden gap-10 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-4 sm:col-span-2 lg:col-span-1">
            <Link href="/" locale={locale} aria-label={siteName}>
              <Logo
                variant="dark"
                alt={siteName}
                className="h-auto max-w-40"
              />
            </Link>
            <p className="max-w-sm text-base text-ivory/80">{t("tagline")}</p>
            {social.length > 0 ? (
              <ul className="flex flex-wrap gap-2" aria-label={t("social")}>
                {social.map(({ href, label, icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="inline-flex size-11 items-center justify-center rounded-md text-ivory/80 hover:bg-ivory/10 hover:text-ivory"
                    >
                      <Icon icon={icon} size={16} />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <FooterNav title={t("shop")} links={shop} locale={locale} />
          <FooterNav title={t("company")} links={companyLinks} locale={locale} />
          <FooterNav title={t("legal")} links={legal} locale={locale} />
        </div>

        <div className="sm:hidden">
          <Link href="/" locale={locale} aria-label={siteName}>
            <Logo variant="dark" alt={siteName} className="h-auto max-w-40" />
          </Link>
          <p className="mt-4 text-base text-ivory/80">{t("tagline")}</p>
          {social.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label={t("social")}>
              {social.map(({ href, label, icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="inline-flex size-11 items-center justify-center rounded-md text-ivory/80 hover:bg-ivory/10 hover:text-ivory"
                  >
                    <Icon icon={icon} size={16} />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-6">
            <FooterAccordion title={t("shop")} links={shop} locale={locale} />
            <FooterAccordion
              title={t("company")}
              links={companyLinks}
              locale={locale}
            />
            <FooterAccordion title={t("legal")} links={legal} locale={locale} />
          </div>
        </div>

        <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3 sm:col-span-2">
            <h2 className="text-base font-semibold text-ivory">
              {t("getInTouch")}
            </h2>
            <address className="space-y-2 text-base text-ivory/80 not-italic">
              {company.phone ? (
                <p className="flex min-h-11 items-center gap-2">
                  <Icon
                    icon={Call02Icon}
                    size={16}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  <a href={`tel:${company.phone}`} className="hover:text-ivory">
                    <span className="sr-only">{t("phone")}: </span>
                    {company.phone}
                  </a>
                </p>
              ) : null}
              {wa ? (
                <p className="flex min-h-11 items-center gap-2">
                  <Icon
                    icon={WhatsappIcon}
                    size={16}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-ivory"
                  >
                    {company.whatsapp}
                  </a>
                </p>
              ) : null}
              {company.email ? (
                <p className="flex min-h-11 items-center gap-2">
                  <Icon
                    icon={Mail01Icon}
                    size={16}
                    aria-hidden="true"
                    className="shrink-0"
                  />
                  <a
                    href={`mailto:${company.email}`}
                    className="hover:text-ivory"
                  >
                    <span className="sr-only">{t("email")}: </span>
                    {company.email}
                  </a>
                </p>
              ) : null}
              {address ? (
                <p className="flex items-start gap-2">
                  <Icon
                    icon={Location01Icon}
                    size={16}
                    aria-hidden="true"
                    className="mt-1 shrink-0"
                  />
                  <span>
                    <span className="sr-only">{t("addressLabel")}: </span>
                    {address}
                  </span>
                </p>
              ) : null}
              {hours ? (
                <p>
                  <span className="font-medium text-ivory">{t("hours")}: </span>
                  {hours}
                </p>
              ) : null}
            </address>
          </div>
          <p className="text-base text-ivory/80 sm:col-span-2">
            {t("paymentNote")}
          </p>
        </div>

        <Separator className="mt-10 bg-ivory/20" />
        <p className="pb-24 pt-6 text-base text-ivory/80 md:pb-8">
          © <YearStamp /> {siteName}. {t("rights")}
        </p>
      </div>
    </footer>
  );
}
