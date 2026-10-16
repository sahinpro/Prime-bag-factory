/* eslint-disable react-hooks/refs */
"use client";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { useId, useRef, useSyncExternalStore } from "react";

import { useTheme } from "@/components/site/theme-provider";

const spring = { type: "spring", stiffness: 220, damping: 15 } as const;

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
  const reduceMotion = useReducedMotion();
  const hasToggled = useRef(false);
  const maskId = useId().replace(/:/g, "");
  const transition =
    hasToggled.current && !reduceMotion ? spring : { duration: 0 };

  return (
    <button
      type="button"
      onClick={() => {
        hasToggled.current = true;
        setTheme(isDark ? "light" : "dark");
      }}
      aria-label={t(isDark ? "switchToLight" : "switchToDark")}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-foreground"
    >
      <motion.svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4 cursor-pointer"
        animate={{ rotate: isDark ? 40 : 0 }}
        transition={transition}
      >
        <mask id={maskId}>
          <rect x="0" y="0" width="24" height="24" fill="white" />
          <motion.circle
            cx="25"
            cy="0"
            r="8"
            fill="black"
            animate={{
              cx: isDark ? 18 : 25,
              cy: isDark ? 6 : 0,
            }}
            transition={transition}
          />
        </mask>

        <motion.circle
          cx="12"
          cy="12"
          r="9"
          fill="currentColor"
          mask={`url(#${maskId})`}
          animate={{ r: isDark ? 8 : 5 }}
          transition={transition}
        />

        <motion.g
          stroke="currentColor"
          animate={{
            opacity: isDark ? 0 : 1,
            scale: isDark ? 0.3 : 1,
          }}
          transition={transition}
        >
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </motion.g>
      </motion.svg>
    </button>
  );
}
