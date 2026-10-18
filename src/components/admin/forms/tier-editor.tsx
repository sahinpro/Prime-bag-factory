"use client";

import {
  ArrowDown,
  ArrowUp,
  Info,
  Plus,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * TierEditor (plan 9c.5): the quantity-range price table on the Pricing tab.
 * A controlled list of `{ min_qty, max_qty, unit_price }` rows (BDT, stored as
 * `numeric(12,2)`). Ranges are ordered by `min_qty`; a null `max_qty` means
 * "and above". Inline validation never blocks a save with a mere warning —
 * gaps/overlaps and a price that rises against a larger quantity are surfaced as
 * warnings, an inverted range is shown as an error. Every row is reachable by
 * keyboard (move up/down, remove) and money is previewed exactly as the storefront
 * will show it. Status is never color alone: each message has an icon + text.
 */

export type TierRow = {
  min_qty: number;
  max_qty: number | null;
  unit_price: number;
};

type RowFeedback = {
  level: "error" | "warning";
  text: string;
};

function emptyTier(after: TierRow[]): TierRow {
  const last = [...after].sort((a, b) => a.min_qty - b.min_qty).at(-1);
  if (!last) return { min_qty: 1, max_qty: null, unit_price: 0 };
  return {
    min_qty: (last.max_qty ?? last.min_qty) + 1,
    max_qty: null,
    unit_price: last.unit_price,
  };
}

/** Sort index order and derive per-row messages from the validated rows. */
function analyze(rows: TierRow[]): (RowFeedback | null)[] {
  // Validate each row's own range first, keyed by original index.
  const own: (RowFeedback | null)[] = rows.map((r) => {
    if (r.unit_price <= 0) {
      return { level: "error", text: "Enter a unit price above zero." };
    }
    if (r.max_qty != null && r.max_qty < r.min_qty) {
      return {
        level: "error",
        text: "Max quantity must be at least the min quantity.",
      };
    }
    return null;
  });

  // Compare against neighbours in ascending min order.
  const ordered = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.min_qty - b.row.min_qty);
  const neighbour: (RowFeedback | null)[] = rows.map(() => null);

  for (let i = 0; i < ordered.length; i += 1) {
    const prev = i > 0 ? ordered[i - 1] : null;
    const cur = ordered[i];

    if (prev) {
      const prevTop = prev.row.max_qty ?? Number.POSITIVE_INFINITY;
      if (cur.row.min_qty <= prevTop) {
        neighbour[cur.index] = {
          level: "warning",
          text: "This range overlaps the one above it.",
        };
      } else if (cur.row.min_qty > prevTop + 1) {
        neighbour[cur.index] = {
          level: "warning",
          text: "There is a gap in quantity coverage above this range.",
        };
      } else if (
        prev.row.max_qty != null &&
        cur.row.unit_price > prev.row.unit_price
      ) {
        neighbour[cur.index] = {
          level: "warning",
          text: "Price rises for buying more — bulk usually gets cheaper.",
        };
      }
    }
  }

  return rows.map((_, index) => own[index] ?? neighbour[index] ?? null);
}

export function TierEditor({
  tiers,
  onChange,
  idPrefix,
}: Readonly<{
  tiers: TierRow[];
  onChange: (next: TierRow[]) => void;
  idPrefix: string;
}>) {
  const feedback = React.useMemo(() => analyze(tiers), [tiers]);

  function update(index: number, patch: Partial<TierRow>) {
    onChange(tiers.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function remove(index: number) {
    onChange(tiers.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...tiers, emptyTier(tiers)]);
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= tiers.length) return;
    const next = [...tiers];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {tiers.length === 0 ? (
        <p className="rounded-control border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No quantity ranges yet. Add one to offer bulk pricing (for example
          5&ndash;50 and 51&ndash;100 pieces).
        </p>
      ) : null}

      <ul className="space-y-3">
        {tiers.map((tier, index) => {
          const fb = feedback[index];
          const hasError = fb?.level === "error";
          return (
            <li
              key={index}
              className="rounded-card border border-border bg-surface-2/40 p-3"
            >
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 space-y-1">
                  <Label
                    htmlFor={`${idPrefix}-min-${index}`}
                    className="text-xs text-muted-foreground"
                  >
                    Min qty
                  </Label>
                  <Input
                    id={`${idPrefix}-min-${index}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={String(tier.min_qty)}
                    onChange={(e) =>
                      update(index, { min_qty: Number(e.target.value) || 0 })
                    }
                    className="w-28"
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <Label
                    htmlFor={`${idPrefix}-max-${index}`}
                    className="text-xs text-muted-foreground"
                  >
                    Max qty
                    <span className="sr-only">
                      {" "}
                      (leave blank for and above)
                    </span>
                  </Label>
                  <Input
                    id={`${idPrefix}-max-${index}`}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={tier.max_qty == null ? "" : String(tier.max_qty)}
                    onChange={(e) =>
                      update(index, {
                        max_qty:
                          e.target.value === ""
                            ? null
                            : Number(e.target.value) || 0,
                      })
                    }
                    placeholder="&"
                    className="w-28"
                  />
                </div>
                <div className="min-w-0 grow space-y-1">
                  <Label
                    htmlFor={`${idPrefix}-price-${index}`}
                    className="text-xs text-muted-foreground"
                  >
                    Unit price (BDT)
                  </Label>
                  <Input
                    id={`${idPrefix}-price-${index}`}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={String(tier.unit_price)}
                    onChange={(e) =>
                      update(index, {
                        unit_price: Number(e.target.value) || 0,
                      })
                    }
                    aria-invalid={hasError || undefined}
                    className="w-full max-w-[10rem]"
                  />
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move range ${index + 1} up`}
                  >
                    <ArrowUp aria-hidden="true" strokeWidth={1.75} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => move(index, 1)}
                    disabled={index === tiers.length - 1}
                    aria-label={`Move range ${index + 1} down`}
                  >
                    <ArrowDown aria-hidden="true" strokeWidth={1.75} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => remove(index)}
                    aria-label={`Remove range ${index + 1}`}
                  >
                    <Trash2 aria-hidden="true" strokeWidth={1.75} />
                  </Button>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  Customer sees:{" "}
                  <span className="font-medium text-foreground tabular-nums">
                    {tier.min_qty}
                    {tier.max_qty != null ? `–${tier.max_qty}` : "+"} pcs &rarr;{" "}
                    {formatMoney(tier.unit_price, "en")}
                  </span>
                </p>
                {fb ? (
                  <p
                    className={cn(
                      "flex items-center gap-1.5 text-xs",
                      fb.level === "error"
                        ? "text-destructive"
                        : "text-warning",
                    )}
                  >
                    {fb.level === "error" ? (
                      <TriangleAlert
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="size-3.5"
                      />
                    ) : (
                      <Info
                        aria-hidden="true"
                        strokeWidth={1.75}
                        className="size-3.5"
                      />
                    )}
                    {fb.text}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus aria-hidden="true" strokeWidth={1.75} className="size-4" />
        Add quantity range
      </Button>
    </div>
  );
}
