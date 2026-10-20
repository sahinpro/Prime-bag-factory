"use client";

import { Phone, SearchX, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import {
  createColumnHelper,
  DataTable,
  type DataTableColumn,
  type DataTableQuery,
} from "@/components/admin/data/data-table";
import { DetailDrawer } from "@/components/admin/data/detail-drawer";
import { EmptyState } from "@/components/admin/data/empty-state";
import { ErrorState } from "@/components/admin/data/error-state";
import { FilterBar } from "@/components/admin/data/filter-bar";
import { StatusBadge } from "@/components/admin/data/status-badge";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import { toBdPhoneDigits } from "@/components/admin/quotes/quote-detail";
import type { CustomerRow } from "@/server/customers";

/**
 * Customers directory (plan §9: "DataTable grouped by phone, detail drawer
 * with orders + quotes history"). Rows come pre-grouped from
 * `listCustomers()` — one row per canonical phone. Search runs client-side
 * over the loaded rows like the orders list; `page`/`sort`/`q` ride the URL.
 * Clicking a customer opens the kit DetailDrawer with both histories and
 * WhatsApp/call quick links — no separate detail route, per the plan.
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

const columnHelper = createColumnHelper<CustomerRow>();

function Money({ value }: Readonly<{ value: number }>) {
  return <span className="tabular-nums">{formatMoney(value, "en")}</span>;
}

function Count({ value }: Readonly<{ value: number }>) {
  return (
    <span className="text-sm text-muted-foreground tabular-nums">
      {formatNumber(value, "en")}
    </span>
  );
}

export function CustomersManager({
  customers,
  initialQuery,
}: Readonly<{
  /** null = one of the source reads failed (kit error state, plan 9c.1.4). */
  customers: CustomerRow[] | null;
  initialQuery: Partial<DataTableQuery>;
}>) {
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = React.useState<DataTableQuery>(() =>
    normalizeQuery(initialQuery),
  );
  const [selectedPhone, setSelectedPhone] = React.useState<string | null>(
    null,
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
    if (!term) return customers ?? [];
    return (customers ?? []).filter((customer) =>
      [
        customer.name,
        customer.phone,
        customer.email ?? "",
        customer.last_order_no ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term),
    );
  }, [customers, query.q]);

  const selected =
    customers && selectedPhone
      ? (customers.find((c) => c.phone === selectedPhone) ?? null)
      : null;

  const columns = React.useMemo<DataTableColumn<CustomerRow>[]>(
    () => [
      columnHelper.accessor("name", {
        header: "Customer",
        cell: ({ row }) => (
          <div className="min-w-0">
            <button
              type="button"
              className="truncate rounded-control text-left text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={() => setSelectedPhone(row.original.phone)}
            >
              {row.original.name}
              <span className="sr-only">
                {" "}
                — open history for {row.original.phone}
              </span>
            </button>
            <p className="truncate text-xs text-muted-foreground tabular-nums">
              {row.original.phone}
            </p>
          </div>
        ),
      }),
      columnHelper.accessor("orders_count", {
        header: "Orders",
        cell: ({ row }) => (
          <div className="text-sm">
            <Count value={row.original.orders_count} />
            {row.original.last_order_no ? (
              <p className="truncate text-xs text-muted-foreground tabular-nums">
                {row.original.last_order_no}
              </p>
            ) : null}
          </div>
        ),
      }),
      columnHelper.accessor("quotes_count", {
        header: "Quotes",
        cell: ({ row }) => <Count value={row.original.quotes_count} />,
      }),
      columnHelper.accessor("lifetime_value", {
        header: "Lifetime value",
        cell: ({ row }) => <Money value={row.original.lifetime_value} />,
      }),
      columnHelper.accessor("last_activity", {
        header: "Last activity",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground tabular-nums">
            {formatDate(new Date(row.original.last_activity), "en")}
          </span>
        ),
      }),
    ],
    [],
  );

  function renderCard(row: CustomerRow) {
    return (
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <button
            type="button"
            className="truncate rounded-control text-left font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            onClick={() => setSelectedPhone(row.phone)}
          >
            {row.name}
            <span className="sr-only"> — open history for {row.phone}</span>
          </button>
          <p className="truncate text-xs text-muted-foreground tabular-nums">
            {row.phone}
          </p>
        </div>
        <div className="shrink-0 text-right text-xs text-muted-foreground">
          <p>
            {formatNumber(row.orders_count, "en")} orders ·{" "}
            {formatNumber(row.quotes_count, "en")} quotes
          </p>
          <p className="tabular-nums">
            <Money value={row.lifetime_value} />
          </p>
        </div>
      </div>
    );
  }

  if (customers === null) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Customers"
          description="Derived from orders and quote requests, grouped by phone."
        />
        <ErrorState
          message="We could not load the customer directory."
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
        title="Customers"
        description="Derived from orders and quote requests, grouped by phone."
      />

      <FilterBar
        value={query.q}
        label="Search customers"
        placeholder="Search name, phone, email or order no…"
        canReset={query.q !== ""}
        onSearch={(q) => pushQuery({ ...query, q, page: 1 })}
        onReset={() => pushQuery({ ...query, q: "", page: 1 })}
      />

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(row) => row.phone}
        query={query}
        onQueryChange={pushQuery}
        caption="Customers"
        renderMobileCard={renderCard}
        empty={
          query.q ? (
            <EmptyState
              icon={SearchX}
              title="No matches"
              description="No customer matches your search."
            />
          ) : (
            <EmptyState
              icon={Users}
              title="No customers yet"
              description="Customers appear here automatically once someone places an order or requests a quote."
            />
          )
        }
      />

      <DetailDrawer
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPhone(null);
        }}
        title={selected?.name ?? ""}
        description={
          selected ? (
            <span className="tabular-nums">
              {selected.phone}
              {selected.email ? ` · ${selected.email}` : ""}
            </span>
          ) : null
        }
        footer={
          selected ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <a
                  href={`https://wa.me/${toBdPhoneDigits(selected.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp
                </a>
              </Button>
              <Button variant="outline" className="flex-1" asChild>
                <a href={`tel:+${toBdPhoneDigits(selected.phone)}`}>
                  <Phone
                    aria-hidden="true"
                    strokeWidth={1.75}
                    className="size-4"
                  />
                  Call
                </a>
              </Button>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-6">
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-card border border-border p-3">
                <dt className="text-xs text-muted-foreground">Orders</dt>
                <dd className="font-medium tabular-nums">
                  {formatNumber(selected.orders_count, "en")}
                </dd>
              </div>
              <div className="rounded-card border border-border p-3">
                <dt className="text-xs text-muted-foreground">Quotes</dt>
                <dd className="font-medium tabular-nums">
                  {formatNumber(selected.quotes_count, "en")}
                </dd>
              </div>
              <div className="rounded-card border border-border p-3">
                <dt className="text-xs text-muted-foreground">Lifetime</dt>
                <dd className="font-medium tabular-nums">
                  <Money value={selected.lifetime_value} />
                </dd>
              </div>
            </dl>

            <section aria-labelledby="customer-orders-heading">
              <h3
                id="customer-orders-heading"
                className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Order history
              </h3>
              {selected.orders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No orders yet — the latest quote is below.
                </p>
              ) : (
                <ul className="space-y-2">
                  {selected.orders.map((order) => (
                    <li
                      key={order.id}
                      className="flex items-center justify-between gap-3 rounded-card border border-border p-3"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="truncate rounded-control text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring tabular-nums"
                        >
                          {order.order_no}
                        </Link>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatDate(new Date(order.created_at), "en")}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge domain="order" value={order.status} />
                        <span className="text-sm tabular-nums">
                          <Money value={order.total} />
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="customer-quotes-heading">
              <h3
                id="customer-quotes-heading"
                className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Quote history
              </h3>
              {selected.quotes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No quote requests from this phone.
                </p>
              ) : (
                <ul className="space-y-2">
                  {selected.quotes.map((quote) => (
                    <li
                      key={quote.id}
                      className="flex items-center justify-between gap-3 rounded-card border border-border p-3"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/admin/quotes/${quote.id}`}
                          className="truncate rounded-control text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                          {quote.source === "builder"
                            ? "Builder request"
                            : "Form request"}
                        </Link>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatDate(new Date(quote.created_at), "en")}
                          {quote.quantity != null
                            ? ` · ${formatNumber(quote.quantity, "en")} pcs`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge domain="quote" value={quote.status} />
                        {quote.quoted_amount != null ? (
                          <span className="text-sm tabular-nums">
                            <Money value={quote.quoted_amount} />
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </DetailDrawer>
    </div>
  );
}
