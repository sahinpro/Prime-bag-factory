import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ContentWorkspace } from "@/components/admin/content/content-workspace";
import {
  CONTENT_TYPE_CONFIGS,
  CONTENT_TYPE_ORDER,
} from "@/components/admin/content/content-types";
import { PageHeader } from "@/components/admin/shell/page-header";
import { getAdminUser } from "@/lib/auth";
import { CONTENT_ENTITIES, type ContentEntity } from "@/lib/validators/content";
import { listContentRows } from "@/server/content-admin";
import { cn } from "@/lib/utils";

export const instant = false;

export const metadata = { title: "Content" };

const PATHNAME = "/admin/content";

function readType(raw?: string): ContentEntity {
  return CONTENT_ENTITIES.includes(raw as ContentEntity)
    ? (raw as ContentEntity)
    : "sections";
}

// Content admin (plan 9c.8, Phase 4 task 3): owner/manager only, mirroring the
// content-table RLS and the actions' requireRole. The type rail is plain links
// on `?type=` so the whole page stays server-rendered; the selected type's rows
// feed one list/editor pair (ContentWorkspace).
export default async function ContentPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ type?: string }>;
}>) {
  await connection();
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");

  if (user.role !== "owner" && user.role !== "manager") {
    return (
      <PageHeader
        title="Content"
        description="You don't have access to manage site content."
      />
    );
  }

  const params = await searchParams;
  const entity = readType(params.type);
  const rows = await listContentRows(entity);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content"
        description="Homepage sections, clients, gallery, testimonials, FAQs, blog, legal docs and redirects."
      />

      <nav
        aria-label="Choose a content type"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {CONTENT_TYPE_ORDER.map((key) => {
          const isActive = key === entity;
          return (
            <Link
              key={key}
              href={key === "sections" ? PATHNAME : `${PATHNAME}?type=${key}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px flex shrink-0 items-center border-b-2 px-3 py-2 text-sm font-medium transition-colors motion-reduce:transition-none",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {CONTENT_TYPE_CONFIGS[key].label}
            </Link>
          );
        })}
      </nav>

      <ContentWorkspace entity={entity} rows={rows} />
    </div>
  );
}
