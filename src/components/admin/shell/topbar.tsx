"use client";

import { Bell, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { markAlertsRead } from "@/app/(admin)/admin/notifications/actions";
import { ToneBadge } from "@/components/admin/data/status-badge";
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
import { formatDate } from "@/lib/format";
import type { AdminAlert } from "@/server/notifications";

/**
 * Topbar (plan 9c.4): breadcrumb, a search button that opens the command palette
 * (Cmd/Ctrl+K), a notifications popover, the shared theme toggle and, on mobile,
 * a user menu. Sticky, h-16, bottom border.
 *
 * The bell (Phase 4 task 2) shows recent `admin_alert` notifications from the
 * protected layout (RLS: owner/manager only — other roles receive an empty
 * list and the popover keeps its empty state). Unread count is a number, never
 * color alone (plan 9c.1), and "Mark all read" flips the outbox rows.
 */
export function Topbar({
  user,
  alerts = [],
}: {
  user: AdminUser;
  alerts?: AdminAlert[];
}) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [marking, startMarking] = React.useTransition();
  const router = useRouter();
  const unread = alerts.filter((a) => a.unread).length;

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
          <Button
            variant="ghost"
            size="icon"
            aria-label={
              unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
            }
            className="relative"
          >
            <Bell aria-hidden="true" strokeWidth={1.75} className="size-4" />
            {unread > 0 ? (
              <span
                aria-hidden="true"
                className="absolute right-1 top-1 grid size-4 place-content-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground"
              >
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 rounded-card p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                disabled={marking}
                onClick={() =>
                  startMarking(async () => {
                    await markAlertsRead();
                    router.refresh();
                  })
                }
              >
                {marking ? "Marking…" : "Mark all read"}
              </Button>
            ) : null}
          </div>
          {alerts.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              No new notifications. New quote requests appear here.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {alerts.map((alert) => (
                <li key={alert.id} className="border-b last:border-b-0">
                  <Link
                    href={`/admin/quotes/${alert.quoteId}`}
                    className="block px-4 py-3 text-sm hover:bg-surface-2"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        New {alert.source === "builder" ? "builder" : "quote"}{" "}
                        request
                      </span>
                      {alert.unread ? (
                        <ToneBadge tone="ink" icon={Sparkles}>
                          New
                        </ToneBadge>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-muted-foreground">
                      {alert.companyName || alert.contactName} ·{" "}
                      <span className="font-mono">{alert.ref}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatDate(new Date(alert.createdAt), "en")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
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
