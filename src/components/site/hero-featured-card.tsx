"use client";

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { IconCircleButton } from "@/components/site/icon-circle-button";
import { Link } from "@/i18n/navigation";

export type HeroFeaturedItem = {
  title: string;
  href: string;
  cta: string;
  thumbnail: string | null;
};

/**
 * Cycles featured products inside the hero. The hero photo stays put.
 * No auto-advance. A polite live region announces the current name.
 */
export function HeroFeaturedCard({ items }: { items: HeroFeaturedItem[] }) {
  const t = useTranslations("home");
  const [index, setIndex] = useState(0);
  if (items.length === 0) return null;

  const item = items[Math.min(index, items.length - 1)]!;
  const many = items.length > 1;

  return (
    <div className="hero-card-rise backdrop-blur-sm border border-l-white/20 border-t-white/20 border-r-white/30 border-b-white/30 bg-white/30 flex items-center gap-3 rounded-card p-3">
      <div className="bg-white/80 relative size-14 shrink-0 overflow-hidden rounded-lg">
        {item.thumbnail ? (
          <Image
            src={item.thumbnail}
            alt=""
            width={56}
            height={56}
            className="size-14 object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="type-card-title truncate text-white" aria-live="polite">
          {item.title}
        </p>
        <Link
          href={item.href}
          className="type-secondary font-medium text-white underline underline-offset-4"
        >
          {item.cta}
        </Link>
      </div>
      {many ? (
        <div className="flex shrink-0 gap-1">
          <IconCircleButton
            icon={ArrowLeft01Icon}
            label={t("previous")}
            size={44}
            tone="ghost"
            disabled={index === 0}
            className="text-white hover:bg-white/15 disabled:opacity-40"
            onClick={() => setIndex((current) => Math.max(0, current - 1))}
          />
          <IconCircleButton
            icon={ArrowRight01Icon}
            label={t("next")}
            size={44}
            tone="ghost"
            disabled={index >= items.length - 1}
            className="text-white hover:bg-white/15 disabled:opacity-40"
            onClick={() =>
              setIndex((current) => Math.min(items.length - 1, current + 1))
            }
          />
        </div>
      ) : null}
    </div>
  );
}
