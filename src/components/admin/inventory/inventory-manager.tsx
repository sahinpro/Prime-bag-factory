"use client";

import {
  Boxes,
  Download,
  History,
  SearchX,
  SlidersHorizontal,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { AdjustStockDialog } from "@/components/admin/inventory/adjust-stock-dialog";
import { MovementDrawer } from "@/components/admin/inventory/movement-drawer";
import {
  createColumnHelper,
  DataTable,
  type DataTableColumn,
  type DataTableQuery,
} from "@/components/admin/data/data-table";
import { EmptyState } from "@/components/admin/data/empty-state";
import { ErrorState } from "@/components/admin/data/error-state";
import { FilterBar } from "@/components/admin/data/filter-bar";
import { StatusBadge } from "@/components/admin/data/status-badge";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";
import type { InventoryRow } from "@/server/inventory";

/**
 * Inventory list (plan §9 Inventory / 15.2 E1). A variant-level stock ledger:
 * available = stock − reserved, with the low/out status badge, an Adjust action
 * (the `admin_adjust_stock` RPC) and a movement-history drawer. `page`/`sort`/`q`
 * ride the URL like every other admin list; a "Low stock" toggle narrows to the
 * variants that need attention, and Export CSV downloads the current view.
 */

type InventoryQuery = DataTableQuery & { low: boolean };

const DEFAULT_QUERY: InventoryQuery = {
  q: "",
  sort: null,
  dir: "asc",
  page: 1,
  pageSize: 25,
  low: false,
};

function toSearchParams(q: InventoryQuery): string {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.sort) {
    p.set("sort", q.sort);
    p.set("dir", q.dir);
  }
  if (q.page > 1) p.set("page", String(q.page));
  if (q.pageSize !== DEFAULT_QUERY.pageSize)
    p.set("size", String(q.pageSize));
  if (q.low) p.set("low", "1");
  return p.toString();
}

function normalizeQuery(
  input: Partial<InventoryQuery> | undefined,
): InventoryQuery {
  const size = Number(input?.pageSize);
  const page = Number(input?.page);
  return {
    q: input?.q ?? "",
    sort: input?.sort || null,
    dir: input?.dir === "desc" ? "desc" : "asc",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: [10, 25, 50].includes(size) ? size : DEFAULT_QUERY.pageSize,
    low: Boolean(input?.low),
  };
}

const columnHelper = createColumnHelper<InventoryRow>();

function Count({ value }: Readonly<{ value: number }>) {
  return <span className="tabular-nums">{formatNumber(value, "en")}</span>;
}

export function InventoryManager({
  variants,
  initialQuery,
}: Readonly<{
  /** null = the read failed (kit error state, plan 9c.1.4). */
  variants: InventoryRow[] | null;
  initialQuery: Partial<InventoryQuery>;
}>) {
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = React.useState<InventoryQuery>(() =>
    normalizeQuery(initialQuery),
  );
  const [adjustTarget, setAdjustTarget] = React.useState<InventoryRow | null>(
    null,
  );
  const [historyTarget, setHistoryTarget] = React.useState<InventoryRow | null>(
    null,
  );

  function pushQuery(next: InventoryQuery) {
    setQuery(next);
    const search = toSearchParams(next);
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  const filtered = React.useMemo(() => {
    const term = query.q.trim().toLowerCase();
    return (variants ?? []).filter((row) => {
      if (query.low && row.status !== "low" && row.status !== "out") {
        return false;
      }
      if (!term) return true;
      return [row.sku, row.product_title, row.color_name ?? "", row.size ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [variants, query.q, query.low]);

  const columns = React.useMemo<DataTableColumn<InventoryRow>[]>(
    () => [
      columnHelper.accessor("sku", {
        header: "Variant",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-mono text-sm">{row.original.sku}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.product_title}
              {row.original.color_name ? ` · ${row.original.color_name}` : ""}
              {row.original.size ? ` · ${row.original.size}` : ""}
            </p>
          </div>
        ),
      }),
      columnHelper.accessor("stock_qty", {
        header: "On hand",
        cell: ({ row }) => <Count value={row.original.stock_qty} />,
      }),
      columnHelper.accessor("reserved_qty", {
        header: "Reserved",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            <Count value={row.original.reserved_qty} />
          </span>
        ),
      }),
      columnHelper.accessor("available", {
        header: "Available",
        cell: ({ row }) => <Count value={row.original.available} />,
      }),
      columnHelper.accessor("low_stock_threshold", {
        header: "Threshold",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            <Count value={row.original.low_stock_threshold} />
          </span>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ row }) => (
          <StatusBadge domain="stock" value={row.original.status} />
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAdjustTarget(row.original)}
            >
              <SlidersHorizontal aria-hidden="true" strokeWidth={1.75} />
              Adjust
              <span className="sr-only"> stock for {row.original.sku}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setHistoryTarget(row.original)}
            >
              <History aria-hidden="true" strokeWidth={1.75} />
              History
              <span className="sr-only"> for {row.original.sku}</span>
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  function renderCard(row: InventoryRow) {
    return (
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-mono text-sm">{row.sku}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.product_title}
            {row.color_name ? ` · ${row.color_name}` : ""}
            {row.size ? ` · ${row.size}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            Available <Count value={row.available} /> · Reserved{" "}
            <Count value={row.reserved_qty} />
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge domain="stock" value={row.status} />
          <div className="flex gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAdjustTarget(row)}
            >
              Adjust
              <span className="sr-only"> stock for {row.sku}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setHistoryTarget(row)}
            >
              History
              <span className="sr-only"> for {row.sku}</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (variants === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Inventory"
          description="Variant stock, adjustments and movement history."
        />
        <ErrorState
          message="We could not load inventory."
          action={
            <Button variant="outline" onClick={() => router.refresh()}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Variant stock, adjustments and movement history."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar
          value={query.q}
          label="Search inventory"
          placeholder="Search SKU, product, colour or size…"
          canReset={query.q !== "" || query.low}
          onSearch={(q) => pushQuery({ ...query, q, page: 1 })}
          onReset={() => pushQuery({ ...DEFAULT_QUERY, pageSize: query.pageSize })}
          filters={
            <Button
              type="button"
              variant={query.low ? "secondary" : "outline"}
              size="sm"
              aria-pressed={query.low}
              onClick={() => pushQuery({ ...query, low: !query.low, page: 1 })}
            >
              Low stock only
            </Button>
          }
        />
        <Button variant="outline" size="sm" asChild>
          <a href="/admin/inventory/export" download>
            <Download aria-hidden="true" strokeWidth={1.75} />
            Export CSV
          </a>
        </Button>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(row) => row.variant_id}
        query={query}
        onQueryChange={(next) => pushQuery({ ...next, low: query.low })}
        caption="Inventory"
        renderMobileCard={renderCard}
        empty={
          query.q || query.low ? (
            <EmptyState
              icon={SearchX}
              title="No matches"
              description="No variant matches your search and filters."
            />
          ) : (
            <EmptyState
              icon={Boxes}
              title="No variants yet"
              description="Stock appears here once you add variants to a product."
            />
          )
        }
      />

      <AdjustStockDialog
        variant={adjustTarget}
        open={adjustTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAdjustTarget(null);
        }}
      />

      <MovementDrawer
        variant={historyTarget}
        open={historyTarget !== null}
        onOpenChange={(open) => {
          if (!open) setHistoryTarget(null);
        }}
      />
    </div>
  );
}
