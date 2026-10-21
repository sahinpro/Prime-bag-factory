"use client";

import * as React from "react";

import { saveCompany } from "@/app/(admin)/admin/settings/actions";
import { FormSection } from "@/components/admin/forms/form-section";
import { StickySaveBar } from "@/components/admin/forms/sticky-save-bar";
import {
  FlashLine,
  useActionSave,
} from "@/components/admin/products/use-action-save";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanyProfile } from "@/server/settings";

/**
 * Company profile form (plan §9 Settings, order-of-work step 9). The values feed
 * the printable invoice/quotation/spec sheets and the new-order notification
 * recipient (`email`), so they are business contact details, not customer PII.
 * Saved through `saveCompany` (zod + audit) with the sticky save bar; the page
 * re-hydrates on success so `dirty` recomputes from a clean baseline.
 */
export function CompanyForm({
  initial,
}: Readonly<{ initial: CompanyProfile }>) {
  const { saving, flash, run } = useActionSave();
  const baseline = React.useMemo(
    () => ({
      name: initial.name,
      phone: initial.phone,
      email: initial.email,
      whatsapp: initial.whatsapp,
    }),
    [initial],
  );
  const [form, setForm] = React.useState(baseline);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    return run(() => saveCompany(form), "Company profile saved.");
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <FormSection
        title="Company identity"
        description="Shown on invoices, quotations and the production spec sheet."
      >
        <div className="space-y-1.5">
          <Label htmlFor="company-name">Company name</Label>
          <Input
            id="company-name"
            name="company_name"
            autoComplete="off"
            maxLength={120}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
      </FormSection>

      <FormSection
        title="Contact"
        description="The email receives new-order alerts; phone and WhatsApp appear on print sheets."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="company-phone">Phone</Label>
            <Input
              id="company-phone"
              name="company_phone"
              autoComplete="off"
              maxLength={40}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+880…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company-whatsapp">WhatsApp</Label>
            <Input
              id="company-whatsapp"
              name="company_whatsapp"
              autoComplete="off"
              maxLength={40}
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              placeholder="8801700…"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="company-email">Email</Label>
            <Input
              id="company-email"
              name="company_email"
              type="email"
              autoComplete="off"
              maxLength={320}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="info@example.com"
            />
          </div>
        </div>
      </FormSection>

      <div className="space-y-3 pt-2">
        <FlashLine flash={flash} />
        <StickySaveBar
          dirty={dirty}
          saving={saving}
          onSave={() => {
            void handleSave();
          }}
          onDiscard={() => {
            setForm(baseline);
          }}
        />
      </div>
    </form>
  );
}
