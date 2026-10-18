import { ChartSkeleton } from "@/components/admin/dashboard/chart-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Route-level loading UI for the dashboard (plan 9c.9). Matches the final grid so
// widgets do not shift when data arrives: KPI cards, two chart cards, list rows.
export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-40 rounded-control" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-33 rounded-card" />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-85 rounded-card" />
        <div className="rounded-card border border-sidebar-border p-4">
          <Skeleton className="mb-4 h-5 w-32" />
          <ChartSkeleton height="md" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-70 rounded-card" />
          <Skeleton className="h-50 rounded-card" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-60 rounded-card" />
          <Skeleton className="h-55 rounded-card" />
        </div>
      </div>
    </div>
  );
}
