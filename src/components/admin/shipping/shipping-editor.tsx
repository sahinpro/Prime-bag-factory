"use client";

import { Trash } from "lucide-react";
import * as React from "react";

import { BilingualField } from "@/components/admin/forms/bilingual-field";
import { ConfirmDialog } from "@/components/admin/forms/confirm-dialog";
import { FormSection } from "@/components/admin/forms/form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { ShippingZoneInput } from "@/lib/validators/shipping";
import type { AdminShippingZone } from "@/server/shipping";

type FormState = {
  name_en: string;
  name_bn: string;
  fee: string;
  free_over: string;
  is_active: boolean;
};

function initialState(zone?: AdminShippingZone): FormState {
  return {
    name_en: zone?.name_en ?? "",
    name_bn: zone?.name_bn ?? "",
    fee: zone ? String(zone.fee) : "0",
    free_over: zone?.free_over == null ? "" : String(zone.free_over),
    is_active: zone?.is_active ?? true,
  };
}

/**
 * ShippingZoneEditor (plan 9c.8 "DataTable + side Sheet editor"): the create/edit
 * drawer for a shipping zone. Bilingual name via `BilingualField` (the Bangla value
 * gets `lang="bn"` inside the field), a flat fee and an optional free-over subtotal
 * threshold, and an active toggle. Money is BDT — the fee the customer is charged is
 * recomputed server-side in `place_order`, so this only configures the source of
 * truth. Save/Cancel live in the sticky `SheetFooter`; delete uses `ConfirmDialog`
 * (a referenced zone is refused server-side with prose). The parent controls `open`
 * and remounts via `key` per selection.
 */
export function ShippingZoneEditor({
  open,
  onOpenChange,
  zone,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone?: AdminShippingZone;
  onSave: (payload: ShippingZoneInput & { id?: string }) => Promise<boolean>;
  onDelete?: (id: string) => Promise<void>;
}) {
  const [form, setForm] = React.useState<FormState>(() => initialState(zone));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const initial = React.useMemo(() => initialState(zone), [zone]);

  const dirty = React.useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial],
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload(): ShippingZoneInput & { id?: string } {
    return {
      id: zone?.id,
      name_en: form.name_en,
      name_bn: form.name_bn || undefined,
      fee: Number(form.fee) || 0,
      free_over: form.free_over.trim() === "" ? undefined : Number(form.free_over),
      is_active: form.is_active,
    };
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const ok = await onSave(buildPayload());
    setSaving(false);
    if (!ok) setError("Could not save. Check the fee values and try again.");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg"
        aria-describedby={undefined}
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>{zone ? "Edit shipping zone" : "New shipping zone"}</SheetTitle>
          <SheetDescription>
            Zones set the delivery fee at checkout. The fee is charged from the
            server, never from the browser.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4">
          <FormSection
            title="Basics"
            description="The name shoppers pick at checkout."
          >
            <BilingualField
              id="shipping-name"
              label="Zone name"
              required
              valueEn={form.name_en}
              valueBn={form.name_bn}
              onChangeEn={(v) => set("name_en", v)}
              onChangeBn={(v) => set("name_bn", v)}
            />
          </FormSection>

          <FormSection
            title="Pricing"
            description="Flat fee, waived over a free-over subtotal."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="shipping-fee">Fee (BDT)</Label>
                <Input
                  id="shipping-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.fee}
                  onChange={(e) => set("fee", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shipping-free-over">Free over (BDT, optional)</Label>
                <Input
                  id="shipping-free-over"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={form.free_over}
                  onChange={(e) => set("free_over", e.target.value)}
                  placeholder="e.g. 2000"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Leave “Free over” empty to always charge the fee. When set, orders
              whose subtotal reaches it ship free.
            </p>
          </FormSection>

          <FormSection title="Availability" description="Show this zone at checkout.">
            <div className="flex items-center justify-between gap-3 rounded-control border border-sidebar-border bg-surface-2 px-3 py-2">
              <Label htmlFor="shipping-active" className="text-sm">
                Active
              </Label>
              <Switch
                id="shipping-active"
                checked={form.is_active}
                onCheckedChange={(v) => set("is_active", v)}
              />
            </div>
          </FormSection>

          {error ? (
            <p role="alert" className="py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {zone && onDelete ? (
            <div className="flex items-center justify-between gap-4 border-t border-border py-6">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Delete this zone
                </p>
                <p className="text-xs text-muted-foreground">
                  Zones used by past orders cannot be deleted — deactivate instead.
                </p>
              </div>
              <ConfirmDialog
                destructive
                title={`Delete “${zone.name_en}”?`}
                description="This removes the zone permanently. If any order references it, deletion is refused and you should deactivate it instead."
                confirmLabel="Delete zone"
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash aria-hidden="true" strokeWidth={1.75} className="size-4" />
                    Delete
                  </Button>
                }
                onConfirm={async () => {
                  await onDelete(zone.id);
                }}
              />
            </div>
          ) : null}
        </div>

        <SheetFooter className="border-t border-border sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {dirty ? "Unsaved changes" : "Nothing to save yet"}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setForm(initial);
                setError(null);
                onOpenChange(false);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
