"use client";

import { Download, ImageIcon, Package, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import { bulkSetProductStatus } from "@/app/(admin)/admin/products/actions";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMoney, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdminProductSummary } from "@/server/products";

type Flash = { kind: "error" | "success"; text: string } | null;

type StatusKey = "all" | "published" | "draft" | "archived";

const TABS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
  { key: "archived", label: "Archived" },
];

const DEFAULT_QUERY: DataTableQuery = {
  q: "",
  sort: null,
  dir: "desc",
  page: 1,
  pageSize: 10,
};

type Filters = {
  type: "all" | "buy_now" | "quote_only";
  custom: "all" | "yes" | "no";
  stock: "all" | "in" | "out" | "mto";
  category: string; // category name or "all"
};

const DEFAULT_FILTERS: Filters = {
  type: "all",
  custom: "all",
  stock: "all",
  category: "all",
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

const columnHelper = createColumnHelper<AdminProductSummary>();

function Thumb({ product }: { product: AdminProductSummary }) {
  if (product.thumbnail) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.thumbnail}
        alt=""
        aria-hidden="true"
        className="size-10 shrink-0 rounded-[6px] border border-border object-cover"
      />
    );
  }
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-[6px] border border-border bg-surface-2 text-muted-foreground">
      <ImageIcon aria-hidden="true" strokeWidth={1.75} className="size-4" />
    </span>
  );
}

function PriceRange({ product }: { product: AdminProductSummary }) {
  if (product.priceMin == null) {
    return <span className="text-sm text-muted-foreground">On quote</span>;
  }
  if (product.priceMax == null || product.priceMin === product.priceMax) {
    return (
      <span className="tabular-nums text-sm">
        {formatMoney(product.priceMin, "en")}
      </span>
    );
  }
  return (
    <span className="tabular-nums text-sm">
      {formatMoney(product.priceMin, "en")}
      <span className="text-muted-foreground"> &ndash; </span>
      {formatMoney(product.priceMax, "en")}
    </span>
  );
}

function StockCell({ product }: { product: AdminProductSummary }) {
  if (product.available == null) {
    return <span className="text-sm text-muted-foreground">Made to order</span>;
  }
  const tone =
    product.available <= 0
      ? "destructive"
      : product.available < 10
        ? "warning"
        : "success";
  const label =
    product.available <= 0
      ? "Out"
      : product.available < 10
        ? "Low"
        : "In stock";
  return (
    <ToneBadge tone={tone}>
      {formatNumber(product.available, "en")} {label.toLowerCase()}
    </ToneBadge>
  );
}

/**
 * ProductsTable (plan 9c.8). Status tabs are URL links (server re-queries per
 * tab); search + the type/customizable/stock/category filters + row selection are
 * client-side over the loaded tab, mirroring the Collections list. Row editing
 * happens on the tabbed editor route, not a Sheet — a product has too many
 * relations for a drawer. `New product` links to the create route; `Export`
 * downloads the current (filtered) rows as CSV. Bulk Publish/Archive go through
 * the `bulkSetProductStatus` action.
 */
export function ProductsTable({
  products,
  counts,
  status,
  initialQuery,
}: Readonly<{
  products: AdminProductSummary[];
  counts: Record<string, number>;
  status?: StatusKey;
  initialQuery: Partial<DataTableQuery>;
}>) {
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = React.useState<DataTableQuery>(() =>
    normalizeQuery(initialQuery),
  );
  const [filters, setFilters] = React.useState<Filters>(DEFAULT_FILTERS);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [flash, setFlash] = React.useState<Flash>(null);
  const [working, setWorking] = React.useState(false);

  const activeStatus: StatusKey = status ?? "all";

  function pushQuery(next: DataTableQuery) {
    setQuery(next);
    const search = toSearchParams(next);
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  const categoryOptions = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of products) for (const c of p.categories) set.add(c);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const filtered = React.useMemo(() => {
    const term = query.q.trim().toLowerCase();
    return products.filter((p) => {
      if (
        term &&
        ![p.title_en, p.title_bn ?? "", p.slug]
          .join(" ")
          .toLowerCase()
          .includes(term)
      ) {
        return false;
      }
      if (filters.type !== "all" && p.type !== filters.type) return false;
      if (filters.custom === "yes" && !p.customization_enabled) return false;
      if (filters.custom === "no" && p.customization_enabled) return false;
      if (
        filters.category !== "all" &&
        !p.categories.includes(filters.category)
      ) {
        return false;
      }
      if (filters.stock !== "all") {
        if (filters.stock === "mto" && p.available != null) return false;
        if (filters.stock === "in" && !(p.available != null && p.available > 0))
          return false;
        if (
          filters.stock === "out" &&
          !(p.available != null && p.available <= 0)
        )
          return false;
      }
      return true;
    });
  }, [products, query.q, filters]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  const toggleRow = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (filtered.every((p) => prev.has(p.id))) {
        for (const p of filtered) next.delete(p.id);
      } else {
        for (const p of filtered) next.add(p.id);
      }
      return next;
    });
  }, [filtered]);

  function setFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setQuery((q) => ({ ...q, page: 1 }));
  }

  const filtersActive =
    filters.type !== "all" ||
    filters.custom !== "all" ||
    filters.stock !== "all" ||
    filters.category !== "all";

  async function runBulk(target: "published" | "archived") {
    if (selected.size === 0) return;
    setWorking(true);
    setFlash(null);
    const result = await bulkSetProductStatus([...selected], target);
    setWorking(false);
    if (!result.ok) {
      setFlash({ kind: "error", text: result.error });
      return;
    }
    setSelected(new Set());
    router.refresh();
    setFlash({
      kind: "success",
      text: `${target === "published" ? "Published" : "Archived"} ${selected.size} product${selected.size === 1 ? "" : "s"}.`,
    });
  }

  function exportCsv() {
    const header = [
      "Title",
      "Slug",
      "Type",
      "Status",
      "MOQ",
      "Price min",
      "Price max",
      "Available",
      "Categories",
    ];
    const lines = filtered.map((p) =>
      [
        p.title_en,
        p.slug,
        p.type,
        p.status,
        p.moq,
        p.priceMin ?? "",
        p.priceMax ?? "",
        p.available ?? "made_to_order",
        p.categories.join("|"),
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...lines].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `products-${activeStatus}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns = React.useMemo<DataTableColumn<AdminProductSummary>[]>(
    () => [
      columnHelper.display({
        id: "select",
        header: () => (
          <Checkbox
            checked={allFilteredSelected}
            onCheckedChange={toggleAll}
            aria-label="Select all products on this page"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selected.has(row.original.id)}
            onCheckedChange={() => toggleRow(row.original.id)}
            aria-label={`Select ${row.original.title_en}`}
          />
        ),
        size: 40,
      }),
      columnHelper.accessor("title_en", {
        header: "Product",
        cell: ({ row }) => (
          <div className="flex min-w-0 items-center gap-3">
            <Thumb product={row.original} />
            <div className="min-w-0">
              <Link
                href={`/admin/products/${row.original.id}`}
                className="truncate font-medium text-foreground underline-offset-4 hover:underline"
              >
                {row.original.title_en}
              </Link>
              {row.original.title_bn ? (
                <p lang="bn" className="truncate text-xs text-muted-foreground">
                  {row.original.title_bn}
                </p>
              ) : null}
            </div>
          </div>
        ),
      }),
      columnHelper.accessor("type", {
        header: "Type",
        cell: ({ getValue }) => (
          <ToneBadge tone="neutral">
            {getValue() === "buy_now" ? "Buy now" : "Quote only"}
          </ToneBadge>
        ),
      }),
      columnHelper.accessor((row) => row.categories.join(", "), {
        id: "categories",
        header: "Categories",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.categories.length
              ? row.original.categories.join(", ")
              : "—"}
          </span>
        ),
      }),
      columnHelper.accessor("moq", {
        header: "MOQ",
        cell: ({ getValue }) => (
          <span className="tabular-nums text-sm">
            {formatNumber(getValue(), "en")}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.priceMin ?? Number.POSITIVE_INFINITY, {
        id: "price",
        header: "Price",
        cell: ({ row }) => <PriceRange product={row.original} />,
      }),
      columnHelper.accessor((row) => row.available ?? -1, {
        id: "stock",
        header: "Stock",
        cell: ({ row }) => <StockCell product={row.original} />,
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => (
          <StatusBadge domain="product" value={getValue()} />
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/products/${row.original.id}`}>
                <Pencil
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                Edit
                <span className="sr-only">: {row.original.title_en}</span>
              </Link>
            </Button>
          </div>
        ),
      }),
    ],
    // Column cells close over live UI state, so rebuild when it changes.
    [allFilteredSelected, selected, toggleRow, toggleAll],
  );

  function renderMobileCard(row: AdminProductSummary) {
    return (
      <div className="flex items-start gap-3 p-4">
        <Thumb product={row} />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/admin/products/${row.id}`}
              className="truncate font-medium text-foreground underline-offset-4 hover:underline"
            >
              {row.title_en}
            </Link>
            <Checkbox
              checked={selected.has(row.id)}
              onCheckedChange={() => toggleRow(row.id)}
              aria-label={`Select ${row.title_en}`}
            />
          </div>
          {row.title_bn ? (
            <p lang="bn" className="truncate text-xs text-muted-foreground">
              {row.title_bn}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <StatusBadge domain="product" value={row.status} />
            <PriceRange product={row} />
            <span className="text-muted-foreground">
              MOQ {formatNumber(row.moq, "en")}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Your catalog — retail and made-to-order bags with pricing, variants and builder options."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              <Download
                aria-hidden="true"
                strokeWidth={1.75}
                className="size-4"
              />
              Export
            </Button>
            <Button size="sm" asChild>
              <Link href="/admin/products/new">
                <Plus
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                New product
              </Link>
            </Button>
          </>
        }
      />

      {/* Status tabs: each is a link that re-queries the server for that status. */}
      <nav
        aria-label="Filter products by status"
        className="flex gap-1 border-b border-border"
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
                "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
                  isActive
                    ? "bg-surface-2 text-foreground"
                    : "bg-surface-2 text-muted-foreground",
                )}
              >
                {counts[tab.key] ?? 0}
              </span>
            </Link>
          );
        })}
      </nav>

      {flash ? (
        <div
          role="status"
          className={cn(
            "rounded-control border px-3 py-2 text-sm",
            flash.kind === "error"
              ? "border-destructive/30 bg-destructive-soft text-destructive"
              : "border-success/30 bg-success-soft text-success",
          )}
        >
          {flash.text}
        </div>
      ) : null}

      <FilterBar
        value={query.q}
        label="Search products"
        placeholder="Search by title or slug…"
        canReset={query.q !== "" || filtersActive}
        onSearch={(q) => pushQuery({ ...query, q, page: 1 })}
        onReset={() => {
          setFilters(DEFAULT_FILTERS);
          pushQuery({ ...DEFAULT_QUERY, pageSize: query.pageSize });
        }}
        filters={
          <>
            <Select
              value={filters.type}
              onValueChange={(v) => setFilter("type", v as Filters["type"])}
            >
              <SelectTrigger
                size="sm"
                className="w-36"
                aria-label="Filter by type"
              >
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="buy_now">Buy now</SelectItem>
                <SelectItem value="quote_only">Quote only</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.custom}
              onValueChange={(v) => setFilter("custom", v as Filters["custom"])}
            >
              <SelectTrigger
                size="sm"
                className="w-40"
                aria-label="Filter by customization"
              >
                <SelectValue placeholder="Customizable" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any builder</SelectItem>
                <SelectItem value="yes">Customizable</SelectItem>
                <SelectItem value="no">Not customizable</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.stock}
              onValueChange={(v) => setFilter("stock", v as Filters["stock"])}
            >
              <SelectTrigger
                size="sm"
                className="w-40"
                aria-label="Filter by stock"
              >
                <SelectValue placeholder="Stock" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any stock</SelectItem>
                <SelectItem value="in">In stock</SelectItem>
                <SelectItem value="out">Out of stock</SelectItem>
                <SelectItem value="mto">Made to order</SelectItem>
              </SelectContent>
            </Select>
            {categoryOptions.length > 0 ? (
              <Select
                value={filters.category}
                onValueChange={(v) => setFilter("category", v)}
              >
                <SelectTrigger
                  size="sm"
                  className="w-40"
                  aria-label="Filter by category"
                >
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </>
        }
      />

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-control border border-border bg-surface-2 px-3 py-2">
          <p className="text-sm font-medium">{selected.size} selected</p>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={working}
              onClick={() => runBulk("published")}
            >
              Publish
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={working}
              onClick={() => runBulk("archived")}
            >
              Archive
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(row) => row.id}
        query={query}
        onQueryChange={pushQuery}
        renderMobileCard={renderMobileCard}
        caption="Products in the catalog"
        empty={
          products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Create your first product to start building the catalog."
              action={
                <Button size="sm" asChild>
                  <Link href="/admin/products/new">
                    <Plus
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="size-4"
                    />
                    New product
                  </Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Package}
              title="No matches"
              description="No products match this tab and your filters."
            />
          )
        }
      />
    </div>
  );
}
