"use client";

import { MessageCircle, PhoneCall } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import {
  submitQuote,
  type QuoteResult,
} from "@/app/[locale]/(site)/quote/actions";
import { ArtworkUpload } from "@/components/site/artwork-upload";
import { Field } from "@/components/site/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { publicEnv } from "@/lib/env";

export type QuoteOption = { id: string; title: string };

function errText(t: (k: string) => string, code?: string) {
  return code ? t(code) : undefined;
}

/**
 * Public quote form. Wraps the `submitQuote` server action via `useActionState`.
 * The same component backs the builder's final step (mode "builder"), where the
 * product/size/color fields are replaced by the captured `customization` snapshot.
 * The `website` input is a visually-hidden honeypot for bots (plan 8).
 */
export function QuoteForm({
  productOptions = [],
  categoryOptions = [],
  defaultProductId,
  defaultQuantity,
  defaultColor,
  defaultSize,
  customization,
  source = "form",
  mode = "form",
  onDone,
}: {
  productOptions?: QuoteOption[];
  categoryOptions?: QuoteOption[];
  defaultProductId?: string;
  defaultQuantity?: string;
  defaultColor?: string;
  defaultSize?: string;
  customization?: string;
  source?: "form" | "builder";
  mode?: "form" | "builder";
  onDone?: () => void;
}) {
  const t = useTranslations("quote");
  const c = useTranslations("common");
  const [attachment, setAttachment] = useState<string | null>(null);
  const [state, formAction, pending] = useActionState<
    QuoteResult | null,
    FormData
  >(submitQuote, null);

  if (state?.ok) {
    // WhatsApp handoff (Phase 4 task 2, owner decision): the submitter sends
    // the finished request to our WhatsApp number with the ref prefilled, so
    // the quote "arrives on our WhatsApp" without a paid messaging API.
    const waDigits = publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(
      /[^\d]/g,
      "",
    );
    const waHref = state.ref
      ? `https://wa.me/${waDigits}?text=${encodeURIComponent(
          t("whatsappPrefill", { ref: state.ref }),
        )}`
      : `https://wa.me/${waDigits}`;
    return (
      <div className="rounded-card border bg-surface p-8 text-center">
        <h2 className="text-xl font-semibold">{t("successTitle")}</h2>
        {state.ref ? (
          <p className="mt-2 text-muted-foreground">
            {t("successBody")}{" "}
            <span className="font-mono font-semibold text-foreground">
              {state.ref}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-muted-foreground">{t("successBody")}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {state.ref ? (
            <Button asChild>
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" aria-hidden="true" />
                {t("whatsappContinue")}
              </a>
            </Button>
          ) : null}
          {onDone ? (
            <Button variant="outline" type="button" onClick={onDone}>
              {t("anotherQuote")}
            </Button>
          ) : null}
        </div>
        {state.ref ? (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
            <PhoneCall className="size-4" aria-hidden="true" />
            {t("successCall")} {publicEnv.NEXT_PUBLIC_WHATSAPP_NUMBER}
          </p>
        ) : null}
      </div>
    );
  }

  const fe = state?.fieldErrors ?? {};
  const builder = mode === "builder";

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="source" value={source} />
      {customization ? (
        <input type="hidden" name="customization" value={customization} />
      ) : null}
      {attachment ? (
        <input type="hidden" name="attachment_path" value={attachment} />
      ) : null}

      {/* Honeypot — hidden from real users, filled by bots. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="quote-website">Website</label>
        <input
          id="quote-website"
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {state?.formError ? (
        <p
          role="alert"
          className="rounded-control bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {t(state.formError)}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="contact_name"
          label={t("contactName")}
          required
          error={errText((k) => t(k), fe.contact_name)}
        >
          <Input
            id="contact_name"
            name="contact_name"
            required
            defaultValue=""
            aria-invalid={!!fe.contact_name}
          />
        </Field>
        <Field
          id="phone"
          label={t("phone")}
          required
          error={errText((k) => t(k), fe.phone)}
        >
          <Input
            id="phone"
            name="phone"
            type="tel"
            required
            inputMode="tel"
            defaultValue=""
            aria-invalid={!!fe.phone}
          />
        </Field>
        <Field
          id="email"
          label={t("email")}
          error={errText((k) => t(k), fe.email)}
        >
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!fe.email}
          />
        </Field>
        <Field id="company_name" label={t("company")}>
          <Input
            id="company_name"
            name="company_name"
            autoComplete="organization"
          />
        </Field>
      </div>

      {!builder ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="product_id" label={t("productLabel")}>
            <select
              id="product_id"
              name="product_id"
              defaultValue={defaultProductId ?? ""}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">{t("anyProduct")}</option>
              {productOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </Field>
          <Field id="category_id" label={t("categoryLabel")}>
            <select
              id="category_id"
              name="category_id"
              defaultValue=""
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="">{t("anyCategory")}</option>
              {categoryOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-3">
        <Field id="quantity" label={t("quantity")}>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            inputMode="numeric"
            defaultValue={defaultQuantity ?? ""}
          />
        </Field>
        {!builder ? (
          <>
            <Field id="custom_size" label={t("customSize")}>
              <Input
                id="custom_size"
                name="custom_size"
                defaultValue={defaultSize ?? ""}
              />
            </Field>
            <Field id="custom_color" label={t("customColor")}>
              <Input
                id="custom_color"
                name="custom_color"
                defaultValue={defaultColor ?? ""}
              />
            </Field>
          </>
        ) : (
          <Field id="needed_by" label={t("neededBy")}>
            <Input id="needed_by" name="needed_by" type="date" />
          </Field>
        )}
      </div>

      {!builder ? (
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="needs_logo_print" value="true" />
            {t("needsLogo")}
          </label>
          <Field id="needed_by" label={t("neededBy")} className="w-48">
            <Input id="needed_by" name="needed_by" type="date" />
          </Field>
        </div>
      ) : null}

      <Field id="message" label={t("message")}>
        <Textarea id="message" name="message" rows={4} />
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("artwork")}</span>
        <ArtworkUpload value={attachment} onChange={setAttachment} />
      </div>

      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? t("sending") : t("submit")}
        </Button>
        <span className="ml-3 text-sm text-muted-foreground">
          {c("requestQuote")}
        </span>
      </div>
    </form>
  );
}
