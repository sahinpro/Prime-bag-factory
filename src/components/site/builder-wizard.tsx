"use client";

import { cn } from "cn";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useSyncExternalStore } from "react";

import { ArtworkUpload } from "@/components/site/artwork-upload";
import { QuoteForm, type QuoteOption } from "@/components/site/quote-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BuilderSwatch, SwatchGroup } from "@/server/catalog";

export type BuilderCategory = { id: string; slug: string; name: string };

const DRAFT_KEY = "pbf-builder-draft-v1";

type Draft = {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  width: string;
  height: string;
  gusset: string;
  material: string;
  primaryColor: BuilderSwatch | null;
  handleColor: BuilderSwatch | null;
  printMethod: string;
  printText: string;
  artwork: string | null;
  quantity: string;
};

const EMPTY: Draft = {
  categoryId: "",
  categoryName: "",
  categorySlug: "",
  width: "",
  height: "",
  gusset: "",
  material: "",
  primaryColor: null,
  handleColor: null,
  printMethod: "",
  printText: "",
  artwork: null,
  quantity: "",
};

const STEP_KEYS = [
  "stepCategory",
  "stepSize",
  "stepMaterial",
  "stepColors",
  "stepPrinting",
  "stepArtwork",
  "stepReview",
] as const;

// A stable empty subscription: we only need the server/client snapshot split to
// gate hydration, not to react to any external store.
function subscribe() {
  return () => {};
}

/** True only after client hydration, so we never render the form on the server. */
function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}

function loadDraft(): Draft {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) };
  } catch {
    return EMPTY;
  }
}

function saveDraft(draft: Draft) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* storage full or blocked — draft is best-effort */
  }
}

/**
 * Custom Bag Builder (plan 2c). A 7-step wizard: category → size → material →
 * colors → printing → artwork → review. The draft lives in localStorage; the
 * final step submits a `builder` quote request through the same validated server
 * action as the plain quote form. Colors use the real swatch library.
 */
export function BuilderWizard({
  categories,
  swatchGroups,
  productOptions = [],
  categoryOptions = [],
  defaultCategoryId,
}: {
  categories: BuilderCategory[];
  swatchGroups: SwatchGroup[];
  productOptions?: QuoteOption[];
  categoryOptions?: QuoteOption[];
  defaultCategoryId?: string;
}) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <div className="rounded-card border bg-surface p-8 text-center text-muted-foreground">
        …
      </div>
    );
  }
  return (
    <Wizard
      categories={categories}
      swatchGroups={swatchGroups}
      productOptions={productOptions}
      categoryOptions={categoryOptions}
      defaultCategoryId={defaultCategoryId}
    />
  );
}

function Wizard({
  categories,
  swatchGroups,
  productOptions,
  categoryOptions,
  defaultCategoryId,
}: {
  categories: BuilderCategory[];
  swatchGroups: SwatchGroup[];
  productOptions: QuoteOption[];
  categoryOptions: QuoteOption[];
  defaultCategoryId?: string;
}) {
  const t = useTranslations("builder");
  const common = useTranslations("common");

  const allSwatches = useMemo<BuilderSwatch[]>(
    () => swatchGroups.flatMap((g) => g.swatches),
    [swatchGroups],
  );

  const [draft, setDraft] = useState<Draft>(() => {
    const loaded = loadDraft();
    if (!loaded.categoryId && defaultCategoryId) {
      const cat = categories.find((x) => x.id === defaultCategoryId);
      if (cat)
        return {
          ...loaded,
          categoryId: cat.id,
          categoryName: cat.name,
          categorySlug: cat.slug,
        };
    }
    return loaded;
  });
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  function update(patch: Partial<Draft>) {
    setDraft((d) => {
      const next = { ...d, ...patch };
      saveDraft(next);
      return next;
    });
  }

  const total = STEP_KEYS.length;
  const canAdvance = (() => {
    switch (step) {
      case 0:
        return draft.categoryId !== "";
      case 1:
        return Number(draft.width) > 0 && Number(draft.height) > 0;
      case 2:
        return draft.material.trim() !== "";
      case 3:
        return draft.primaryColor != null;
      case 4:
      case 5:
        return true;
      default:
        return true;
    }
  })();

  const snapshot = useMemo(
    () => ({
      category: {
        id: draft.categoryId,
        slug: draft.categorySlug,
        name: draft.categoryName,
      },
      size: {
        width: draft.width,
        height: draft.height,
        gusset: draft.gusset,
        unit: "inch",
      },
      material: draft.material,
      colors: {
        primary: draft.primaryColor
          ? {
              name: draft.primaryColor.name_en,
              hex: draft.primaryColor.color_hex,
            }
          : null,
        handle: draft.handleColor
          ? {
              name: draft.handleColor.name_en,
              hex: draft.handleColor.color_hex,
            }
          : null,
      },
      printing: {
        method: draft.printMethod,
        text: draft.printText,
        artwork: draft.artwork,
      },
      quantity: draft.quantity,
    }),
    [draft],
  );

  if (submitted) {
    return (
      <QuoteForm
        mode="builder"
        source="builder"
        productOptions={productOptions}
        categoryOptions={categoryOptions}
        customization={JSON.stringify(snapshot)}
        defaultQuantity={draft.quantity || undefined}
        defaultSize={`${draft.width}×${draft.height}${draft.gusset ? `×${draft.gusset}` : ""} in`}
        defaultColor={draft.primaryColor?.name_en}
        onDone={() => {
          setSubmitted(false);
          setStep(0);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stepper */}
      <ol className="flex flex-wrap gap-1.5" aria-label={t("title")}>
        {STEP_KEYS.map((key, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={key} className="flex-1 min-w-24">
              <span
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-control px-2 py-1.5 text-xs font-medium",
                  current
                    ? "bg-brand text-brand-foreground"
                    : done
                      ? "bg-brand/15 text-gold-text"
                      : "bg-surface-2 text-muted-foreground",
                )}
              >
                {done ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <span>{i + 1}</span>
                )}
                <span className="truncate">{t(key)}</span>
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t("stepLabel", { n: step + 1, total })}
      </p>

      {/* Step body */}
      <div className="rounded-card border bg-surface p-5">
        {step === 0 ? (
          <StepCategory categories={categories} draft={draft} update={update} />
        ) : step === 1 ? (
          <StepSize t={t} draft={draft} update={update} />
        ) : step === 2 ? (
          <StepMaterial t={t} draft={draft} update={update} />
        ) : step === 3 ? (
          <StepColors
            t={t}
            swatches={allSwatches}
            draft={draft}
            update={update}
          />
        ) : step === 4 ? (
          <StepPrinting t={t} draft={draft} update={update} />
        ) : step === 5 ? (
          <StepArtwork t={t} draft={draft} update={update} />
        ) : (
          <StepReview t={t} common={common} draft={draft} />
        )}
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft className="size-4" aria-hidden />
          {common("back")}
        </Button>

        <p className="text-xs text-muted-foreground">{t("draftSaved")}</p>

        {step < total - 1 ? (
          <Button
            type="button"
            onClick={() => setStep((s) => Math.min(total - 1, s + 1))}
            disabled={!canAdvance}
          >
            {t("continue")}
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" onClick={() => setSubmitted(true)}>
            {t("submit")}
          </Button>
        )}
      </div>
    </div>
  );
}

type Updater = (patch: Partial<Draft>) => void;
type Translator = ReturnType<typeof useTranslations>;

function StepCategory({
  categories,
  draft,
  update,
}: {
  categories: BuilderCategory[];
  draft: Draft;
  update: Updater;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {categories.map((cat) => {
          const selected = cat.id === draft.categoryId;
          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                update({
                  categoryId: cat.id,
                  categoryName: cat.name,
                  categorySlug: cat.slug,
                })
              }
              className={cn(
                "rounded-control border px-3 py-3 text-left text-sm transition-colors",
                selected
                  ? "border-brand bg-brand/10 ring-2 ring-brand/40"
                  : "hover:bg-muted",
              )}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepSize({
  t,
  draft,
  update,
}: {
  t: Translator;
  draft: Draft;
  update: Updater;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-medium">{t("dimensions")}</p>
      <div className="grid grid-cols-3 gap-3">
        {(["width", "height", "gusset"] as const).map((f) => (
          <div key={f} className="flex flex-col gap-1.5">
            <Label htmlFor={`size-${f}`}>{t(f)}</Label>
            <Input
              id={`size-${f}`}
              type="number"
              min={0}
              inputMode="decimal"
              value={draft[f]}
              onChange={(e) =>
                update({ [f]: e.target.value } as Partial<Draft>)
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function StepMaterial({
  t,
  draft,
  update,
}: {
  t: Translator;
  draft: Draft;
  update: Updater;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="material">{t("material")}</Label>
      <Input
        id="material"
        value={draft.material}
        onChange={(e) => update({ material: e.target.value })}
        placeholder="Non-woven, PP laminated, Jute, Cotton canvas…"
      />
    </div>
  );
}

function StepColors({
  t,
  swatches,
  draft,
  update,
}: {
  t: Translator;
  swatches: BuilderSwatch[];
  draft: Draft;
  update: Updater;
}) {
  return (
    <div className="flex flex-col gap-5">
      <SwatchPicker
        label={t("primaryColor")}
        swatches={swatches}
        selected={draft.primaryColor}
        onSelect={(s) => update({ primaryColor: s })}
      />
      <SwatchPicker
        label={t("handleColor")}
        swatches={swatches}
        selected={draft.handleColor}
        allowClear
        onSelect={(s) => update({ handleColor: s })}
      />
    </div>
  );
}

function SwatchPicker({
  label,
  swatches,
  selected,
  onSelect,
  allowClear = false,
}: {
  label: string;
  swatches: BuilderSwatch[];
  selected: BuilderSwatch | null;
  onSelect: (s: BuilderSwatch | null) => void;
  allowClear?: boolean;
}) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-2 font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {allowClear ? (
          <button
            type="button"
            aria-pressed={selected == null}
            onClick={() => onSelect(null)}
            className={cn(
              "rounded-control border px-2.5 py-1.5 text-sm",
              selected == null
                ? "border-brand ring-2 ring-brand/40"
                : "hover:bg-muted",
            )}
          >
            —
          </button>
        ) : null}
        {swatches.map((s) => {
          const isSel = selected?.id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={isSel}
              aria-label={s.name_en}
              onClick={() => onSelect(s)}
              className={cn(
                "flex items-center gap-2 rounded-control border px-2 py-1 text-sm",
                isSel ? "border-brand ring-2 ring-brand/40" : "hover:bg-muted",
              )}
            >
              <span
                aria-hidden
                className="size-4 rounded-full border"
                style={{ backgroundColor: s.color_hex ?? "transparent" }}
              />
              {s.name_en}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function StepPrinting({
  t,
  draft,
  update,
}: {
  t: Translator;
  draft: Draft;
  update: Updater;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="print-method">{t("printMethod")}</Label>
        <Input
          id="print-method"
          value={draft.printMethod}
          onChange={(e) => update({ printMethod: e.target.value })}
          placeholder="Screen, Flexo, Heat transfer…"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="print-text">{t("printText")}</Label>
        <Input
          id="print-text"
          value={draft.printText}
          onChange={(e) => update({ printText: e.target.value })}
        />
      </div>
    </div>
  );
}

function StepArtwork({
  t,
  draft,
  update,
}: {
  t: Translator;
  draft: Draft;
  update: Updater;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-medium">{t("uploadArtwork")}</p>
      <ArtworkUpload
        value={draft.artwork}
        onChange={(url) => update({ artwork: url })}
      />
    </div>
  );
}

function StepReview({
  t,
  common,
  draft,
}: {
  t: Translator;
  common: Translator;
  draft: Draft;
}) {
  const rows: { label: string; value: string }[] = [
    { label: t("category"), value: draft.categoryName || common("notFound") },
    {
      label: t("dimensions"),
      value: `${draft.width || "—"} × ${draft.height || "—"} × ${draft.gusset || "—"} in`,
    },
    { label: t("material"), value: draft.material || "—" },
    { label: t("primaryColor"), value: draft.primaryColor?.name_en || "—" },
    { label: t("handleColor"), value: draft.handleColor?.name_en || "—" },
    { label: t("printMethod"), value: draft.printMethod || "—" },
    { label: t("printText"), value: draft.printText || "—" },
    {
      label: common("minOrder"),
      value: draft.quantity ? `${draft.quantity} ${common("pieces")}` : "—",
    },
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex justify-between gap-3 border-b py-1.5 text-sm"
        >
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className="text-right font-medium">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
