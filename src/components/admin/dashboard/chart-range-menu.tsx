"use client";

import { MoreHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { Range } from "@/server/dashboard";

// ChartCard ⋯ menu (plan 9c.5): switch range now; CSV download is a stub until
// the Reports phase (Phase 8) wires the real export.

const RANGES: { value: Range; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
];

export function ChartRangeMenu({
  value,
  baseQuery = "",
}: {
  value: Range;
  baseQuery?: string;
}) {
  const router = useRouter();

  function selectRange(next: Range) {
    const params = new URLSearchParams(baseQuery);
    params.set("range", next);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal
            aria-hidden="true"
            strokeWidth={1.75}
            className="size-4"
          />
          <span className="sr-only">Chart options</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Range</DropdownMenuLabel>
        {RANGES.map((r) => (
          <DropdownMenuItem key={r.value} onClick={() => selectRange(r.value)}>
            {r.label}
            {r.value === value ? " (current)" : ""}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Download CSV (Phase 8)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
