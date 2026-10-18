"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/site/theme-provider";
import { Button } from "@/components/ui/button";

/**
 * Admin theme toggle. Deliberately translation-free (admin is English and lives
 * outside the `[locale]` / NextIntlClientProvider tree). Shows only the active
 * icon; clicking switches to the other theme. Mirrors the public site control.
 */
export function AdminThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? (
        <Sun aria-hidden="true" strokeWidth={1.75} className="size-4" />
      ) : (
        <Moon aria-hidden="true" strokeWidth={1.75} className="size-4" />
      )}
    </Button>
  );
}
