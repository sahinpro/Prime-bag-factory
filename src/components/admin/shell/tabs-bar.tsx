"use client";

import { useRouter } from "next/navigation";

import type { Range } from "@/server/dashboard";

// Range TabsBar (plan 9c.3/9c.5): a compact segmented control. Selection is stored
// in the URL as ?range= so widgets and exports stay shareable (admin is English,
// so this control intentionally does not use next-intl). The server passes the
// current query string so no useSearchParams/Suspense boundary is needed.

const OPTIONS: { value: Range; label: string }[] = [
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "90d", label: "90d" },
];

export function TabsBar({
  value,
  baseQuery = "",
}: {
  value: Range;
  baseQuery?: string;
}) {
  const router = useRouter();

  function selectRange(next: Range) {
    if (next === value) return;
    const params = new URLSearchParams(baseQuery);
    params.set("range", next);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      role="group"
      aria-label="Time range"
      className="inline-flex items-center gap-1 rounded-control border border-sidebar-border bg-surface-2 p-1"
    >
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => selectRange(option.value)}
            className={`h-5 cursor-pointer rounded-md px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 ${
              active
                ? "bg-sidebar-active text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
