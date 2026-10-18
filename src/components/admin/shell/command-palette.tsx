"use client";

import {
  FilePlus2,
  FolderPlus,
  LayoutDashboard,
  PackagePlus,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { reachableItems } from "@/components/admin/shell/nav";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { Role } from "@/lib/auth";

/**
 * CommandPalette (plan 9c.4 / 9c.5): Cmd/Ctrl+K opens grouped results.
 * Pages come from the role's reachable nav; quick actions jump to create routes.
 * Record search (orders, quotes, products) is wired in when the modules exist.
 */
export function CommandPalette({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
}) {
  const router = useRouter();
  const pages = reachableItems(role);

  const actions = [
    {
      label: "New product",
      href: "/admin/products/new",
      icon: PackagePlus,
      roles: ["owner", "manager", "inventory"] as const,
    },
    {
      label: "New category",
      href: "/admin/categories/new",
      icon: FolderPlus,
      roles: ["owner", "manager"] as const,
    },
    {
      label: "New collection",
      href: "/admin/collections/new",
      icon: FilePlus2,
      roles: ["owner", "manager"] as const,
    },
  ].filter((a) => (a.roles as readonly string[]).includes(role));

  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages and actions…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>

        <CommandGroup heading="Pages">
          {pages.map((page) => {
            const Icon = page.icon;
            return (
              <CommandItem key={page.href} onSelect={() => go(page.href)}>
                <Icon aria-hidden="true" strokeWidth={1.75} />
                {page.label}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {actions.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Actions">
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <CommandItem
                    key={action.href}
                    onSelect={() => go(action.href)}
                  >
                    <Icon aria-hidden="true" strokeWidth={1.75} />
                    {action.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        ) : null}

        <CommandSeparator />
        <CommandGroup heading="Dashboard">
          <CommandItem onSelect={() => go("/admin")}>
            <LayoutDashboard aria-hidden="true" strokeWidth={1.75} />
            Go to dashboard
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
