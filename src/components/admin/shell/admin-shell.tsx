import { AppSidebar } from "@/components/admin/shell/app-sidebar";
import type { BadgeKey } from "@/components/admin/shell/nav";
import { SearchPaletteProvider } from "@/components/admin/shell/search-palette";
import { Topbar } from "@/components/admin/shell/topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AdminUser } from "@/lib/auth";
import type { AdminAlert } from "@/server/notifications";

/**
 * AdminShell (plan 9c.4): providers plus the collapsible, role-aware sidebar and
 * the sticky topbar around a content area capped at 1440px and centered beyond.
 * A skip link is the first focusable element (accessibility, plan 3c).
 * `alerts` feeds the topbar bell (Phase 4 task 2); fetched in the protected
 * layout through the RLS-scoped client (owner/manager see rows, others none).
 */
export function AdminShell({
  user,
  counts,
  alerts = [],
  children,
}: {
  user: AdminUser;
  counts?: Partial<Record<BadgeKey, number>>;
  alerts?: AdminAlert[];
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <SearchPaletteProvider role={user.role}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
          >
            Skip to content
          </a>
          <AppSidebar user={user} counts={counts} />
          <SidebarInset>
            <Topbar user={user} alerts={alerts} />
            {/* SidebarInset already renders the single <main> landmark; this is a
                plain content wrapper (the skip-link target). */}
            <div
              id="main"
              tabIndex={-1}
              className="mx-auto w-full max-w-360 flex-1 px-4 py-6 outline-none sm:px-6"
            >
              {children}
            </div>
          </SidebarInset>
        </SearchPaletteProvider>
      </SidebarProvider>
    </TooltipProvider>
  );
}
