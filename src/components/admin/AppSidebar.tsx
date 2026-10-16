"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, FileText, Boxes, Users, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";

function SidebarItem({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? "bg-sidebar-active text-gold-text"
            : "text-sidebar-foreground hover:bg-surface"
        }`}
      >
        {children}
      </Link>
    </li>
  );
}

export default function AppSidebar() {
  const pathname = usePathname() || "/admin";

  return (
    <aside className="hidden w-64 shrink-0 border-r border-sidebar-border bg-sidebar px-3 py-6 md:block">
      <div className="mb-6 px-2">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="inline-block h-8 w-8 rounded bg-color-primary" />
          <span className="text-sm font-semibold">Prime Bag Factory</span>
        </Link>
      </div>

      <nav aria-label="Admin" className="px-1">
        <ul className="space-y-1">
          <SidebarItem href="/admin" active={pathname === "/admin"}>
            <Home className="h-4 w-4" />
            Dashboard
          </SidebarItem>

          <SidebarItem href="/admin/products" active={pathname.startsWith("/admin/products")}>
            <Package className="h-4 w-4" />
            Products
          </SidebarItem>

          <SidebarItem href="/admin/quotes" active={pathname.startsWith("/admin/quotes")}>
            <FileText className="h-4 w-4" />
            Quotes
            <Badge className="ml-auto">3</Badge>
          </SidebarItem>

          <SidebarItem href="/admin/inventory" active={pathname.startsWith("/admin/inventory")}>
            <Boxes className="h-4 w-4" />
            Inventory
          </SidebarItem>

          <SidebarItem href="/admin/users" active={pathname.startsWith("/admin/users")}>
            <Users className="h-4 w-4" />
            Users
          </SidebarItem>

          <SidebarItem href="/admin/settings" active={pathname.startsWith("/admin/settings")}>
            <Settings className="h-4 w-4" />
            Settings
          </SidebarItem>
        </ul>
      </nav>

      <div className="mt-6 px-2">
        <p className="text-xs text-muted-foreground">Role</p>
        <div className="mt-2 text-sm">Owner</div>
      </div>
    </aside>
  );
}
