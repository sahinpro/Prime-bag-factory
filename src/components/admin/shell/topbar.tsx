"use client";

import { Bell, Search } from "lucide-react";
import * as React from "react";

import { AdminThemeToggle } from "@/components/admin/shell/admin-theme-toggle";
import { Breadcrumbs } from "@/components/admin/shell/breadcrumbs";
import { CommandPalette } from "@/components/admin/shell/command-palette";
import { MobileUserMenu } from "@/components/admin/shell/mobile-user-menu";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { AdminUser } from "@/lib/auth";

/**
 * Topbar (plan 9c.4): breadcrumb, a search button that opens the command palette
 * (Cmd/Ctrl+K), a notifications popover, the shared theme toggle and, on mobile,
 * a user menu. Sticky, h-16, bottom border.
 */
export function Topbar({ user }: { user: AdminUser }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((open) => !open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />

      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setPaletteOpen(true)}
        className="hidden text-muted-foreground md:inline-flex"
      >
        <Search aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Search
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Open command palette"
        onClick={() => setPaletteOpen(true)}
        className="md:hidden"
      >
        <Search aria-hidden="true" strokeWidth={1.75} className="size-4" />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Notifications">
            <Bell aria-hidden="true" strokeWidth={1.75} className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 rounded-card p-0">
          <div className="border-b px-4 py-3 text-sm font-medium">
            Notifications
          </div>
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No new notifications. Alerts appear here in a later phase.
          </p>
        </PopoverContent>
      </Popover>

      <AdminThemeToggle />

      <MobileUserMenu user={user} />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        role={user.role}
      />
    </header>
  );
}
