"use client";

import { useTranslations } from "next-intl";
import { useId, useSyncExternalStore } from "react";

import { useTheme } from "@/components/site/theme-provider";

function useIsDark() {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
      return () => observer.disconnect();
    },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

export function ThemeToggle() {
  const t = useTranslations("theme");
  const { setTheme } = useTheme();
  const isDark = useIsDark();
  const maskId = useId().replace(/:/g, "");

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={t(isDark ? "switchToLight" : "switchToDark")}
      className="theme-toggle inline-flex size-8 shrink-0 items-center justify-center rounded-full text-foreground"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4 cursor-pointer"
        style={{ transform: `rotate(${isDark ? 40 : 0}deg)` }}
      >
        <mask id={maskId}>
          <rect x="0" y="0" width="24" height="24" fill="white" />
          {/* The carving circle slides in from the corner to bite the moon crescent. */}
          <circle
            r="8"
            fill="black"
            style={{ cx: isDark ? 18 : 25, cy: isDark ? 6 : 0 }}
          />
        </mask>

        <circle
          cx="12"
          cy="12"
          fill="currentColor"
          mask={`url(#${maskId})`}
          className="theme-toggle-core"
          style={{ r: isDark ? 8 : 5 }}
        />

        <g
          stroke="currentColor"
          className="theme-toggle-rays"
          style={{
            opacity: isDark ? 0 : 1,
            transform: `scale(${isDark ? 0.3 : 1})`,
          }}
        >
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </g>
      </svg>
    </button>
  );
}
