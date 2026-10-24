"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/site/icon";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { HeaderCategory } from "@/components/site/header-category";
import { Link, usePathname } from "@/i18n/navigation";

const MEGA_ID = "site-mega-panel";

function categoryLabel(locale: string, c: HeaderCategory) {
  return locale === "bn" && c.name_bn && c.name_bn.trim() !== ""
    ? c.name_bn
    : c.name_en;
}

function navLinkClass(active: boolean) {
  return `inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 motion-reduce:transition-none ${
    active
      ? "bg-muted text-gold-text"
      : "text-foreground hover:bg-muted"
  }`;
}

export function HeaderNav({ categories }: { categories: HeaderCategory[] }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [megaOpen, setMegaOpen] = useState(false);
  const megaRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const homeActive = pathname === "/";
  const categoryActive = pathname.startsWith("/category");

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
    <nav
      aria-label={t("primaryNav")}
      className="hidden items-center gap-1 md:flex"
    >
      <Link
        href="/"
        aria-current={homeActive ? "page" : undefined}
        className={navLinkClass(homeActive)}
      >
        {t("home")}
      </Link>
      <div ref={megaRef} className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={megaOpen}
          aria-controls={MEGA_ID}
          aria-current={categoryActive ? "page" : undefined}
          onClick={() => setMegaOpen((o) => !o)}
          className={navLinkClass(categoryActive)}
        >
          {t("categories")}
          <Icon
            icon={ArrowDown01Icon}
            size={16}
            aria-hidden="true"
            className={`ml-1 transition-transform duration-150 motion-reduce:transition-none ${
              megaOpen ? "rotate-180" : ""
            }`}
          />
        </button>
        {megaOpen ? (
          <div
            id={MEGA_ID}
            role="region"
            aria-label={t("shopByCategory")}
            className="absolute left-0 top-full z-50 mt-2 w-[min(52rem,90vw)] rounded-card border border-border bg-surface p-5 shadow-lg"
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
                      {categoryLabel(locale, c)}
                    </Link>
                    {c.children.length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {c.children.map((child) => (
                          <li key={child.slug}>
                            <Link
                              href={`/category/${child.slug}`}
                              onClick={closeMega}
                              className="block min-h-11 py-2 text-sm text-muted-foreground hover:text-foreground"
                            >
                              {categoryLabel(locale, child)}
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
  );
}
