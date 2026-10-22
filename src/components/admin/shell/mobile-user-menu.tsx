"use client";

import { useTheme } from "@/components/site/theme-provider";
import {
  KeyRound,
  LogOut,
  MonitorSmartphone,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/(admin)/admin/actions";
import { initials } from "@/components/admin/shell/user-initials";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AdminUser } from "@/lib/auth";

/**
 * A compact user menu shown only under 768px, where the full sidebar (and its
 * footer user card) lives inside the mobile sheet. Reaches profile, theme and
 * sign out without opening the drawer.
 */
export function MobileUserMenu({ user }: { user: AdminUser }) {
  const { setTheme } = useTheme();

  return (
    <span className="md:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Account menu">
            <Avatar className="size-7">
              <AvatarFallback className="bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {initials(user.fullName)}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 rounded-card">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col">
              <span className="truncate text-sm font-medium">
                {user.fullName}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {user.role}
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
          <DropdownMenuItem asChild>
            <Link href="/admin/change-password">
              <KeyRound />
              Change password
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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
              <button type="submit" className="flex w-full items-center gap-2">
                <LogOut />
                Sign out
              </button>
            </form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}
