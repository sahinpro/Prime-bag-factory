import { Skeleton } from "@/components/ui/skeleton";

// Skeleton for the Security page (plan 9c.9): a header plus the enforcement card
// and the enrolment card, sized to the final layout so nothing shifts on load.
export default function SecurityLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 border-b border-border pb-5">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Skeleton className="h-28 w-full rounded-card" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-48 w-full rounded-card" />
      </div>
    </div>
  );
}
