"use client";

import * as React from "react";

import { deleteContentRow, saveContentRow } from "@/app/(admin)/admin/content/actions";
import { ConfirmDialog } from "@/components/admin/forms/confirm-dialog";
import { BilingualField } from "@/components/admin/forms/bilingual-field";
import { FormSection } from "@/components/admin/forms/form-section";
import { ImageUploader } from "@/components/admin/forms/image-uploader";
import { StickySaveBar } from "@/components/admin/forms/sticky-save-bar";
import { CONTENT_TYPE_CONFIGS, type FieldDef } from "@/components/admin/content/content-types";
import { FlashLine, useActionSave } from "@/components/admin/products/use-action-save";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import type { ContentRow } from "@/server/content-admin";
import type { ContentEntity } from "@/lib/validators/content";

/**
 * ContentEditor (plan 9c.8): the config-driven form behind each content type in
 * the workspace. Fields come from content-types.ts; one flat string form state
 * (bilingual pairs as `name_en`/`name_bn` keys) keeps dirty tracking trivial.
 * The workspace remounts this component per row (React `key`), so the baseline
 * is always the freshly-loaded server row — no cross-row state leaks. Saving and
 * deleting go through the generic content actions (zod + requireRole server
 * side); `useActionSave` refreshes routed data so the list re-renders in order.
 */

type FormState = Record<string, string>;

function fieldNames(field: FieldDef): string[] {
  return field.kind === "bilingual"
    ? [`${field.name}_en`, `${field.name}_bn`]
    : [field.name];
}

/** Initial/committed form values for a row (null = blank draft). */
function fieldsToForm(
  fields: FieldDef[],
  row: ContentRow | null,
): FormState {
  const form: FormState = {};
  for (const field of fields) {
    const values = row?.values ?? {};
    if (field.kind === "bilingual") {
      form[`${field.name}_en`] = str(values[`${field.name}_en`]);
      form[`${field.name}_bn`] = str(values[`${field.name}_bn`]);
    } else if (field.kind === "select") {
      const v = values[field.name];
      form[field.name] =
        v === null || v === undefined || v === ""
          ? field.options[0] ?? ""
          : String(v);
    } else if (field.kind === "date") {
      // published_at arrives as a full ISO timestamp; the input wants a date.
      form[field.name] = str(values[field.name]).slice(0, 10);
    } else {
      form[field.name] = str(values[field.name]);
    }
  }
  return form;
}

function str(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || typeof v === "boolean") return "";
  return String(v);
}

export function ContentEditor({
  entity,
  row,
  isNew,
}: Readonly<{
  entity: ContentEntity;
  row: ContentRow | null;
  isNew: boolean;
}>) {
  const config = CONTENT_TYPE_CONFIGS[entity];
  const baseline = React.useMemo(
    () => fieldsToForm(config.fields, row),
    [config.fields, row],
  );
  const [form, setForm] = React.useState<FormState>(baseline);
  const { saving, flash, run } = useActionSave();

  const dirty = React.useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );

  function set(name: string, value: string) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function save() {
    const values: Record<string, unknown> = {};
    for (const field of config.fields) {
      if (field.kind === "select" && field.numeric) {
        values[field.name] = Number(form[field.name]);
      } else {
        for (const name of fieldNames(field)) values[name] = form[name] ?? "";
      }
    }
    const ok = await run(
      () => saveContentRow({ entity, id: isNew ? "" : (row?.id ?? ""), values }),
      isNew ? "Saved. The new row is in the list." : "Saved.",
    );
    if (ok && isNew) setForm(fieldsToForm(config.fields, null));
  }

  async function remove() {
    if (!row) return;
    await run(() => deleteContentRow({ entity, id: row.id }), "Deleted.");
  }

  return (
    <Card className="rounded-card">
      <FormSection
        title={isNew ? `New ${singular(config.label)}` : singular(config.label)}
        description={config.hint}
      >
        {!config.liveOnSite && (
          <p className="rounded-control bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
            Not displayed on public pages yet — edits are saved for when that
            page ships.
          </p>
        )}

        {config.fields.map((field) => {
          const id = `${entity}-${field.name}`;
          switch (field.kind) {
            case "text":
              return (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={id}>
                    {field.label}
                    {field.required ? <span className="text-destructive"> *</span> : null}
                  </Label>
                  <Input
                    id={id}
                    value={form[field.name] ?? ""}
                    onChange={(e) => set(field.name, e.target.value)}
                  />
                  {field.hint ? <FieldHint text={field.hint} /> : null}
                </div>
              );
            case "textarea":
              return (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={id}>{field.label}</Label>
                  <Textarea
                    id={id}
                    className="min-h-24"
                    value={form[field.name] ?? ""}
                    onChange={(e) => set(field.name, e.target.value)}
                  />
                </div>
              );
            case "json":
              return (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={id}>{field.label}</Label>
                  <Textarea
                    id={id}
                    className="min-h-40 font-mono text-xs"
                    spellCheck={false}
                    value={form[field.name] ?? ""}
                    onChange={(e) => set(field.name, e.target.value)}
                  />
                  {field.hint ? <FieldHint text={field.hint} /> : null}
                </div>
              );
            case "bilingual":
              return (
                <BilingualField
                  key={field.name}
                  id={id}
                  label={field.label}
                  required={field.required}
                  multiline={field.multiline}
                  hint={field.hint}
                  valueEn={form[`${field.name}_en`] ?? ""}
                  valueBn={form[`${field.name}_bn`] ?? ""}
                  onChangeEn={(v) => set(`${field.name}_en`, v)}
                  onChangeBn={(v) => set(`${field.name}_bn`, v)}
                />
              );
            case "number":
              return (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={id}>
                    {field.label}
                    {field.required ? <span className="text-destructive"> *</span> : null}
                  </Label>
                  <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={field.min}
                    max={field.max}
                    className="max-w-32"
                    value={form[field.name] ?? ""}
                    onChange={(e) => set(field.name, e.target.value)}
                  />
                </div>
              );
            case "select":
              return (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={id}>{field.label}</Label>
                  <Select
                    value={form[field.name] ?? field.options[0] ?? ""}
                    onValueChange={(v) => set(field.name, v)}
                  >
                    <SelectTrigger id={id} className="w-full max-w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {field.options.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            case "date":
              return (
                <div key={field.name} className="space-y-1.5">
                  <Label htmlFor={id}>{field.label}</Label>
                  <Input
                    id={id}
                    type="date"
                    className="max-w-44"
                    value={form[field.name] ?? ""}
                    onChange={(e) => set(field.name, e.target.value)}
                  />
                  {field.hint ? <FieldHint text={field.hint} /> : null}
                </div>
              );
            case "image":
              return (
                <ImageUploader
                  key={field.name}
                  id={id}
                  label={field.label}
                  folder={field.folder}
                  aspect={field.folder === "clients" ? "square" : "wide"}
                  value={form[field.name] ?? ""}
                  onChange={(url) => set(field.name, url)}
                />
              );
          }
        })}

        <FlashLine flash={flash} />

        {!isNew && row ? (
          <div className="border-t pt-4">
            <ConfirmDialog
              trigger={
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive">
                  Delete
                </Button>
              }
              title="Delete this row?"
              description={`This removes it from ${config.label.toLowerCase()} permanently.`}
              confirmLabel="Delete"
              destructive
              onConfirm={remove}
            />
          </div>
        ) : null}
      </FormSection>
      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={save}
        onDiscard={() => setForm(baseline)}
      />
    </Card>
  );
}

function FieldHint({ text }: Readonly<{ text: string }>) {
  return <p className="text-xs text-muted-foreground">{text}</p>;
}

/** "Homepage sections" → "section"; simple English singularisation for titles. */
function singular(label: string): string {
  const lower = label.toLowerCase();
  if (lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
  if (lower.endsWith("ses")) return lower.slice(0, -3);
  if (lower.endsWith("s")) return lower.slice(0, -1);
  return lower;
}
