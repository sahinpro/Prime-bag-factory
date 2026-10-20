"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import * as React from "react";

import { DetailDrawer } from "@/components/admin/data/detail-drawer";
import { EmptyState } from "@/components/admin/data/empty-state";
import {
  FlashLine,
  useActionSave,
} from "@/components/admin/products/use-action-save";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import {
  getMovements,
  setThreshold,
} from "@/app/(admin)/admin/inventory/actions";
import type { InventoryRow, MovementRow } from "@/server/inventory";

/**
 * Movement drawer (plan §9 Inventory / 15.2 E1): the full ledger for one
 * variant plus its low-stock threshold. History is fetched on open (movements
 * accumulate, so only the selected variant's trail loads). The threshold is
 * plain metadata, edited with a direct write; stock itself is only ever changed
 * through the Adjust dialog's RPC.
 */

const REASON_LABELS: Record<string, string> = {
  opening: "Opening balance",
  purchase: "Purchase / restock",
  sale: "Sale",
  return: "Return",
  adjustment: "Adjustment",
  damage: "Damage",
  cancel_release: "Cancelled-order release",
};

export function MovementDrawer({
  variant,
  open,
  onOpenChange,
}: Readonly<{
  variant: InventoryRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const [data, setData] = React.useState<{
    id: string;
    rows: MovementRow[] | null;
  } | null>(null);

  const variantId = variant?.variant_id;

  React.useEffect(() => {
    if (!open || !variantId) return;
    let active = true;
    // setState only inside the async callback — never synchronously in the
    // effect body (React Compiler). `data.id` mismatch is the loading signal.
    void getMovements(variantId).then((res) => {
      if (active) setData({ id: variantId, rows: res.rows });
    });
    return () => {
      active = false;
    };
  }, [open, variantId]);

  const loading = Boolean(variant) && data?.id !== variant?.variant_id;
  const rows =
    data && data.id === variant?.variant_id ? data.rows : null;

  return (
    <DetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={variant ? variant.sku : ""}
      description={
        variant ? (
          <span>
            {variant.product_title}
            {variant.color_name ? ` · ${variant.color_name}` : ""}
            {variant.size ? ` · ${variant.size}` : ""}
          </span>
        ) : null
      }
    >
      {variant ? (
        <div className="space-y-6">
          <ThresholdEditor key={variant.variant_id} variant={variant} />

          <section aria-labelledby="movement-history-heading">
            <h3
              id="movement-history-heading"
              className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Movement history
            </h3>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-card" />
                ))}
              </div>
            ) : rows === null ? (
              <p className="text-sm text-destructive">
                Could not load the movement history.
              </p>
            ) : rows.length === 0 ? (
              <EmptyState
                icon={ArrowUpRight}
                title="No movements yet"
                description="This variant has no recorded stock movements."
              />
            ) : (
              <ul className="space-y-2">
                {rows.map((m) => (
                  <MovementItem key={m.id} movement={m} />
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </DetailDrawer>
  );
}

function MovementItem({
  movement,
}: Readonly<{ movement: MovementRow }>) {
  const positive = movement.delta >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;
  return (
    <li className="flex items-start gap-3 rounded-card border border-border p-3">
      <Icon
        aria-hidden="true"
        strokeWidth={1.75}
        className={
          positive
            ? "mt-0.5 size-4 shrink-0 text-success"
            : "mt-0.5 size-4 shrink-0 text-destructive"
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            {REASON_LABELS[movement.reason] ?? movement.reason}
          </p>
          <p
            className={`shrink-0 text-sm font-medium tabular-nums ${
              positive ? "text-success" : "text-destructive"
            }`}
          >
            {positive ? "+" : "−"}
            {Math.abs(movement.delta)}
          </p>
        </div>
        {movement.note ? (
          <p className="truncate text-xs text-muted-foreground">
            {movement.note}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatDate(new Date(movement.created_at), "en")}
          {movement.actor ? ` · ${movement.actor}` : ""}
          {movement.ref_id ? ` · ${movement.ref_id}` : ""}
        </p>
      </div>
    </li>
  );
}

/**
 * Low-stock threshold editor. Keyed by variant id by the parent so it always
 * initialises from the right row without a reset-in-effect.
 */
function ThresholdEditor({
  variant,
}: Readonly<{ variant: InventoryRow }>) {
  const { saving, flash, run } = useActionSave();
  const [value, setValue] = React.useState(String(variant.low_stock_threshold));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await run(
      () =>
        setThreshold({
          variantId: variant.variant_id,
          threshold: value,
        }),
      "Threshold saved.",
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-card border border-border p-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="threshold-input">Low-stock threshold</Label>
          <Input
            id="threshold-input"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={variant.stock_mode !== "tracked"}
          />
        </div>
        <Button type="submit" variant="outline" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {variant.stock_mode === "tracked"
          ? "Flags the variant as low when available stock is at or below this number."
          : "Made-to-order variants do not track stock."}
      </p>
      <FlashLine flash={flash} />
    </form>
  );
}
