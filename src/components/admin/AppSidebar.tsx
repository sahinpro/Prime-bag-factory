"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Package, FileText, Boxes, Users, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AppSidebar() {
  const pathname = usePathname() || "/admin";

  function Item({ href, children }: { href: string; children: React.ReactNode }) {
    const active = pathname === href;
    return (
      <li>
        <Link
          href={href}
          className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-surface"
          }`}
        >
          {children}
        </Link>
      </li>
    );
  }

  return (
    <aside className="hidden md:block w-64 shrink-0 border-r border-sidebar-border bg-color-sidebar px-3 py-6">
      <div className="mb-6 px-2">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="inline-block h-8 w-8 rounded bg-color-primary" />
          <span className="text-sm font-semibold">Prime Bag Factory</span>
        </Link>
      </div>

      <nav aria-label="Admin" className="px-1">
        <ul className="space-y-1">
          <Item href="/admin">
            <Home className="h-4 w-4" />
            Dashboard
          </Item>

          <Item href="/admin/products">
            <Package className="h-4 w-4" />
            Products
          </Item>

          <Item href="/admin/quotes">
            <FileText className="h-4 w-4" />
            Quotes
            <Badge className="ml-auto">3</Badge>
          </Item>

          <Item href="/admin/inventory">
            <Boxes className="h-4 w-4" />
            Inventory
          </Item>

          <Item href="/admin/users">
            <Users className="h-4 w-4" />
            Users
          </Item>

          <Item href="/admin/settings">
            <Settings className="h-4 w-4" />
            Settings
          </Item>
        </ul>
      </nav>

      <div className="mt-6 px-2">
        <p className="text-xs text-muted-foreground">Role</p>
        <div className="mt-2 text-sm">Owner</div>
      </div>
    </aside>
  );
}
