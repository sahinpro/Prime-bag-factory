import { Skeleton } from "@/components/ui/skeleton";

// Skeleton for the Categories two-pane layout (plan 9c.9). Matches final sizes so
// the tree and editor do not shift when data arrives.
export default function CategoriesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-32 rounded-control" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-90 rounded-card" />
        <Skeleton className="h-130 rounded-card lg:col-span-2" />
      </div>
    </div>
  );
}
