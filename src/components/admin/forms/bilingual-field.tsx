"use client";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import * as React from "react";

/**
 * BilingualField (plan 9c.5): EN / BN segmented tabs for any `_en` / `_bn` pair.
 * The Bangla tab shows a "Missing Bangla" badge while it is empty. The BN input
 * carries `lang="bn"` so `:lang(bn)` applies Noto Serif Bengali.
 */
export function BilingualField({
  id,
  label,
  valueEn,
  valueBn,
  onChangeEn,
  onChangeBn,
  multiline = false,
  required = false,
  placeholder,
  hint,
}: {
  id: string;
  label: string;
  valueEn: string;
  valueBn: string;
  onChangeEn: (value: string) => void;
  onChangeBn: (value: string) => void;
  multiline?: boolean;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  const [tab, setTab] = React.useState<"en" | "bn">("en");
  const bnMissing = valueBn.trim() === "";
  const Field = multiline ? Textarea : Input;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`${id}-${tab}`}>
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </Label>
        <div
          role="tablist"
          aria-label={`${label} language`}
          className="inline-flex rounded-control border border-border bg-surface-2 p-0.5"
        >
          {(["en", "bn"] as const).map((l) => (
            <button
              key={l}
              role="tab"
              type="button"
              aria-selected={tab === l}
              onClick={() => setTab(l)}
              className={cn(
                "rounded-[calc(var(--radius-control)-2px)] cursor-pointer px-2.5 py-1 text-xs font-medium uppercase transition-colors",
                tab === l
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
              {l === "bn" && bnMissing ? (
                <span className="sr-only"> (Bangla missing)</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {tab === "en" ? (
        <Field
          id={`${id}-en`}
          lang="en"
          value={valueEn}
          placeholder={placeholder}
          onChange={(
            e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
          ) => onChangeEn(e.target.value)}
          className={multiline ? "min-h-24" : undefined}
        />
      ) : (
        <div className="space-y-1.5">
          <Field
            id={`${id}-bn`}
            lang="bn"
            value={valueBn}
            placeholder={placeholder ? `${placeholder} (বাংলা)` : undefined}
            onChange={(
              e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
            ) => onChangeBn(e.target.value)}
            className={cn(multiline && "min-h-24")}
          />
          {bnMissing ? (
            <Badge variant="outline" className="border-warning/40 text-warning">
              Missing Bangla
            </Badge>
          ) : null}
        </div>
      )}

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
