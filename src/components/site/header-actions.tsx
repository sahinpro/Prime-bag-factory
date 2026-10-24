"use client";

import {
  Cancel01Icon,
  Menu01Icon,
  Search01Icon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { Icon } from "@/components/site/icon";
import { useLocale, useTranslations } from "next-intl";
import { Suspense } from "react";

import { CartLink } from "@/components/site/cart-link";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import type { HeaderCategory } from "@/components/site/header-category";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link, usePathname } from "@/i18n/navigation";

function categoryLabel(locale: string, c: HeaderCategory) {
  return locale === "bn" && c.name_bn && c.name_bn.trim() !== ""
    ? c.name_bn
    : c.name_en;
}

function sheetLinkClass(active: boolean) {
  return `flex min-h-11 items-center rounded-md px-3 py-2 text-base font-medium hover:bg-muted ${
    active ? "bg-muted text-gold-text" : ""
  }`;
}

export function HeaderActions({
  categories,
  whatsappHref,
}: {
  categories: HeaderCategory[];
  whatsappHref: string | null;
}) {
  const t = useTranslations("nav");
  const contact = useTranslations("contact");
  const locale = useLocale();
  const pathname = usePathname();
  const quoteActive = pathname === "/quote";

  return (
    <div className="ml-auto flex items-center gap-1">
      <Button variant="ghost" size="icon" asChild>
        <Link href="/search" aria-label={t("search")}>
          <Icon icon={Search01Icon} size={20} aria-hidden="true" />
        </Link>
      </Button>

      <CartLink />

      {whatsappHref ? (
        <Button variant="ghost" size="icon" asChild className="hidden sm:inline-flex">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={contact("whatsapp")}
          >
            <Icon icon={WhatsappIcon} size={20} aria-hidden="true" />
          </a>
        </Button>
      ) : null}

      <Button
        asChild
        className="hidden min-h-11 px-4 md:inline-flex"
        data-header-cta=""
      >
        <Link
          href="/quote"
          aria-current={quoteActive ? "page" : undefined}
        >
          {t("getQuote")}
        </Link>
      </Button>

      <Suspense fallback={<span className="inline-block size-8 shrink-0" />}>
        <LanguageSwitcher />
      </Suspense>
      <span className="inline-flex size-8 shrink-0 items-center justify-center">
        <ThemeToggle />
      </span>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={t("openMenu")}
          >
            <Icon icon={Menu01Icon} size={20} aria-hidden="true" />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="flex h-full w-[min(22rem,100vw)] flex-col gap-0 overflow-y-auto p-0"
        >
          <SheetHeader className="flex-row items-center justify-between border-b border-border">
            <SheetTitle>{t("menu")}</SheetTitle>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("closeMenu")}
              >
                <Icon icon={Cancel01Icon} size={20} aria-hidden="true" />
              </Button>
            </SheetClose>
          </SheetHeader>
          <nav
            aria-label={t("primaryNav")}
            className="flex flex-1 flex-col gap-1 overflow-y-auto p-4"
          >
            <SheetClose asChild>
              <Link
                href="/"
                aria-current={pathname === "/" ? "page" : undefined}
                className={sheetLinkClass(pathname === "/")}
              >
                {t("home")}
              </Link>
            </SheetClose>
            {categories.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {t("noCategories")}
              </p>
            ) : (
              categories.map((c) => (
                <div key={c.slug} className="py-1">
                  <SheetClose asChild>
                    <Link
                      href={`/category/${c.slug}`}
                      className="flex min-h-11 items-center rounded-md px-3 py-2 text-base font-semibold text-gold-text hover:bg-muted"
                    >
                      {categoryLabel(locale, c)}
                    </Link>
                  </SheetClose>
                  {c.children.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 pl-3">
                      {c.children.map((child) => (
                        <li key={child.slug}>
                          <SheetClose asChild>
                            <Link
                              href={`/category/${child.slug}`}
                              className="flex min-h-11 items-center rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              {categoryLabel(locale, child)}
                            </Link>
                          </SheetClose>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))
            )}
            <SheetClose asChild>
              <Link href="/search" className={sheetLinkClass(pathname === "/search")}>
                {t("search")}
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link href="/cart" className={sheetLinkClass(pathname === "/cart")}>
                {t("cart")}
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Link
                href="/builder"
                className={sheetLinkClass(pathname === "/builder")}
              >
                {t("builder")}
              </Link>
            </SheetClose>
          </nav>
          <SheetFooter className="border-t border-border">
            {whatsappHref ? (
              <SheetClose asChild>
                <Button variant="outline" asChild className="min-h-11 w-full">
                  <a
                    href={whatsappHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon icon={WhatsappIcon} size={16} aria-hidden="true" />
                    {contact("whatsapp")}
                  </a>
                </Button>
              </SheetClose>
            ) : null}
            <SheetClose asChild>
              <Button asChild className="min-h-11 w-full" data-header-cta="">
                <Link href="/quote">{t("getQuote")}</Link>
              </Button>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
