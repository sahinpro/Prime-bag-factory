"use client";

import {
  Call02Icon,
  Cancel01Icon,
  Menu01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { useLocale, useTranslations } from "next-intl";
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

import { CartLink } from "@/components/site/cart-link";
import { Icon } from "@/components/site/icon";
import { IconCircleButton } from "@/components/site/icon-circle-button";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { PillButton } from "@/components/site/pill-button";
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
import { Link, usePathname } from "@/i18n/navigation";

function SearchForm({
  locale,
  className,
  inputId,
}: {
  locale: string;
  className?: string;
  inputId: string;
}) {
  const t = useTranslations("header");
  const nav = useTranslations("nav");
  return (
    <form
      action={`/${locale}/search`}
      className={`flex h-10 items-center gap-1 rounded-full bg-surface-2 pr-3 pl-1 focus-within:ring-2 focus-within:ring-ring ${className ?? ""}`}
    >
      <button
        type="submit"
        aria-label={nav("search")}
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-ivory"
      >
        <Icon icon={Search01Icon} size={16} />
      </button>
      <label htmlFor={inputId} className="sr-only">
        {t("searchPlaceholder")}
      </label>
      <input
        id={inputId}
        name="q"
        type="search"
        placeholder={t("searchPlaceholder")}
        className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
      />
    </form>
  );
}

export function HeaderActions({
  phone,
  sheetCatalog,
}: {
  phone: string | null;
  whatsappHref: string | null;
  sheetCatalog: React.ReactNode;
}) {
  const t = useTranslations("header");
  const nav = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchId = useId();
  const dialogSearchId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const tel = phone?.replace(/[^\d+]/g, "") ?? "";
  const quoteActive = pathname === "/quote";

  useEffect(() => {
    if (!searchOpen) return;
    const panel = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              "a[href], button:not([disabled]), input:not([disabled])",
            ),
          )
        : [];
    panel?.querySelector("input")?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSearch();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [searchOpen, closeSearch]);

  return (
    <div className="ml-auto flex items-center gap-2">
      <SearchForm
        locale={locale}
        inputId={searchId}
        className="hidden w-55 xl:flex"
      />
      <IconCircleButton
        icon={Search01Icon}
        label={nav("search")}
        size={40}
        tone="surface"
        className="xl:hidden"
        onClick={() => setSearchOpen(true)}
      />

      {tel ? (
        <a
          href={`tel:${tel}`}
          aria-label={t("call", { number: phone ?? tel })}
          className="hidden size-10 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring xl:inline-flex"
        >
          <Icon icon={Call02Icon} size={18} />
        </a>
      ) : null}

      <PillButton
        href="/quote"
        data-header-cta=""
        aria-current={quoteActive ? "page" : undefined}
        className="hidden lg:inline-flex"
      >
        {nav("getQuote")}
      </PillButton>

      <CartLink />

      <div className="hidden items-center gap-1 lg:flex">
        <Suspense fallback={<span className="inline-block size-8 shrink-0" />}>
          <LanguageSwitcher />
        </Suspense>
        <span className="inline-flex size-8 shrink-0 items-center justify-center">
          <ThemeToggle />
        </span>
      </div>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-10 lg:hidden"
            aria-label={nav("openMenu")}
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
            <SheetTitle>{nav("menu")}</SheetTitle>
            <SheetClose asChild>
              <Button variant="ghost" size="icon" aria-label={nav("closeMenu")}>
                <Icon icon={Cancel01Icon} size={20} aria-hidden="true" />
              </Button>
            </SheetClose>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            <SearchForm
              locale={locale}
              inputId={dialogSearchId}
              className="w-full"
            />
            <nav aria-label={nav("primaryNav")} className="flex flex-col">
              {sheetCatalog}
              <SheetClose asChild>
                <Link
                  href="/builder"
                  aria-current={pathname === "/builder" ? "page" : undefined}
                  className="flex min-h-11 items-center border-b border-border px-3 font-medium text-foreground"
                >
                  {t("buildYourBag")}
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/about"
                  aria-current={pathname === "/about" ? "page" : undefined}
                  className="flex min-h-11 items-center border-b border-border px-3 font-medium text-foreground"
                >
                  {nav("about")}
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link
                  href="/contact"
                  aria-current={pathname === "/contact" ? "page" : undefined}
                  className="flex min-h-11 items-center border-b border-border px-3 font-medium text-foreground"
                >
                  {nav("contact")}
                </Link>
              </SheetClose>
            </nav>
            <SheetClose asChild>
              <PillButton href="/quote" data-header-cta="" className="w-full">
                {nav("getQuote")}
              </PillButton>
            </SheetClose>

            <div className="mt-auto flex items-center gap-2">
              <Suspense
                fallback={<span className="inline-block size-8 shrink-0" />}
              >
                <LanguageSwitcher />
              </Suspense>
              <span className="inline-flex size-8 shrink-0 items-center justify-center">
                <ThemeToggle />
              </span>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {searchOpen ? (
        <div
          className="fixed inset-0 z-50 bg-ink/40 px-4 pt-20"
          onClick={closeSearch}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t("searchDialog")}
            onClick={(event) => event.stopPropagation()}
            className="mx-auto w-full max-w-md"
          >
            <SearchForm
              locale={locale}
              inputId={`${dialogSearchId}-dialog`}
              className="w-full bg-surface"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
