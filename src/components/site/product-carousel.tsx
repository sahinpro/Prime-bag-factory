"use client";

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { useLocale, useTranslations } from "next-intl";
import { Children, useCallback, useEffect, useRef, useState } from "react";

import { IconCircleButton } from "@/components/site/icon-circle-button";

function formatCount(value: number, locale: string) {
  return new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-BD").format(value);
}

/**
 * Native scroll-snap rail. Prev/next move one tile. The counter and the
 * progress bar follow the scroll position. Reduced motion turns smoothing off.
 */
export function ProductCarousel({
  children,
  count,
  label,
}: {
  children: React.ReactNode;
  count: number;
  label: string;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(count <= 1 ? 1 : 0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(count <= 1);

  const sync = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max <= 1 ? 1 : el.scrollLeft / max);
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(max <= 1 || el.scrollLeft >= max - 1);

    const slides = [...el.querySelectorAll<HTMLElement>("[data-tile]")];
    const edge = el.getBoundingClientRect().left;
    let next = 0;
    slides.forEach((slide, i) => {
      if (slide.getBoundingClientRect().left - edge <= 8) next = i;
    });
    setIndex(Math.min(count - 1, Math.max(0, next)));
  }, [count]);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    sync();
    el.addEventListener("scroll", sync, { passive: true });
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", sync);
      observer.disconnect();
    };
  }, [sync]);

  function scrollByTile(direction: -1 | 1) {
    const el = scroller.current;
    const tile = el?.querySelector<HTMLElement>("[data-tile]");
    if (!el || !tile) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gap = 16;
    el.scrollBy({
      left: direction * (tile.offsetWidth + gap),
      behavior: reduce ? "auto" : "smooth",
    });
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className="flex min-w-0 flex-col gap-4"
    >
      <div
        ref={scroller}
        tabIndex={0}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1 motion-reduce:scroll-auto"
      >
        {Children.map(children, (child, i) => (
          <div
            data-tile
            className="w-[87%] shrink-0 snap-start md:w-[calc(50%-8px)] xl:w-[calc(33.333%-11px)]"
            key={i}
          >
            {child}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div
          className="h-0.5 min-w-0 flex-1 overflow-hidden rounded-full bg-border"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-foreground"
            style={{ width: `${Math.max(8, progress * 100)}%` }}
          />
        </div>
        <p className="type-secondary shrink-0 tabular-nums text-muted-foreground">
          {formatCount(index + 1, locale)} / {formatCount(count, locale)}
        </p>
        <IconCircleButton
          icon={ArrowLeft01Icon}
          label={t("previous")}
          size={44}
          disabled={atStart}
          className="disabled:opacity-40"
          onClick={() => scrollByTile(-1)}
        />
        <IconCircleButton
          icon={ArrowRight01Icon}
          label={t("next")}
          size={44}
          disabled={atEnd}
          className="disabled:opacity-40"
          onClick={() => scrollByTile(1)}
        />
      </div>
    </div>
  );
}
