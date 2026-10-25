"use client";

import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { Icon } from "@/components/site/icon";
import { Link, usePathname } from "@/i18n/navigation";

function itemClass(active: boolean) {
  return `inline-flex min-h-11 items-center gap-1 whitespace-nowrap px-2 text-sm font-medium text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
    active
      ? "underline decoration-gold-text decoration-2 underline-offset-8"
      : ""
  }`;
}

export function HeaderNav({
  shopPanel,
  industriesPanel,
}: {
  shopPanel: React.ReactNode;
  industriesPanel: React.ReactNode;
}) {
  const t = useTranslations("header");
  const nav = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState<"shop" | "industries" | null>(null);
  const rootRef = useRef<HTMLElement>(null);
  const shopId = useId();
  const industryId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(null);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const panelId = open === "shop" ? shopId : industryId;
  const panelLabel = open === "shop" ? t("shop") : t("industries");

  return (
    <nav
      ref={rootRef}
      aria-label={nav("primaryNav")}
      className="hidden h-full min-w-0 items-center lg:flex"
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(null);
      }}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node)) {
          setOpen(null);
        }
      }}
    >
      <MenuButton
        id={shopId}
        label={t("shop")}
        open={open === "shop"}
        active={pathname.startsWith("/category")}
        onToggle={() => setOpen((value) => (value === "shop" ? null : "shop"))}
        onOpen={() => setOpen("shop")}
      />
      <MenuButton
        id={industryId}
        label={t("industries")}
        open={open === "industries"}
        active={pathname.startsWith("/collection")}
        onToggle={() =>
          setOpen((value) => (value === "industries" ? null : "industries"))
        }
        onOpen={() => setOpen("industries")}
      />
      <Link
        href="/builder"
        aria-current={pathname === "/builder" ? "page" : undefined}
        className={itemClass(pathname === "/builder")}
      >
        {t("buildYourBag")}
      </Link>
      <Link
        href="/about"
        aria-current={pathname === "/about" ? "page" : undefined}
        className={itemClass(pathname === "/about")}
      >
        {nav("about")}
      </Link>
      <Link
        href="/contact"
        aria-current={pathname === "/contact" ? "page" : undefined}
        className={itemClass(pathname === "/contact")}
      >
        {nav("contact")}
      </Link>
      {open ? (
        <div className="fixed inset-x-0 top-16 z-40 px-4 md:px-6 lg:px-8">
          <div
            id={panelId}
            role="region"
            aria-label={panelLabel}
            className="container mx-auto rounded-b-[var(--radius-panel)] bg-surface p-6 shadow-md dark:border dark:border-border dark:shadow-none"
          >
            {open === "shop" ? shopPanel : industriesPanel}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

function MenuButton({
  id,
  label,
  open,
  active,
  onToggle,
  onOpen,
}: {
  id: string;
  label: string;
  open: boolean;
  active: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className="flex items-center"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") onOpen();
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-current={active ? "page" : undefined}
        onClick={onToggle}
        className={itemClass(active)}
      >
        {label}
        <Icon
          icon={ArrowDown01Icon}
          size={16}
          className={`transition-transform duration-150 motion-reduce:transition-none ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
    </div>
  );
}
