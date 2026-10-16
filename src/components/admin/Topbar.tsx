"use client";

import Link from "next/link";
import { Search, Bell, SunMoon } from "lucide-react";
import { ThemeToggle } from "@/components/site/theme-toggle";

export default function Topbar({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border bg-color-card px-4">
      <div className="flex items-center gap-4">
        <button className="md:hidden p-2 rounded hover:bg-surface">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M3 12h18M3 6h18M3 18h18" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold">{title ?? ""}</h2>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button aria-label="Search" className="p-2 rounded hover:bg-surface">
          <Search className="h-4 w-4" />
        </button>
        <button aria-label="Notifications" className="p-2 rounded hover:bg-surface">
          <Bell className="h-4 w-4" />
        </button>
        <ThemeToggle />
        <Link href="/admin/login" className="ml-2 text-sm">
          Sign out
        </Link>
      </div>
    </header>
  );
}
