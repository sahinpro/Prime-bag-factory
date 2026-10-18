"use client";

import { Search, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * FilterBar (plan 9c.5 / 9c.8): a debounced (300ms) search box with a clear
 * affordance and a Reset action, plus an optional slot for filter popovers that
 * list pages add later (status, date range, source). The search is uncontrolled
 * internally so typing stays instant, and pushes the settled value up to the URL.
 */
export function FilterBar({
  value,
  onSearch,
  onReset,
  placeholder = "Search…",
  label = "Search",
  filters,
  canReset = false,
  className,
}: {
  value: string;
  onSearch: (next: string) => void;
  onReset: () => void;
  placeholder?: string;
  label?: string;
  /** Extra filter controls (popovers, chips) rendered after the search box. */
  filters?: React.ReactNode;
  /** Show Reset only when a filter/search is active. */
  canReset?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = React.useState(value);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handleChange(next: string) {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onSearch(next), 300);
  }

  function clear() {
    if (timer.current) clearTimeout(timer.current);
    setDraft("");
    onSearch("");
  }

  function reset() {
    if (timer.current) clearTimeout(timer.current);
    setDraft("");
    onReset();
  }

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="search"
    >
      <div className="relative min-w-0 grow sm:max-w-xs">
        <Search
          aria-hidden="true"
          strokeWidth={1.75}
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={draft}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="pl-8"
        />
        {draft ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={clear}
            aria-label="Clear search"
            className="absolute top-1/2 right-1 -translate-y-1/2"
          >
            <X aria-hidden="true" strokeWidth={1.75} />
          </Button>
        ) : null}
      </div>

      {filters}

      {canReset ? (
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          Reset
        </Button>
      ) : null}
    </div>
  );
}
