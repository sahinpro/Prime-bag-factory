"use client";

import { savePriceTiers } from "@/app/(admin)/admin/products/actions";
import { FormSection } from "@/components/admin/forms/form-section";
import { StickySaveBar } from "@/components/admin/forms/sticky-save-bar";
import { TierEditor, type TierRow } from "@/components/admin/forms/tier-editor";
import type { AdminProduct } from "@/server/products";
import * as React from "react";
import { FlashLine, useActionSave } from "../use-action-save";

function toRows(product: AdminProduct): TierRow[] {
  return product.price_tiers
    .slice()
    .sort((a, b) => a.min_qty - b.min_qty)
    .map((t) => ({
      min_qty: t.min_qty,
      max_qty: t.max_qty,
      unit_price: t.unit_price,
    }));
}

/** Pricing tab (plan 9c.8): MOQ lives on General; this is the quantity-range editor. */
export function PricingTab({ product }: Readonly<{ product: AdminProduct }>) {
  const baseline = React.useMemo(() => toRows(product), [product]);
  const [tiers, setTiers] = React.useState<TierRow[]>(baseline);
  const { saving, flash, run } = useActionSave();

  const [prevBaseline, setPrevBaseline] = React.useState(baseline);
  if (prevBaseline !== baseline) {
    setPrevBaseline(baseline);
    setTiers(baseline);
  }

  const dirty = React.useMemo(
    () => JSON.stringify(tiers) !== JSON.stringify(baseline),
    [tiers, baseline],
  );

  async function save() {
    await run(
      () =>
        savePriceTiers(
          product.id,
          tiers.map((t) => ({
            min_qty: t.min_qty,
            max_qty: t.max_qty ?? undefined,
            unit_price: t.unit_price,
          })),
        ),
      "Price ranges saved.",
    );
  }

  return (
    <div className="space-y-2">
      <FlashLine flash={flash} />

      <FormSection
        title="Quantity ranges"
        description={`Bulk price per unit in BDT. This product's minimum order is ${product.moq} pcs. A blank max means "and above".`}
      >
        <TierEditor tiers={tiers} onChange={setTiers} idPrefix="pricing" />
      </FormSection>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onDiscard={() => setTiers(baseline)}
      />
    </div>
  );
}
