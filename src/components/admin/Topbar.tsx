"use client";

import Link from "next/link";
import { Bell, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "@/components/site/theme-provider";

export default function Topbar({ title }: { title?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-color-card px-4">
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2 rounded hover:bg-surface cursor-pointer">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 12h18M3 6h18M3 18h18" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold">{title ?? ""}</h2>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button aria-label="Search" className="p-2 rounded hover:bg-surface cursor-pointer">
          <Search className="h-4 w-4" />
        </button>
        <button aria-label="Notifications" className="p-2 rounded hover:bg-surface cursor-pointer ">
          <Bell className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-foreground"
        >
          {resolvedTheme === "dark" ? (
            <Sun aria-hidden="true" className="size-4 cursor-pointer" />
          ) : (
            <Moon aria-hidden="true" className="size-4 cursor-pointer" />
          )}
        </button>
        <Link href="/admin/login" className="ml-2 text-sm">
          Sign out
        </Link>
      </div>
    </header>
  );
}
