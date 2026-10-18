"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const SEGMENT_LABELS: Record<string, string> = {
  admin: "Admin",
  products: "Products",
  categories: "Categories",
  collections: "Collections",
  swatches: "Swatches",
  quotes: "Quotes",
  orders: "Orders",
  customers: "Customers",
  inventory: "Inventory",
  content: "Content",
  users: "Users",
  settings: "Settings",
  audit: "Audit log",
  new: "New",
  edit: "Edit",
};

function labelFor(segment: string) {
  return SEGMENT_LABELS[segment] ?? segment.replace(/-/g, " ");
}

/**
 * Breadcrumbs (plan 9c.4): derived from the URL so every module page gets them
 * for free. The last segment is the current page; earlier ones link to their
 * base path. Single-word dynamic ids (uuids) are hidden to keep the trail short.
 */
export function Breadcrumbs() {
  const pathname = usePathname() || "/admin";
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments
    .map((segment, index) => {
      const href = "/" + segments.slice(0, index + 1).join("/");
      const looksLikeId = /^[0-9a-f-]{16,}$/i.test(segment);
      return { segment, href, label: labelFor(segment), hidden: looksLikeId };
    })
    .filter((c) => !c.hidden);

  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb aria-label="Breadcrumb">
      <BreadcrumbList className="text-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <React.Fragment key={crumb.href}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href} className="capitalize">
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
