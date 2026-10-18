"use client";

import {
  flexRender,
  type PaginationState,
  type Row,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  legacyCreateColumnHelper,
  useLegacyTable,
  type LegacyColumnDef,
} from "@tanstack/react-table/legacy";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import * as React from "react";

import { TableSkeleton } from "@/components/admin/data/table-skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * DataTable (plan 9c.5 / 9c.8 / 9c.10) — the one table used by every admin list.
 * Built on `@tanstack/react-table` over the shadcn table. Sorting, pagination and
 * the row range are owned here but seeded from and reported back to the URL
 * (`page`, `sort`, `dir`, `q`) by the caller, so state survives reload and share.
 * A sticky header, `aria-sort` on sortable columns, 52px rows, a dedicated
 * horizontal-scroll container, and stacked cards below `md`. Loading shows a
 * skeleton of matching shape; an empty page shows the caller's empty state.
 */

export type DataTableColumn<TData extends RowData> =
  // The value slot is intentionally `any`: v9 `ColumnDef` is invariant in TValue,
  // so accessor columns of different value types (string | number | …) must widen
  // here to compose into one column array — the standard TanStack idiom.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  LegacyColumnDef<TData, any>;

/** Column helper bound to this table's legacy feature set (kit abstraction). */
export function createColumnHelper<TData extends RowData>() {
  return legacyCreateColumnHelper<TData>();
}

export type DataTableQuery = {
  q: string;
  sort: string | null;
  dir: "asc" | "desc";
  page: number; // 1-based
  pageSize: number;
};

const PAGE_SIZES = [10, 25, 50] as const;

function sortingToQuery(
  sorting: SortingState,
  page: number,
  pageSize: number,
  q: string,
): Omit<DataTableQuery, "sort" | "dir"> & {
  sort: string | null;
  dir: "asc" | "desc";
} {
  const active = sorting[0];
  return {
    q,
    sort: active ? active.id : null,
    dir: active ? (active.desc ? "desc" : "asc") : "asc",
    page,
    pageSize,
  };
}

export function DataTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  query,
  onQueryChange,
  loading = false,
  empty,
  renderMobileCard,
  caption,
  className,
}: {
  data: TData[];
  columns: DataTableColumn<TData>[];
  getRowId: (row: TData) => string;
  /** Current URL-derived state. The table is a pure function of this + data. */
  query: DataTableQuery;
  onQueryChange: (next: DataTableQuery) => void;
  loading?: boolean;
  empty?: React.ReactNode;
  renderMobileCard: (row: TData) => React.ReactNode;
  caption?: string;
  className?: string;
}) {
  const sorting = React.useMemo<SortingState>(
    () => (query.sort ? [{ id: query.sort, desc: query.dir === "desc" }] : []),
    [query.sort, query.dir],
  );
  const pagination = React.useMemo<PaginationState>(
    () => ({
      pageIndex: Math.max(0, query.page - 1),
      pageSize: query.pageSize,
    }),
    [query.page, query.pageSize],
  );

  const table = useLegacyTable<TData>({
    data,
    columns,
    getRowId,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const merged = sortingToQuery(next, 1, query.pageSize, query.q);
      onQueryChange({ ...query, ...merged });
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === "function" ? updater(pagination) : updater;
      onQueryChange({
        ...query,
        page: next.pageIndex + 1,
        pageSize: next.pageSize,
      });
    },
    initialState: {},
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  if (loading) {
    return (
      <TableSkeleton
        rows={query.pageSize > 8 ? 8 : query.pageSize}
        cols={columns.length}
      />
    );
  }

  // Filtering is the caller's job (deterministic, no library quirks); the table
  // sorts and paginates whatever it is handed, so the total is the row count.
  const rows = table.getRowModel().rows;
  const total = data.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const rangeStart = total === 0 ? 0 : pageIndex * pageSize + 1;
  const rangeEnd = Math.min((pageIndex + 1) * pageSize, total);
  const pageCount = table.getPageCount();

  return (
    <div className={cn("space-y-3", className)}>
      {/* Desktop / tablet: real table inside its own horizontal-scroll container. */}
      <div className="hidden overflow-hidden rounded-card border border-border md:block">
        <div className="max-h-[70vh] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-surface-2">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="border-b-border">
                  {headerGroup.headers.map((header) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    const ariaSort =
                      sorted === "asc"
                        ? "ascending"
                        : sorted === "desc"
                          ? "descending"
                          : canSort
                            ? "none"
                            : undefined;
                    return (
                      <TableHead
                        key={header.id}
                        aria-sort={ariaSort}
                        className="h-13 bg-surface-2"
                      >
                        {header.isPlaceholder ? null : canSort ? (
                          <button
                            type="button"
                            onClick={header.column.getToggleSortingHandler()}
                            className="flex cursor-pointer items-center gap-1.5 text-left font-medium"
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {sorted === "asc" ? (
                              <ArrowUp
                                aria-hidden="true"
                                strokeWidth={1.75}
                                className="size-3.5"
                              />
                            ) : sorted === "desc" ? (
                              <ArrowDown
                                aria-hidden="true"
                                strokeWidth={1.75}
                                className="size-3.5"
                              />
                            ) : (
                              <ArrowUpDown
                                aria-hidden="true"
                                strokeWidth={1.75}
                                className="size-3.5 opacity-50"
                              />
                            )}
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 p-0 text-center"
                  >
                    {empty ?? (
                      <span className="text-sm text-muted-foreground">
                        No results.
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="h-13">
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
            {caption ? <caption className="sr-only">{caption}</caption> : null}
          </Table>
        </div>
      </div>

      {/* Mobile: each row becomes a stacked card with the same actions. */}
      <div className="space-y-3 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-card border border-border p-6 text-center">
            {empty ?? (
              <span className="text-sm text-muted-foreground">No results.</span>
            )}
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="rounded-card border border-border">
              {renderMobileCard(row.original)}
            </div>
          ))
        )}
      </div>

      {total > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground tabular-nums">
            {rangeStart}&ndash;{rangeEnd} of {total}
          </p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) =>
                  onQueryChange({ ...query, pageSize: Number(value), page: 1 })
                }
              >
                <SelectTrigger
                  size="sm"
                  className="w-18"
                  aria-label="Rows per page"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
              >
                <ChevronLeft aria-hidden="true" strokeWidth={1.75} />
              </Button>
              <span className="min-w-16 text-center text-sm tabular-nums">
                Page {pageIndex + 1} of {pageCount || 1}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
              >
                <ChevronRight aria-hidden="true" strokeWidth={1.75} />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type { Row as DataTableRow };
