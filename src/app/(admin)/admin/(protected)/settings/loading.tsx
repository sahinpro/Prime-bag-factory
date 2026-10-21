import { Skeleton } from "@/components/ui/skeleton";

// Skeleton for the Settings page (plan 9c.9): a header and two form cards sized
// to the final layout so nothing shifts when the settings rows arrive.
export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b border-border pb-5">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {[0, 1].map((n) => (
          <Skeleton key={n} className="h-80 w-full rounded-card" />
        ))}
      </div>
    </div>
  );
}
