"use client";

import { Package, ShoppingCart } from "lucide-react";
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
import { StatusBadge } from "@/components/admin/data/status-badge";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/validators/order-admin";
import type { AdminOrderListItem, OrderStatusCounts } from "@/server/orders";

/**
 * Orders list (plan 9c.8): "TabsBar by status with counts, FilterBar (date,
 * payment, type retail/bulk, production), DataTable (order no, customer + phone,
 * type, items, total, paid / balance, status, payment, date)". Pipeline tabs are
 * links that re-query the server (`?status`); payment/type filters and search run
 * client-side over the loaded rows, exactly like the quotes inbox.
 */

const TAB_LABELS: Record<"all" | OrderStatus, string> = {
  all: "All",
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

const TABS: ("all" | OrderStatus)[] = ["all", ...ORDER_STATUSES];

type PaymentKey = "all" | "unpaid" | "partially_paid" | "paid" | "refunded";
type TypeKey = "all" | "retail" | "bulk";

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

const columnHelper = createColumnHelper<AdminOrderListItem>();

function Money({ value }: Readonly<{ value: number }>) {
  return <span className="tabular-nums">{formatMoney(value, "en")}</span>;
}

export function OrdersTable({
  orders,
  counts,
  status,
  initialQuery,
}: Readonly<{
  orders: AdminOrderListItem[];
  counts: OrderStatusCounts;
  status?: OrderStatus;
  initialQuery: Partial<DataTableQuery>;
}>) {
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = React.useState<DataTableQuery>(() =>
    normalizeQuery(initialQuery),
  );
  const [payment, setPayment] = React.useState<PaymentKey>("all");
  const [type, setType] = React.useState<TypeKey>("all");

  function pushQuery(next: DataTableQuery) {
    setQuery(next);
    const search = toSearchParams(next);
    router.replace(search ? `${pathname}?${search}` : pathname, {
      scroll: false,
    });
  }

  const filtered = React.useMemo(() => {
    const term = query.q.trim().toLowerCase();
    return orders.filter((order) => {
      if (payment !== "all" && order.payment_status !== payment) return false;
      if (type !== "all" && order.type !== type) return false;
      if (!term) return true;
      return [
        order.order_no,
        order.customer_name,
        order.customer_phone,
        order.customer_email ?? "",
        order.tracking_code ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [orders, query.q, payment, type]);

  const activeStatus: "all" | OrderStatus = status ?? "all";
  const filtersActive = query.q !== "" || payment !== "all" || type !== "all";

  const columns = React.useMemo<DataTableColumn<AdminOrderListItem>[]>(
    () => [
      columnHelper.accessor("order_no", {
        header: "Order",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground tabular-nums">
              {row.original.order_no}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatDate(new Date(row.original.created_at), "en")}
            </p>
          </div>
        ),
      }),
      columnHelper.accessor("customer_name", {
        header: "Customer",
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm">{row.original.customer_name}</p>
            <p className="truncate text-xs text-muted-foreground tabular-nums">
              {row.original.customer_phone}
            </p>
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.type, {
        header: "Type",
        cell: ({ row }) => (
          <span className="text-sm capitalize text-muted-foreground">
            {row.original.type}
            <span className="sr-only"> order</span>
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.unit_count, {
        id: "items",
        header: "Items",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground tabular-nums">
            {row.original.item_count} line
            {row.original.item_count === 1 ? "" : "s"} ·{" "}
            {formatNumber(row.original.unit_count, "en")} pcs
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.total, {
        header: "Total",
        cell: ({ row }) => (
          <div className="text-sm">
            <Money value={row.original.total} />
            {row.original.balance > 0 ? (
              <p className="text-xs text-muted-foreground">
                Balance <Money value={row.original.balance} />
              </p>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.paid, {
        header: "Paid",
        cell: ({ row }) => (
          <div className="text-sm">
            <Money value={row.original.paid} />
            <p className="text-xs text-muted-foreground">
              Advance <Money value={row.original.advance_due} />
            </p>
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ getValue }) => (
          <StatusBadge domain="order" value={getValue()} />
        ),
      }),
      columnHelper.accessor("payment_status", {
        id: "payment",
        header: "Payment",
        cell: ({ getValue }) => (
          <StatusBadge domain="payment" value={getValue()} />
        ),
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/orders/${row.original.id}`}>
                Open
                <span className="sr-only">: order {row.original.order_no}</span>
              </Link>
            </Button>
          </div>
        ),
      }),
    ],
    [],
  );

  function renderMobileCard(row: AdminOrderListItem) {
    return (
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium text-foreground tabular-nums">
            {row.order_no}
          </p>
          <p className="truncate text-sm">
            {row.customer_name}
            <span className="text-muted-foreground tabular-nums">
              {" · "}
              {row.customer_phone}
            </span>
          </p>
          <p className="text-sm tabular-nums">
            <Money value={row.total} />
            <span className="text-xs text-muted-foreground">
              {" · paid "}
              <Money value={row.paid} />
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <StatusBadge domain="order" value={row.status} />
            <StatusBadge domain="payment" value={row.payment_status} />
          </div>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/admin/orders/${row.id}`}>
            Open
            <span className="sr-only">: order {row.order_no}</span>
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Cash-on-delivery orders from the storefront, with the 50% advance tracked per order."
      />

      <nav
        aria-label="Filter orders by status"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {TABS.map((key) => {
          const isActive = key === activeStatus;
          const href = key === "all" ? pathname : `${pathname}?status=${key}`;
          return (
            <Link
              key={key}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cnTab(isActive)}
            >
              {TAB_LABELS[key]}
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
                {counts[key] ?? 0}
              </span>
            </Link>
          );
        })}
      </nav>

      <FilterBar
        value={query.q}
        label="Search orders"
        placeholder="Search by order number, name, phone…"
        canReset={filtersActive}
        onSearch={(q) => pushQuery({ ...query, q, page: 1 })}
        onReset={() => {
          setPayment("all");
          setType("all");
          pushQuery({ ...DEFAULT_QUERY, pageSize: query.pageSize });
        }}
        filters={
          <>
            <Select
              value={payment}
              onValueChange={(v) => setPayment(v as PaymentKey)}
            >
              <SelectTrigger
                size="sm"
                className="w-40"
                aria-label="Filter by payment status"
              >
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any payment</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partially_paid">Partially paid</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={type} onValueChange={(v) => setType(v as TypeKey)}>
              <SelectTrigger
                size="sm"
                className="w-32"
                aria-label="Filter by order type"
              >
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Both types</SelectItem>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="bulk">Bulk</SelectItem>
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
        caption="Orders with customer, totals, payment and fulfilment status"
        empty={
          orders.length === 0 ? (
            <EmptyState
              icon={ShoppingCart}
              title="No orders yet"
              description="Orders placed at checkout land here, pending confirmation."
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/products">
                    <Package aria-hidden="true" strokeWidth={1.75} />
                    Review the catalog
                  </Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={ShoppingCart}
              title="No matches"
              description="No orders match your search and filters."
            />
          )
        }
      />
    </div>
  );
}

function cnTab(isActive: boolean): string {
  return [
    "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "border-foreground text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  ].join(" ");
}
