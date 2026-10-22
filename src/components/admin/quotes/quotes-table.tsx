"use client";

import { ClipboardList, Inbox, Puzzle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import {
  createColumnHelper,
  DataTable,
  type DataTableColumn,
  type DataTableQuery,
} from "@/components/admin/data/data-table";
import { EmptyState } from "@/components/admin/data/empty-state";
import { FilterBar } from "@/components/admin/data/filter-bar";
import { StatusBadge, ToneBadge } from "@/components/admin/data/status-badge";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AdminQuote,
  AssignableStaff,
  QuoteStatusCounts,
} from "@/server/quotes";

/**
 * QuotesTable — the quotes inbox (plan 9c.8 "TabsBar pipeline (counts),
 * FilterBar (source form/builder, assignee, urgency), DataTable, row opens
 * detail"). Pipeline tabs are URL links (`?status`, server re-queries);
 * search/source/assignee run client-side over the loaded rows, mirroring the
 * Products list. Every row links to the quote detail page.
 */

type StatusKey = "all" | "new" | "contacted" | "quoted" | "won" | "lost";

const TABS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "contacted", label: "Contacted" },
  { key: "quoted", label: "Quoted" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

type SourceKey = "all" | "form" | "builder";
// "all" / "none" avoid the reserved shadcn Select value "undefined" semantics.
type AssigneeKey = "all" | "none" | string;

const DEFAULT_QUERY: DataTableQuery = {
  q: "",
  sort: null,
  dir: "asc",
  page: 1,
  pageSize: 10,
};

function toSearchParams(q: DataTableQuery): string {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.sort) {
    p.set("sort", q.sort);
    p.set("dir", q.dir);
  }
  if (q.page > 1) p.set("page", String(q.page));
  if (q.pageSize !== DEFAULT_QUERY.pageSize) p.set("size", String(q.pageSize));
  return p.toString();
}

function normalizeQuery(
  input: Partial<DataTableQuery> | undefined,
): DataTableQuery {
  const size = Number(input?.pageSize);
  const page = Number(input?.page);
  return {
    q: input?.q ?? "",
    sort: input?.sort || null,
    dir: input?.dir === "desc" ? "desc" : "asc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: [10, 25, 50].includes(size) ? size : DEFAULT_QUERY.pageSize,
  };
}

const columnHelper = createColumnHelper<AdminQuote>();

function SourceBadge({ source }: { source: AdminQuote["source"] }) {
  return source === "builder" ? (
    <ToneBadge tone="gold" icon={Puzzle}>
      Builder
    </ToneBadge>
  ) : (
    <ToneBadge tone="neutral" icon={ClipboardList}>
      Form
    </ToneBadge>
  );
}

/** Unseen marker (plan: badges = unseen new quotes): dot + sr-only text, so
 *  state is never carried by color alone (plan 9c.6). */
function UnseenFlag() {
  return (
    <span className="ml-1.5 inline-flex items-center align-middle">
      <span
        aria-hidden="true"
        className="inline-block size-1.5 rounded-full bg-primary"
      />
      <span className="sr-only">Unseen</span>
    </span>
  );
}

export function QuotesTable({
  quotes,
  counts,
  staff,
  status,
  initialQuery,
}: Readonly<{
  quotes: AdminQuote[];
  counts: QuoteStatusCounts;
  staff: AssignableStaff[];
  status?: StatusKey;
  initialQuery: Partial<DataTableQuery>;
}>) {
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = React.useState<DataTableQuery>(() =>
    normalizeQuery(initialQuery),
  );
  const [source, setSource] = React.useState<SourceKey>("all");
  const [assignee, setAssignee] = React.useState<AssigneeKey>("all");

  function pushQuery(next: DataTableQuery) {
    setQuery(next);
    const search = toSearchParams(next);
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  const filtered = React.useMemo(() => {
    const term = query.q.trim().toLowerCase();
    return quotes.filter((q) => {
      if (source !== "all" && q.source !== source) return false;
      if (assignee === "none" && q.assigned_to !== null) return false;
      if (
        assignee !== "all" &&
        assignee !== "none" &&
        q.assigned_to !== assignee
      )
        return false;
      if (!term) return true;
      return [
        q.company_name ?? "",
        q.contact_name,
        q.phone,
        q.email ?? "",
        q.product_title ?? "",
        q.category_name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [quotes, query.q, source, assignee]);

  const activeStatus: StatusKey = status ?? "all";
  const filtersActive =
    query.q !== "" || source !== "all" || assignee !== "all";

  const columns = React.useMemo<DataTableColumn<AdminQuote>[]>(
    () => [
      columnHelper.accessor((row) => row.company_name ?? row.contact_name, {
        id: "company",
        header: "Company / Contact",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p
              className={cn(
                "truncate text-foreground",
                row.original.first_viewed_at === null
                  ? "font-semibold"
                  : "font-medium",
              )}
            >
              {row.original.company_name ?? row.original.contact_name}
              {row.original.first_viewed_at === null ? <UnseenFlag /> : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.contact_name} · {row.original.phone}
            </p>
          </div>
        ),
      }),
      columnHelper.accessor(
        (row) => row.product_title ?? row.category_name ?? "",
        {
          id: "request",
          header: "Request",
          cell: ({ row }) => (
            <div className="min-w-0">
              <p className="truncate text-sm">
                {row.original.product_title ??
                  row.original.category_name ??
                  "Custom request"}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {row.original.quantity != null
                  ? `${row.original.quantity.toLocaleString("en-US")} pcs`
                  : "Qty not set"}
              </p>
            </div>
          ),
        },
      ),
      columnHelper.accessor("source", {
        header: "Source",
        cell: ({ getValue }) => <SourceBadge source={getValue()} />,
      }),
      columnHelper.accessor((row) => row.assigned_name ?? "ZZZ", {
        id: "assignee",
        header: "Assigned",
        cell: ({ row }) =>
          row.original.assigned_name ? (
            <span className="text-sm">{row.original.assigned_name}</span>
          ) : (
            <span className="text-sm text-muted-foreground">Unassigned</span>
          ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => (
          <StatusBadge domain="quote" value={getValue()} />
        ),
      }),
      columnHelper.accessor((row) => row.urgency ?? "zzz", {
        id: "urgency",
        header: "Urgency",
        cell: ({ row }) =>
          row.original.urgency ? (
            <StatusBadge domain="urgency" value={row.original.urgency} />
          ) : (
            <span className="text-xs text-muted-foreground">No date</span>
          ),
      }),
      columnHelper.accessor("created_at", {
        header: "Received",
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatDate(new Date(getValue()), "en")}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/quotes/${row.original.id}`}>
                Open
                <span className="sr-only">
                  : {row.original.company_name ?? row.original.contact_name}
                </span>
              </Link>
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  function renderMobileCard(row: AdminQuote) {
    return (
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <p
            className={cn(
              "truncate text-foreground",
              row.first_viewed_at === null ? "font-semibold" : "font-medium",
            )}
          >
            {row.company_name ?? row.contact_name}
            {row.first_viewed_at === null ? <UnseenFlag /> : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {row.contact_name} · {row.phone}
          </p>
          <p className="truncate text-sm">
            {row.product_title ?? row.category_name ?? "Custom request"}
            {row.quantity != null ? (
              <span className="text-muted-foreground tabular-nums">
                {" "}
                · {row.quantity.toLocaleString("en-US")} pcs
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StatusBadge domain="quote" value={row.status} />
            <SourceBadge source={row.source} />
            {row.urgency ? (
              <StatusBadge domain="urgency" value={row.urgency} />
            ) : null}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/quotes/${row.id}`}>
            Open
            <span className="sr-only">
              : {row.company_name ?? row.contact_name}
            </span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotes"
        description="Every request for a bulk or custom price, from the form and the builder."
      />

      {/* Pipeline tabs: each is a link that re-queries the server for that status. */}
      <nav
        aria-label="Filter quotes by status"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {TABS.map((tab) => {
          const isActive = tab.key === activeStatus;
          const href =
            tab.key === "all" ? pathname : `${pathname}?status=${tab.key}`;
          return (
            <Link
              key={tab.key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                {counts[tab.key] ?? 0}
              </span>
            </Link>
          );
        })}
      </nav>

      <FilterBar
        value={query.q}
        label="Search quotes"
        placeholder="Search by company, name, phone…"
        canReset={filtersActive}
        onSearch={(q) => pushQuery({ ...query, q, page: 1 })}
        onReset={() => {
          setSource("all");
          setAssignee("all");
          pushQuery({ ...DEFAULT_QUERY, pageSize: query.pageSize });
        }}
        filters={
          <>
            <Select
              value={source}
              onValueChange={(v) => setSource(v as SourceKey)}
            >
              <SelectTrigger
                size="sm"
                className="w-36"
                aria-label="Filter by source"
              >
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="form">Form</SelectItem>
                <SelectItem value="builder">Builder</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={assignee}
              onValueChange={(v) => setAssignee(v as AssigneeKey)}
            >
              <SelectTrigger
                size="sm"
                className="w-44"
                aria-label="Filter by assignee"
              >
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anyone</SelectItem>
                <SelectItem value="none">Unassigned</SelectItem>
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(row) => row.id}
        query={query}
        onQueryChange={pushQuery}
        renderMobileCard={renderMobileCard}
        caption="Quote requests with status, source, assignee and urgency"
        empty={
          quotes.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No quotes yet"
              description="Requests from the quote form and the builder land here."
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title="No matches"
              description="No quotes match your search and filters."
            />
          )
        }
      />
    </div>
  );
}
