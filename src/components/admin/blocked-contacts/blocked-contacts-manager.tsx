"use client";

import { Ban, Globe, Phone } from "lucide-react";
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
import { ConfirmDialog } from "@/components/admin/forms/confirm-dialog";
import {
  FlashLine,
  useActionSave,
} from "@/components/admin/products/use-action-save";
import { PageHeader } from "@/components/admin/shell/page-header";
import { unblockContact } from "@/app/(admin)/admin/blocked-contacts/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { BlockedContactRow } from "@/server/blocked-contacts";

/**
 * Blocked contacts (plan 15.2 B4b): the staff blocklist with one undo action.
 * A wrongly blocked customer is the failure mode B4 introduced — without this
 * page it needs raw DB access. Search and sort are URL-synced like every
 * other admin list; "Unblock" is destructive, so it routes through
 * ConfirmDialog, and the audit trail is written server-side by the RPC.
 */

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

function TypeChip({ type }: Readonly<{ type: BlockedContactRow["type"] }>) {
  const Icon = type === "phone" ? Phone : Globe;
  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <Icon aria-hidden="true" strokeWidth={1.75} className="size-4" />
      {type === "phone" ? "Phone" : "IP hash"}
    </Badge>
  );
}

const columnHelper = createColumnHelper<BlockedContactRow>();

export function BlockedContactsManager({
  contacts,
  initialQuery,
}: Readonly<{
  contacts: BlockedContactRow[];
  initialQuery: Partial<DataTableQuery>;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const { flash, run } = useActionSave();

  const [query, setQuery] = React.useState<DataTableQuery>(() =>
    normalizeQuery(initialQuery),
  );

  function pushQuery(next: DataTableQuery) {
    setQuery(next);
    const search = toSearchParams(next);
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  const filtered = React.useMemo(() => {
    const term = query.q.trim().toLowerCase();
    if (!term) return contacts;
    return contacts.filter((row) =>
      [row.value, row.reason ?? "", row.blocked_by ?? "", row.type]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [contacts, query.q]);

  function unblock(row: BlockedContactRow) {
    return run(
      () => unblockContact({ id: row.id }),
      row.type === "phone"
        ? "Phone unblocked — the customer can order again."
        : "IP hash unblocked.",
    );
  }

  function UnblockButton({ row }: Readonly<{ row: BlockedContactRow }>) {
    return (
      <ConfirmDialog
        destructive
        title="Unblock this contact?"
        description={`${row.value} will be able to place orders and submit quotes again. This unblock is recorded in the audit log.`}
        confirmLabel="Unblock"
        trigger={
          <Button variant="outline" size="sm">
            Unblock
            <span className="sr-only">: {row.value}</span>
          </Button>
        }
        onConfirm={() => {
          void unblock(row);
        }}
      />
    );
  }

  const columns = React.useMemo<DataTableColumn<BlockedContactRow>[]>(
    () => [
      columnHelper.accessor("type", {
        header: "Type",
        cell: ({ getValue }) => <TypeChip type={getValue()} />,
      }),
      columnHelper.accessor("value", {
        header: "Blocked",
        cell: ({ getValue }) => (
          <p className="truncate font-mono text-sm tabular-nums">
            {getValue()}
          </p>
        ),
      }),
      columnHelper.accessor("reason", {
        header: "Reason",
        cell: ({ getValue }) => (
          <p className="max-w-64 truncate text-sm text-muted-foreground">
            {getValue() ?? "—"}
          </p>
        ),
      }),
      columnHelper.accessor("blocked_by", {
        header: "Blocked by",
        cell: ({ getValue }) => (
          <span className="text-sm text-muted-foreground">
            {getValue() ?? "—"}
          </span>
        ),
      }),
      columnHelper.accessor("created_at", {
        header: "Blocked on",
        cell: ({ getValue }) => (
          <span className="text-sm tabular-nums text-muted-foreground">
            {formatDate(new Date(getValue()), "en")}
          </span>
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <UnblockButton row={row.original} />
          </div>
        ),
      }),
    ],
    // `unblock` closes over `run`, which is stable per render of this hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function renderMobileCard(row: BlockedContactRow) {
    return (
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <TypeChip type={row.type} />
            <p className="truncate font-mono text-sm tabular-nums">
              {row.value}
            </p>
          </div>
          {row.reason ? (
            <p className="truncate text-sm text-muted-foreground">
              {row.reason}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground tabular-nums">
            {row.blocked_by ?? "—"} · {formatDate(new Date(row.created_at), "en")}
          </p>
        </div>
        <UnblockButton row={row} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Blocked contacts"
        description="Phones and IP hashes blocked from checkout and quotes. Unblocking is recorded in the audit log."
      />

      <FlashLine flash={flash} />

      <FilterBar
        value={query.q}
        label="Search blocked contacts"
        placeholder="Search by phone, hash or reason…"
        canReset={query.q !== ""}
        onSearch={(q) => pushQuery({ ...query, q, page: 1 })}
        onReset={() => pushQuery({ ...DEFAULT_QUERY, pageSize: query.pageSize })}
      />

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(row) => row.id}
        query={query}
        onQueryChange={pushQuery}
        renderMobileCard={renderMobileCard}
        caption="Blocked phones and IP hashes with reason, blocker and date"
        empty={
          contacts.length === 0 ? (
            <EmptyState
              icon={Ban}
              title="Nothing is blocked"
              description="Phones blocked from an order detail land here."
            />
          ) : (
            <EmptyState
              icon={Ban}
              title="No matches"
              description="No blocked contact matches your search."
            />
          )
        }
      />
    </div>
  );
}
