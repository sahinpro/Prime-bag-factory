import {
  Activity,
  ArrowRight,
  Boxes,
  CalendarClock,
  ClipboardList,
  Languages,
  MessageSquare,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { ActivityFeed } from "@/components/admin/dashboard/activity-feed";
import { ChartCard } from "@/components/admin/dashboard/chart-card";
import { ChartRangeMenu } from "@/components/admin/dashboard/chart-range-menu";
import { SegmentBar } from "@/components/admin/dashboard/segment-bar";
import { StatCard } from "@/components/admin/dashboard/stat-card";
import { EmptyState } from "@/components/admin/data/empty-state";
import { ErrorState } from "@/components/admin/data/error-state";
import { StatusBadge } from "@/components/admin/data/status-badge";
import { PageHeader } from "@/components/admin/shell/page-header";
import { TabsBar } from "@/components/admin/shell/tabs-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getDashboardData,
  type DashboardData,
  type Range,
} from "@/server/dashboard";

export const instant = false;

export const metadata = { title: "Dashboard" };

const RANGES: Range[] = ["7d", "30d", "90d"];

function resolveRange(raw?: string): Range {
  return RANGES.includes(raw as Range) ? (raw as Range) : "30d";
}

function urgencyFor(neededBy: string | null): string | null {
  if (!neededBy) return null;
  const diffDays = (new Date(neededBy).getTime() - Date.now()) / 86_400_000;
  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "due_soon";
  return "later";
}

export default async function DashboardPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ range?: string }>;
}>) {
  // Force request-time rendering so the time-based helpers below (Date.now in
  // getDashboardData / urgencyFor / ActivityFeed) are never evaluated during
  // prerender (Next 16 PPR "blocking-prerender-current-time").
  await connection();
  const { range: rawRange } = await searchParams;
  const activeRange = resolveRange(rawRange);
  const data = await getDashboardData(activeRange);

  // Preserve any other query params when the range control rewrites the URL.
  const baseQuery = new URLSearchParams({ range: activeRange }).toString();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="A snapshot of quotes, stock and catalog health."
        actions={<TabsBar value={activeRange} baseQuery={baseQuery} />}
      />

      {data.fatal ? (
        <Card className="rounded-card py-0">
          <ErrorState
            title="Couldn't load the dashboard"
            message="The database couldn't be reached. Check the Supabase connection and try again."
            action={
              <Button asChild size="sm">
                <Link href={`/admin?${baseQuery}`}>Try again</Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <DashboardBody data={data} baseQuery={baseQuery} />
      )}
    </div>
  );
}

function DashboardBody({
  data,
  baseQuery,
}: Readonly<{ data: DashboardData; baseQuery: string }>) {
  const rangeLabel = `last ${data.days} days`;
  const totalPipeline = data.pipeline.reduce((sum, s) => sum + s.value, 0);

  return (
    <>
      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Sales"
          value="—"
          icon={TrendingUp}
          caption="Order data arrives in Phase 5"
        />
        <StatCard
          label="New quotes"
          value={String(data.newQuotes.count)}
          icon={MessageSquare}
          sparkline={data.newQuotes.spark}
          delta={
            data.newQuotes.deltaPct !== null
              ? {
                  value: data.newQuotes.deltaPct,
                  display: `${data.newQuotes.deltaPct >= 0 ? "+" : ""}${data.newQuotes.deltaPct}%`,
                  label: `vs previous ${data.days} days`,
                }
              : undefined
          }
          caption={
            data.newQuotes.deltaPct === null ? `${rangeLabel}` : undefined
          }
        />
        <StatCard
          label="Pending orders"
          value="—"
          icon={ClipboardList}
          caption="Order data arrives in Phase 5"
        />
        <StatCard
          label="Low stock"
          value={String(data.lowStockCount)}
          icon={Boxes}
          caption={
            data.lowStockCount > 0
              ? "variants below threshold"
              : "all variants above threshold"
          }
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Sales trend"
          subtitle={rangeLabel}
          menu={<ChartRangeMenu value={data.range} baseQuery={baseQuery} />}
        >
          <EmptyState
            icon={TrendingUp}
            title="No sales data yet"
            description="Order data arrives in Phase 5."
          />
        </ChartCard>

        <ChartCard
          title="Quote pipeline"
          subtitle={`${totalPipeline} quotes by stage`}
          info="All quote requests grouped by their current stage."
        >
          {totalPipeline === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No quotes yet"
              description="Quote requests will appear here by stage."
            />
          ) : (
            <SegmentBar
              segments={data.pipeline.map((s) => ({
                label: s.label,
                value: s.value,
                color: s.color,
              }))}
              total={totalPipeline}
            />
          )}
        </ChartCard>
      </div>

      {/* Lists + feed row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="rounded-card py-0">
            <CardHeader className="px-5 py-4">
              <CardTitle className="text-base">Quotes needing action</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-2">
              {data.quotesNeedingAction.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="Nothing to action"
                  description="No new or contacted quotes are waiting."
                />
              ) : (
                <ul className="divide-y divide-sidebar-border">
                  {data.quotesNeedingAction.map((q) => {
                    const urgency = urgencyFor(q.neededBy);
                    return (
                      <li
                        key={q.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {q.company ?? q.contact}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {q.contact}
                            {q.quantity != null
                              ? ` · ${q.quantity.toLocaleString()} pcs`
                              : ""}
                          </p>
                        </div>
                        {urgency ? (
                          <StatusBadge domain="urgency" value={urgency} />
                        ) : null}
                        <StatusBadge domain="quote" value={q.status} />
                        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {q.ageDays}d ago
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-card py-0">
            <CardHeader className="px-5 py-4">
              <CardTitle className="text-base">Recent orders</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-2">
              <EmptyState
                icon={ShoppingCart}
                title="No orders yet"
                description="Order data arrives in Phase 5."
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="rounded-card py-0">
            <CardHeader className="px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Boxes
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 text-muted-foreground"
                />
                Low stock
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-2">
              {data.lowStock.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title="Stock is healthy"
                  description="No active variants are below their threshold."
                />
              ) : (
                <ul className="divide-y divide-sidebar-border">
                  {data.lowStock.slice(0, 8).map((v) => (
                    <li
                      key={v.variantId}
                      className="flex items-center gap-3 py-2.5 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{v.product}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {v.sku}
                        </p>
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {v.available}/{v.threshold}
                      </span>
                      <StatusBadge
                        domain="stock"
                        value={v.available <= 0 ? "out" : "low"}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-card py-0">
            <CardHeader className="px-5 py-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4 text-muted-foreground"
                />
                Recent activity
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-2">
              <ActivityFeed entries={data.activity} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Missing Bangla strip */}
      <Card className="rounded-card py-0">
        <CardContent className="flex flex-wrap items-center gap-3 px-5 py-4">
          <span className="flex size-9 items-center justify-center rounded-lg bg-warning-soft text-warning">
            <Languages
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-5"
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {data.missingBangla.products + data.missingBangla.categories === 0
                ? "Catalog is fully bilingual"
                : `${data.missingBangla.products} product${
                    data.missingBangla.products === 1 ? "" : "s"
                  } and ${data.missingBangla.categories} categor${
                    data.missingBangla.categories === 1 ? "y" : "ies"
                  } missing Bangla`}
            </p>
            <p className="text-xs text-muted-foreground">
              Translate the missing Bangla titles to complete the catalog. The
              editor arrives with the Products module this phase.
            </p>
          </div>
          {data.missingBangla.products + data.missingBangla.categories > 0 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin/products">
                Review catalog
                <ArrowRight
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
              </Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      {data.degraded.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarClock
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-3.5"
          />
          Some widgets are unavailable right now ({data.degraded.join(", ")}).
        </p>
      ) : null}
    </>
  );
}
