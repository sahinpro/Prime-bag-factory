"use client";

import { Bell, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { markAlertsRead } from "@/app/(admin)/admin/notifications/actions";
import { ToneBadge } from "@/components/admin/data/status-badge";
import { AdminThemeToggle } from "@/components/admin/shell/admin-theme-toggle";
import { Breadcrumbs } from "@/components/admin/shell/breadcrumbs";
import { MobileUserMenu } from "@/components/admin/shell/mobile-user-menu";
import { useSearchPalette } from "@/components/admin/shell/search-palette";
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
 * Topbar (plan 9c.4): breadcrumb, a compact search icon that opens the shared
 * command palette (Cmd/Ctrl+K, see SearchPaletteProvider), a notifications
 * popover, the shared theme toggle and, on mobile, a user menu. Sticky, h-16,
 * bottom border. The full search box lives in the sidebar; here only the icon.
 *
 * The bell shows recent `admin_alert` rows (new quotes and new orders) from
 * the protected layout (RLS: owner/manager only — other roles receive an empty
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
  const { setOpen: setPaletteOpen } = useSearchPalette();
  const [marking, startMarking] = React.useTransition();
  const router = useRouter();
  const unread = alerts.filter((a) => a.unread).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />

      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>

      <Button
        variant="ghost"
        size="lg"
        aria-label="Open command palette"
        onClick={() => setPaletteOpen(true)}
      >
        <Search aria-hidden="true" strokeWidth={1.75} className="size-4" />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="lg"
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
              No new notifications. New quotes and orders appear here.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {alerts.map((alert) => {
                const body = (
                  <>
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-medium">{alert.title}</span>
                      {alert.unread ? (
                        <ToneBadge tone="ink" icon={Sparkles}>
                          New
                        </ToneBadge>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-muted-foreground">
                      {alert.detail}
                      {alert.ref ? (
                        <>
                          {" "}
                          · <span className="font-mono">{alert.ref}</span>
                        </>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatDate(new Date(alert.createdAt), "en")}
                    </span>
                  </>
                );
                return (
                  <li key={alert.id} className="border-b last:border-b-0">
                    {alert.href ? (
                      <Link
                        href={alert.href}
                        className="block px-4 py-3 text-sm hover:bg-surface-2"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="block px-4 py-3 text-sm">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      <AdminThemeToggle />

      <MobileUserMenu user={user} />
    </header>
  );
}
