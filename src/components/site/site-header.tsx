"use client";

import { ChevronDown, Menu, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useEffect, useRef, useState } from "react";

import { LanguageSwitcher } from "@/components/site/language-switcher";
import { ThemeLogo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";

/**
 * A category node for the header mega-menu. Structurally identical to
 * `NavCategory` in `@/server/catalog`, re-declared here so this client component
 * never imports the server-only module.
 */
export type HeaderCategory = {
  slug: string;
  name_en: string;
  name_bn: string | null;
  children: HeaderCategory[];
};

const MEGA_ID = "site-mega-panel";

export function SiteHeader({ categories }: { categories: HeaderCategory[] }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const [megaOpen, setMegaOpen] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const label = (c: HeaderCategory) =>
    locale === "bn" && c.name_bn && c.name_bn.trim() !== ""
      ? c.name_bn
      : c.name_en;

  // Close the desktop mega panel on Escape (returning focus to the trigger) or
  // on any pointer press outside the panel group.
  useEffect(() => {
    if (!megaOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMegaOpen(false);
        triggerRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (megaRef.current && !megaRef.current.contains(event.target as Node)) {
        setMegaOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [megaOpen]);

  const closeMega = () => setMegaOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <ThemeLogo />

        {/* Desktop navigation with the mega-menu */}
        <nav
          aria-label={t("primaryNav")}
          className="hidden items-center gap-1 md:flex"
        >
          <Link
            href="/"
            className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            {t("home")}
          </Link>
          <div ref={megaRef} className="relative">
            <button
              ref={triggerRef}
              type="button"
              aria-expanded={megaOpen}
              aria-controls={MEGA_ID}
              onClick={() => setMegaOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              {t("categories")}
              <ChevronDown
                aria-hidden="true"
                strokeWidth={1.75}
                className={`size-4 transition-transform motion-reduce:transition-none ${
                  megaOpen ? "rotate-180" : ""
                }`}
              />
            </button>
            {megaOpen ? (
              <div
                id={MEGA_ID}
                role="region"
                aria-label={t("shopByCategory")}
                className="absolute left-0 top-full mt-2 w-[min(52rem,90vw)] rounded-card border border-border bg-surface p-5 shadow-lg"
              >
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("noCategories")}
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
                    {categories.map((c) => (
                      <li key={c.slug}>
                        <Link
                          href={`/category/${c.slug}`}
                          onClick={closeMega}
                          className="text-sm font-semibold text-gold-text hover:underline"
                        >
                          {label(c)}
                        </Link>
                        {c.children.length > 0 ? (
                          <ul className="mt-2 space-y-1.5">
                            {c.children.map((child) => (
                              <li key={child.slug}>
                                <Link
                                  href={`/category/${child.slug}`}
                                  onClick={closeMega}
                                  className="block text-sm text-muted-foreground hover:text-foreground"
                                >
                                  {label(child)}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/search" aria-label={t("search")}>
              <Search
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-5"
              />
            </Link>
          </Button>

          <Button size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/quote">{t("quote")}</Link>
          </Button>

          <Suspense fallback={null}>
            <LanguageSwitcher />
          </Suspense>
          <ThemeToggle />

          {/* Mobile navigation */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label={t("openMenu")}
              >
                <Menu
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-5"
                />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[min(20rem,85vw)] flex-col gap-0 overflow-y-auto"
            >
              <SheetHeader>
                <SheetTitle>{t("categories")}</SheetTitle>
              </SheetHeader>
              <nav
                aria-label={t("primaryNav")}
                className="mt-4 flex flex-col gap-1"
              >
                <SheetClose asChild>
                  <Link
                    href="/"
                    className="rounded-md px-3 py-2 text-base font-medium hover:bg-muted"
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
                          className="block rounded-md px-3 py-2 text-base font-semibold text-gold-text hover:bg-muted"
                        >
                          {label(c)}
                        </Link>
                      </SheetClose>
                      {c.children.length > 0 ? (
                        <ul className="mt-1 space-y-0.5 pl-3">
                          {c.children.map((child) => (
                            <li key={child.slug}>
                              <SheetClose asChild>
                                <Link
                                  href={`/category/${child.slug}`}
                                  className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                  {label(child)}
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
                  <Link
                    href="/search"
                    className="rounded-md px-3 py-2 text-base font-medium hover:bg-muted"
                  >
                    {t("search")}
                  </Link>
                </SheetClose>
                <div className="mt-3 px-3">
                  <SheetClose asChild>
                    <Button asChild className="w-full">
                      <Link href="/quote">{t("quote")}</Link>
                    </Button>
                  </SheetClose>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
