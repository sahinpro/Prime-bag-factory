"use client";

import { Pencil, Plus, Truck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import {
  deleteShippingZone,
  saveShippingZone,
} from "@/app/(admin)/admin/shipping/actions";
import {
  createColumnHelper,
  DataTable,
  type DataTableColumn,
  type DataTableQuery,
} from "@/components/admin/data/data-table";
import { EmptyState } from "@/components/admin/data/empty-state";
import { FilterBar } from "@/components/admin/data/filter-bar";
import { ToneBadge } from "@/components/admin/data/status-badge";
import { PageHeader } from "@/components/admin/shell/page-header";
import { ShippingZoneEditor } from "@/components/admin/shipping/shipping-editor";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import type { ShippingZoneInput } from "@/lib/validators/shipping";
import type { AdminShippingZone } from "@/server/shipping";
import { Eye, EyeOff } from "lucide-react";

type Flash = { kind: "error" | "success"; text: string } | null;

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

const columnHelper = createColumnHelper<AdminShippingZone>();

/**
 * Shipping zones manager (plan E2, 9c.8 "DataTable + side Sheet editor"). The list
 * is a `DataTable` with URL-synced sort/page/search; editing happens in a right-hand
 * `Sheet`. Owner/manager only (mirrors the `has_role(['owner','manager'])` policy and
 * the sidebar gate). Data stays server-driven — every save/delete revalidates and the
 * page re-renders with fresh props.
 */
export function ShippingManager({
  zones,
  initialQuery,
}: Readonly<{
  zones: AdminShippingZone[];
  initialQuery: Partial<DataTableQuery>;
}>) {
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = React.useState<DataTableQuery>(() =>
    normalizeQuery(initialQuery),
  );
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminShippingZone | undefined>(
    undefined,
  );
  const [flash, setFlash] = React.useState<Flash>(null);

  function pushQuery(next: DataTableQuery) {
    setQuery(next);
    const search = toSearchParams(next);
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  const filtered = React.useMemo(() => {
    const term = query.q.trim().toLowerCase();
    if (!term) return zones;
    return zones.filter((z) =>
      [z.name_en, z.name_bn ?? ""].join(" ").toLowerCase().includes(term),
    );
  }, [zones, query.q]);

  function openNew() {
    setEditing(undefined);
    setEditorOpen(true);
    setFlash(null);
  }

  function openEdit(zone: AdminShippingZone) {
    setEditing(zone);
    setEditorOpen(true);
    setFlash(null);
  }

  async function handleSave(payload: ShippingZoneInput & { id?: string }) {
    const result = await saveShippingZone(payload);
    if (!result.ok) {
      setFlash({ kind: "error", text: result.error });
      return false;
    }
    router.refresh();
    setEditorOpen(false);
    setFlash({ kind: "success", text: "Saved." });
    return true;
  }

  async function handleDelete(id: string) {
    const result = await deleteShippingZone(id);
    if (!result.ok) {
      setFlash({ kind: "error", text: result.error });
      return;
    }
    router.refresh();
    setEditorOpen(false);
    setFlash({ kind: "success", text: "Zone deleted." });
  }

  const columns = React.useMemo<DataTableColumn<AdminShippingZone>[]>(
    () => [
      columnHelper.accessor("name_en", {
        header: "Zone",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {row.original.name_en}
            </p>
            {row.original.name_bn ? (
              <p lang="bn" className="truncate text-xs text-muted-foreground">
                {row.original.name_bn}
              </p>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor("fee", {
        header: "Fee",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-sm">
            {formatMoney(getValue(), "en")}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.free_over, {
        id: "free_over",
        header: "Free over",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm text-muted-foreground">
            {row.original.free_over == null
              ? "—"
              : formatMoney(row.original.free_over, "en")}
          </span>
        ),
      }),
      columnHelper.accessor((row) => (row.is_active ? "active" : "hidden"), {
        id: "status",
        header: "Status",
        cell: ({ row }) =>
          row.original.is_active ? (
            <ToneBadge tone="success" icon={Eye}>
              Active
            </ToneBadge>
          ) : (
            <ToneBadge tone="neutral" icon={EyeOff}>
              Hidden
            </ToneBadge>
          ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openEdit(row.original)}
            >
              <Pencil
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4"
              />
              Edit
              <span className="sr-only">: {row.original.name_en}</span>
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  function renderMobileCard(row: AdminShippingZone) {
    return (
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium text-foreground">{row.name_en}</p>
          {row.name_bn ? (
            <p lang="bn" className="truncate text-xs text-muted-foreground">
              {row.name_bn}
            </p>
          ) : null}
          <p className="text-sm tabular-nums text-muted-foreground">
            {formatMoney(row.fee, "en")}
            {row.free_over != null ? (
              <> · free over {formatMoney(row.free_over, "en")}</>
            ) : null}
          </p>
          <div className="pt-1">
            {row.is_active ? (
              <ToneBadge tone="success" icon={Eye}>
                Active
              </ToneBadge>
            ) : (
              <ToneBadge tone="neutral" icon={EyeOff}>
                Hidden
              </ToneBadge>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
          <Pencil aria-hidden="true" strokeWidth={1.75} className="size-4" />
          Edit
          <span className="sr-only">: {row.name_en}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipping zones"
        description="Set the delivery fee and free-shipping threshold for each area."
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
            New zone
          </Button>
        }
      />

      {flash ? (
        <div
          role="status"
          className={`rounded-control border px-3 py-2 text-sm ${
            flash.kind === "error"
              ? "border-destructive/30 bg-destructive-soft text-destructive"
              : "border-success/30 bg-success-soft text-success"
          }`}
        >
          {flash.text}
        </div>
      ) : null}

      <FilterBar
        value={query.q}
        label="Search zones"
        placeholder="Search by name…"
        canReset={query.q !== ""}
        onSearch={(q) => pushQuery({ ...query, q, page: 1 })}
        onReset={() =>
          pushQuery({ ...DEFAULT_QUERY, pageSize: query.pageSize })
        }
      />

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(row) => row.id}
        query={query}
        onQueryChange={pushQuery}
        renderMobileCard={renderMobileCard}
        caption="Shipping zones, their fees and free-shipping thresholds"
        empty={
          zones.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="No shipping zones yet"
              description="Create a zone to set the delivery fee customers see at checkout."
              action={
                <Button size="sm" onClick={openNew}>
                  <Plus
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4"
                  />
                  New zone
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Truck}
              title="No matches"
              description="No zones match your search."
            />
          )
        }
      />

      <ShippingZoneEditor
        key={editing?.id ?? "new"}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        zone={editing}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
