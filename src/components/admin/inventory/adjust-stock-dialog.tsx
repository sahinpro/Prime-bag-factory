"use client";

import * as React from "react";

import {
  FlashLine,
  useActionSave,
} from "@/components/admin/products/use-action-save";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatNumber } from "@/lib/format";
import {
  MANUAL_MOVEMENT_REASONS,
  MOVEMENT_REASON_LABELS,
  type ManualMovementReason,
} from "@/lib/validators/inventory";
import { adjustStock } from "@/app/(admin)/admin/inventory/actions";
import type { InventoryRow } from "@/server/inventory";

/**
 * Adjust-stock dialog (plan §9 Inventory / 15.2 E1). A signed movement is
 * entered as a direction + a positive quantity so staff never fight a minus
 * sign; the reason and a required note ride along. The write goes through the
 * `admin_adjust_stock` RPC server-side — this form never touches `stock_qty`.
 */

type Direction = "increase" | "decrease";

export function AdjustStockDialog({
  variant,
  open,
  onOpenChange,
}: Readonly<{
  variant: InventoryRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const { saving, flash, run } = useActionSave();
  const [direction, setDirection] = React.useState<Direction>("increase");
  const [quantity, setQuantity] = React.useState("");
  const [reason, setReason] = React.useState<ManualMovementReason>("purchase");
  const [note, setNote] = React.useState("");

  // Blank the form whenever it closes, so the next variant starts fresh —
  // no reset-in-effect (the React Compiler rightly flags cascading setState).
  function reset() {
    setDirection("increase");
    setQuantity("");
    setReason("purchase");
    setNote("");
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  const qty = Number.parseInt(quantity, 10);
  const validQty = Number.isFinite(qty) && qty > 0;
  const delta = validQty ? (direction === "decrease" ? -qty : qty) : 0;
  const projected = variant ? variant.stock_qty + delta : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!variant) return;
    const ok = await run(
      () =>
        adjustStock({
          variantId: variant.variant_id,
          delta,
          reason,
          note,
        }),
      "Stock adjusted.",
    );
    if (ok) reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {variant ? (
              <>
                <span className="font-mono">{variant.sku}</span> ·{" "}
                {variant.product_title} · currently{" "}
                {formatNumber(variant.stock_qty, "en")} on hand
              </>
            ) : (
              "Record a stock movement with a reason and note."
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <FlashLine flash={flash} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="adjust-direction">Direction</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as Direction)}
              >
                <SelectTrigger id="adjust-direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase">Increase (+)</SelectItem>
                  <SelectItem value="decrease">Decrease (−)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-quantity">Quantity</Label>
              <Input
                id="adjust-quantity"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-reason">Reason</Label>
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as ManualMovementReason)}
            >
              <SelectTrigger id="adjust-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MANUAL_MOVEMENT_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {MOVEMENT_REASON_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-note">Note</Label>
            <Textarea
              id="adjust-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why is this changing? (e.g. Received PO #142)"
              rows={3}
              required
            />
          </div>

          {variant && validQty ? (
            <p className="text-sm text-muted-foreground tabular-nums">
              New stock on hand:{" "}
              <span className="font-medium text-foreground">
                {formatNumber(projected, "en")}
              </span>{" "}
              (available {formatNumber(projected - variant.reserved_qty, "en")})
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !validQty}>
              {saving ? "Saving…" : "Record movement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
