"use client";

import { useTheme } from "@/components/site/theme-provider";
import {
  LogOut,
  MonitorSmartphone,
  Moon,
  Search,
  Sun,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/(admin)/admin/actions";
import { filterNav, type BadgeKey } from "@/components/admin/shell/nav";
import { useSearchPalette } from "@/components/admin/shell/search-palette";
import { initials } from "@/components/admin/shell/user-initials";
import { Logo } from "@/components/site/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import type { AdminUser } from "@/lib/auth";

// Active item pill (plan 9c.4): --sidebar-active background, gold icon, 1px
// border and a subtle shadow. Restated on the button so we do not touch sidebar.tsx.
const ACTIVE_CLASSES =
  "data-[active=true]:border data-[active=true]:border-sidebar-border data-[active=true]:bg-sidebar-active data-[active=true]:font-medium data-[active=true]:text-foreground data-[active=true]:shadow-xs data-[active=true]:[&_svg]:text-gold-text";

function NavUser({ user }: { user: AdminUser }) {
  const { setTheme } = useTheme();
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-active data-[state=open]:text-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                  {initials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">
                  {user.fullName}
                </span>
                <span className="truncate text-xs text-sidebar-muted">
                  {user.role}
                </span>
              </span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) rounded-card"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="truncate text-sm font-medium">
                  {user.fullName}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin/settings">
                <UserRound />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Theme
            </DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setTheme("light")}>
              <Sun />
              Light
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("dark")}>
              <Moon />
              Dark
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setTheme("system")}>
              <MonitorSmartphone />
              System
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <form action={signOut} className="w-full">
                <button
                  type="submit"
                  className="flex w-full items-center gap-2"
                >
                  <LogOut />
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

// Search box (plan 9c.4, moved into the sidebar above the nav): opens the shared
// command palette. Collapsed to icons it shows just the search glyph; expanded it
// reads like an input with a ⌘K hint, matching the reference layout.
function SidebarSearch() {
  const { setOpen } = useSearchPalette();
  const { state } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          variant="outline"
          tooltip="Search"
          aria-label="Search"
          onClick={() => setOpen(true)}
          className="h-9 rounded-lg bg-white border-sidebar-border text-sidebar-muted"
        >
          <Search strokeWidth={1.75} />
          <span className="flex-1 font-normal">Search…</span>
          {state === "expanded" ? (
            <kbd className="pointer-events-none inline-flex h-5 items-center justify-center rounded border border-sidebar-border bg-sidebar px-1.5 text-[12px] font-medium text-sidebar-muted">
              ⌘K
            </kbd>
          ) : null}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

export function AppSidebar({
  user,
  counts,
}: {
  user: AdminUser;
  counts?: Partial<Record<BadgeKey, number>>;
}) {
  const pathname = usePathname() || "/admin";
  const groups = filterNav(user.role);

  return (
    <Sidebar collapsible="icon" role="complementary" aria-label="Admin sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Prime Bag Factory">
              <Link href="/admin">
                <Logo variant="mark" className="size-8 shrink-0 rounded" />
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">
                    Prime Bag Factory
                  </span>
                  <span className="truncate text-xs text-sidebar-muted">
                    Admin
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarSearch />
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-sidebar-muted">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);
                  const count = item.badgeKey
                    ? counts?.[item.badgeKey]
                    : undefined;
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={ACTIVE_CLASSES}
                      >
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon strokeWidth={1.75} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                      {typeof count === "number" && count > 0 ? (
                        <SidebarMenuBadge className="bg-sidebar-primary text-sidebar-primary-foreground tabular-nums">
                          <span className="sr-only">{item.label}: </span>
                          {count}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
