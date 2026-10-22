import type { Role } from "@/lib/auth";
import {
  Ban,
  Boxes,
  FileText,
  FolderTree,
  Layers,
  LayoutDashboard,
  Package,
  Palette,
  ScrollText,
  Settings,
  ShoppingCart,
  Truck,
  UserCog,
  Users,
} from "lucide-react";
import type { ComponentType, SVGProps } from "react";

/**
 * Admin navigation config (plan 9c.4). Role gates mirror the server-side
 * `requireRole()` rules: nav is a convenience, never the real authorization.
 */

export type BadgeKey = "quotes_new" | "orders_pending" | "inventory_low";

export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  roles: readonly Role[];
  badgeKey?: BadgeKey;
  /**
   * Plan 15.2 C4 — the page behind this link is not built yet, so the link
   * is hidden (staff must never click into a 404). Flip it back to false
   * when the page ships; the config stays so the intent is not lost.
   */
  hidden?: boolean;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

const ALL_STAFF: readonly Role[] = ["owner", "manager", "sales", "inventory"];
const OWNER_MANAGER: readonly Role[] = ["owner", "manager"];
const SALES: readonly Role[] = ["owner", "manager", "sales"];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Main",
    items: [
      {
        label: "Dashboard",
        href: "/admin",
        icon: LayoutDashboard,
        roles: ALL_STAFF,
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      {
        label: "Products",
        href: "/admin/products",
        icon: Package,
        roles: ["owner", "manager", "inventory"],
      },
      {
        label: "Categories",
        href: "/admin/categories",
        icon: FolderTree,
        roles: OWNER_MANAGER,
      },
      {
        label: "Collections",
        href: "/admin/collections",
        icon: Layers,
        roles: OWNER_MANAGER,
      },
      {
        label: "Swatches",
        href: "/admin/swatches",
        icon: Palette,
        roles: OWNER_MANAGER,
      },
    ],
  },
  {
    label: "Sales",
    items: [
      {
        label: "Quotes",
        href: "/admin/quotes",
        icon: FileText,
        roles: SALES,
        badgeKey: "quotes_new",
      },
      {
        label: "Orders",
        href: "/admin/orders",
        icon: ShoppingCart,
        roles: SALES,
        badgeKey: "orders_pending",
      },
      {
        label: "Customers",
        href: "/admin/customers",
        icon: Users,
        roles: SALES,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Inventory",
        href: "/admin/inventory",
        icon: Boxes,
        roles: ["owner", "manager", "inventory"],
        badgeKey: "inventory_low",
      },
      {
        label: "Shipping",
        href: "/admin/shipping",
        icon: Truck,
        roles: OWNER_MANAGER,
      },
    ],
  },
  {
    label: "System",
    items: [
      {
        label: "Users",
        href: "/admin/users",
        icon: UserCog,
        roles: ["owner"],
        hidden: true, // C4 — page not built (plan §9 "Invite staff")
      },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: Settings,
        roles: OWNER_MANAGER,
      },
      {
        label: "Audit log",
        href: "/admin/audit",
        icon: ScrollText,
        roles: OWNER_MANAGER,
        hidden: true, // C4 — page not built; D1 wires the audit writer first
      },
      {
        label: "Blocked contacts",
        href: "/admin/blocked-contacts",
        icon: Ban,
        roles: OWNER_MANAGER,
      },
    ],
  },
];

export function filterNav(role: Role): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.hidden && item.roles.includes(role),
    ),
  })).filter((group) => group.items.length > 0);
}

/** Flat list of every href a role can reach, used for command-palette pages. */
export function reachableItems(role: Role): NavItem[] {
  return filterNav(role).flatMap((group) => group.items);
}
