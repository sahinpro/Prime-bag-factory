"use client";

import {
  ArrowLeft,
  Check,
  Circle,
  ClipboardList,
  ExternalLink,
  FileText,
  MessageCircle,
  Package,
  Phone,
  Printer,
  Puzzle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import {
  assignQuote,
  convertQuoteToOrder,
  saveQuoteDetails,
  updateQuoteStatus,
} from "@/app/(admin)/admin/quotes/actions";
import { ConfirmDialog } from "@/components/admin/forms/confirm-dialog";
import { StatusBadge, ToneBadge } from "@/components/admin/data/status-badge";
import {
  FlashLine,
  useActionSave,
} from "@/components/admin/products/use-action-save";
import { ColorChip } from "@/components/admin/quotes/color-chip";
import { PageHeader } from "@/components/admin/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { formatDate, formatMoney } from "@/lib/format";
import { QUOTE_STATUSES } from "@/lib/validators/quote-admin";
import type { AdminQuoteDetail, AssignableStaff } from "@/server/quotes";

/**
 * Quote detail (plan 9c.8): left column — contact card, request details,
 * builder selections as color chips, attachment viewer; right column — status
 * stepper, assignment, quoted amount / validity / internal notes. Header
 * carries the quick links (WhatsApp, call) and the two print views.
 */

type QuoteStatus = (typeof QUOTE_STATUSES)[number];

const PIPELINE: QuoteStatus[] = ["new", "contacted", "quoted", "won", "lost"];

/** Position in the linear pipeline; won/lost share the terminal slot. */
function pipelineIndex(status: QuoteStatus): number {
  return status === "lost" ? 3 : PIPELINE.indexOf(status);
}

/** 01XXXXXXXXX / +8801… / 8801… → 8801… for a wa.me/tel deep link. */
export function toBdPhoneDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return `88${digits}`;
  return `880${digits}`;
}

function SectionCard({
  title,
  children,
  action,
}: Readonly<{
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}>) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {action}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  );
}

function DetailRow({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <div className="grid gap-1 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground sm:col-span-2">{children}</dd>
    </div>
  );
}

export function QuoteDetail({
  quote,
  staff,
  attachmentUrl,
  canConvert,
  convertedOrderId,
}: Readonly<{
  quote: AdminQuoteDetail;
  staff: AssignableStaff[];
  attachmentUrl: string | null;
  canConvert: boolean;
  convertedOrderId: string | null;
}>) {
  const router = useRouter();
  const { saving, flash, run, setFlash } = useActionSave();
  const [converting, setConverting] = React.useState(false);

  const priced = quote.quoted_amount != null && quote.quoted_amount > 0;

  async function handleConvert() {
    setConverting(true);
    const result = await convertQuoteToOrder({ id: quote.id });
    setConverting(false);
    if (result.ok) {
      router.push(`/admin/orders/${result.orderId}`);
      return;
    }
    setFlash({ kind: "error", text: result.error });
  }

  const [amount, setAmount] = React.useState(
    quote.quoted_amount != null ? String(quote.quoted_amount) : "",
  );
  const [validUntil, setValidUntil] = React.useState(quote.valid_until ?? "");
  const [notes, setNotes] = React.useState(quote.internal_notes ?? "");

  const detailsDirty =
    amount !==
      (quote.quoted_amount != null ? String(quote.quoted_amount) : "") ||
    validUntil !== (quote.valid_until ?? "") ||
    notes !== (quote.internal_notes ?? "");

  const ref = quote.id.slice(0, 8).toUpperCase();
  const phoneDigits = toBdPhoneDigits(quote.phone);
  const waText = encodeURIComponent(
    `Hello${quote.contact_name ? ` ${quote.contact_name}` : ""}, this is Prime Bag Factory regarding your quote request ${ref}.`,
  );
  const builder = quote.builder;

  return (
    <div className="space-y-6">
      <PageHeader
        title={quote.company_name ?? quote.contact_name}
        description={`Request ${ref} · received ${formatDate(new Date(quote.created_at), "en")}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://wa.me/${phoneDigits}?text=${waText}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                WhatsApp
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`tel:+${phoneDigits}`}>
                <Phone
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                Call
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/admin/print/quotes/${quote.id}/spec`}
                target="_blank"
              >
                <Printer
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                Spec sheet
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/admin/print/quotes/${quote.id}/quotation`}
                target="_blank"
              >
                <FileText
                  aria-hidden="true"
                  strokeWidth={1.75}
                  className="size-4"
                />
                Quotation
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-2">
        <StatusBadge domain="quote" value={quote.status} />
        <ToneBadge
          tone={quote.source === "builder" ? "gold" : "neutral"}
          icon={quote.source === "builder" ? Puzzle : ClipboardList}
        >
          {quote.source === "builder" ? "Builder request" : "Form request"}
        </ToneBadge>
        {quote.urgency ? (
          <StatusBadge domain="urgency" value={quote.urgency} />
        ) : null}
        <Button variant="ghost" size="sm" asChild className="ml-auto">
          <Link href="/admin/quotes">
            <ArrowLeft
              aria-hidden="true"
              strokeWidth={1.75}
              className="size-4"
            />
            Back to inbox
          </Link>
        </Button>
      </div>

      <FlashLine flash={flash} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Contact">
            <dl className="space-y-3">
              <DetailRow label="Name">{quote.contact_name}</DetailRow>
              {quote.company_name ? (
                <DetailRow label="Company">{quote.company_name}</DetailRow>
              ) : null}
              <DetailRow label="Phone">
                <a
                  className="text-foreground underline-offset-4 hover:underline"
                  href={`tel:+${phoneDigits}`}
                >
                  {quote.phone}
                </a>
              </DetailRow>
              {quote.email ? (
                <DetailRow label="Email">
                  <a
                    className="text-foreground underline-offset-4 hover:underline"
                    href={`mailto:${quote.email}`}
                  >
                    {quote.email}
                  </a>
                </DetailRow>
              ) : (
                <DetailRow label="Email">
                  <span className="text-muted-foreground">Not provided</span>
                </DetailRow>
              )}
            </dl>
          </SectionCard>

          <SectionCard title="Request details">
            <dl className="space-y-3">
              <DetailRow label="Product">
                {quote.product_title ? (
                  quote.product_id ? (
                    <Link
                      href={`/admin/products/${quote.product_id}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {quote.product_title}
                    </Link>
                  ) : (
                    quote.product_title
                  )
                ) : (
                  <span className="text-muted-foreground">
                    No catalog product selected
                  </span>
                )}
              </DetailRow>
              {quote.category_name ? (
                <DetailRow label="Category">{quote.category_name}</DetailRow>
              ) : null}
              <DetailRow label="Quantity">
                {quote.quantity != null ? (
                  <span className="tabular-nums">
                    {quote.quantity.toLocaleString("en-US")} pcs
                  </span>
                ) : (
                  <span className="text-muted-foreground">Not specified</span>
                )}
              </DetailRow>
              {quote.custom_size ? (
                <DetailRow label="Custom size">{quote.custom_size}</DetailRow>
              ) : null}
              {quote.custom_color ? (
                <DetailRow label="Custom color">{quote.custom_color}</DetailRow>
              ) : null}
              <DetailRow label="Logo printing">
                {quote.needs_logo_print ? (
                  <ToneBadge tone="gold" icon={Check}>
                    Requested
                  </ToneBadge>
                ) : (
                  <ToneBadge tone="neutral" icon={Circle}>
                    None
                  </ToneBadge>
                )}
              </DetailRow>
              <DetailRow label="Needed by">
                {quote.needed_by ? (
                  <span className="tabular-nums">
                    {formatDate(new Date(quote.needed_by), "en")}
                  </span>
                ) : (
                  <span className="text-muted-foreground">No date given</span>
                )}
              </DetailRow>
              {quote.estimated_total != null ? (
                <DetailRow label="Builder estimate">
                  <span className="tabular-nums">
                    {formatMoney(quote.estimated_total, "en")}
                    {quote.estimated_unit_price != null
                      ? ` (at ${formatMoney(quote.estimated_unit_price, "en")} /pc)`
                      : ""}
                  </span>
                </DetailRow>
              ) : null}
              {quote.message ? (
                <DetailRow label="Customer message">
                  <p className="whitespace-pre-wrap">{quote.message}</p>
                </DetailRow>
              ) : null}
            </dl>
          </SectionCard>

          {builder ? (
            <SectionCard title="Builder selections">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <ColorChip
                    label="Body color"
                    name={builder.colors?.primary?.name}
                    hex={builder.colors?.primary?.hex}
                  />
                  <ColorChip
                    label="Handle color"
                    name={builder.colors?.handle?.name}
                    hex={builder.colors?.handle?.hex}
                  />
                </div>
                <dl className="space-y-3">
                  {builder.category?.name ? (
                    <DetailRow label="Bag type">
                      {builder.category.name}
                    </DetailRow>
                  ) : null}
                  {builder.size &&
                  (builder.size.width || builder.size.height) ? (
                    <DetailRow label="Size">
                      <span className="tabular-nums">
                        {builder.size.width} × {builder.size.height}
                        {builder.size.gusset
                          ? ` × ${builder.size.gusset}`
                          : ""}{" "}
                        {builder.size.unit ?? "inch"}
                      </span>
                    </DetailRow>
                  ) : null}
                  {builder.material ? (
                    <DetailRow label="Material">{builder.material}</DetailRow>
                  ) : null}
                  {builder.printing?.method ? (
                    <DetailRow label="Print method">
                      {builder.printing.method}
                    </DetailRow>
                  ) : null}
                  {builder.printing?.text ? (
                    <DetailRow label="Print text">
                      {builder.printing.text}
                    </DetailRow>
                  ) : null}
                  {builder.printing?.artwork ? (
                    <DetailRow label="Print artwork">
                      <a
                        href={builder.printing.artwork}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                      >
                        Open artwork
                        <ExternalLink
                          aria-hidden="true"
                          strokeWidth={1.75}
                          className="size-3.5"
                        />
                      </a>
                    </DetailRow>
                  ) : null}
                  {builder.quantity != null ? (
                    <DetailRow label="Wizard quantity">
                      <span className="tabular-nums">
                        {builder.quantity.toLocaleString("en-US")} pcs
                      </span>
                    </DetailRow>
                  ) : null}
                </dl>
              </div>
            </SectionCard>
          ) : null}

          <SectionCard title="Artwork attachment">
            {quote.attachment_path ? (
              <div className="space-y-3">
                {attachmentUrl ? (
                  <>
                    {quote.attachment_path.endsWith(".pdf") ? null : (
                      /* Private artwork opened via a short-lived signed URL
                         (plan 15.2 B6); a plain img keeps the admin bundle
                         free of remote-pattern image config. */
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={attachmentUrl}
                        alt={`Artwork attachment for request ${ref}`}
                        className="max-h-64 rounded-control border border-border object-contain"
                      />
                    )}
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink
                          aria-hidden="true"
                          strokeWidth={1.75}
                          className="size-4"
                        />
                        {quote.attachment_path.endsWith(".pdf")
                          ? "Open PDF"
                          : "Open full size"}
                      </a>
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    The stored artwork could not be opened — the file may be
                    missing.
                  </p>
                )}
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {quote.attachment_path}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No artwork was attached to this request.
              </p>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Status pipeline">
            <ol className="space-y-1.5" aria-label="Quote status pipeline">
              {(
                [
                  ["new", "New"],
                  ["contacted", "Contacted"],
                  ["quoted", "Quoted"],
                  ["won", "Won"],
                  ["lost", "Lost"],
                ] as [QuoteStatus, string][]
              ).map(([value, label]) => {
                const current = quote.status === value;
                const done =
                  !current &&
                  pipelineIndex(quote.status) > pipelineIndex(value);
                return (
                  <li key={value}>
                    <Button
                      type="button"
                      variant={current ? "default" : "outline"}
                      size="sm"
                      className="w-full justify-start"
                      aria-current={current ? "step" : undefined}
                      disabled={saving || current}
                      onClick={() =>
                        run(
                          () =>
                            updateQuoteStatus({ id: quote.id, status: value }),
                          `Marked as ${label}.`,
                        )
                      }
                    >
                      {done ? (
                        <Check
                          aria-hidden="true"
                          strokeWidth={1.75}
                          className="size-4"
                        />
                      ) : current ? (
                        <Circle
                          aria-hidden="true"
                          strokeWidth={1.75}
                          className="size-4"
                        />
                      ) : (
                        <Circle
                          aria-hidden="true"
                          strokeWidth={1.75}
                          className="size-4 opacity-40"
                        />
                      )}
                      {label}
                      {current ? (
                        <span className="sr-only">(current)</span>
                      ) : null}
                    </Button>
                  </li>
                );
              })}
            </ol>
          </SectionCard>

          <SectionCard title="Assignment">
            <Label htmlFor="quote-assignee">Assigned to</Label>
            <Select
              value={quote.assigned_to ?? "none"}
              disabled={saving}
              onValueChange={(v) =>
                run(
                  () =>
                    assignQuote({
                      id: quote.id,
                      assigned_to: v === "none" ? "" : String(v),
                    }),
                  "Assignee updated.",
                )
              }
            >
              <SelectTrigger id="quote-assignee" className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {staff.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.full_name} ({member.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SectionCard>

          <SectionCard title="Quotation and notes">
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  () =>
                    saveQuoteDetails({
                      id: quote.id,
                      quoted_amount: amount,
                      valid_until: validUntil,
                      internal_notes: notes,
                    }),
                  "Quote details saved.",
                );
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="quote-amount">Quoted amount (BDT)</Label>
                <Input
                  id="quote-amount"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Final confirmed price per order, not per piece.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-valid-until">Valid until</Label>
                <Input
                  id="quote-valid-until"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Shown on the printable quotation.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quote-notes">Internal notes</Label>
                <Textarea
                  id="quote-notes"
                  rows={5}
                  placeholder="Only visible to staff."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={saving || !detailsDirty}
              >
                {saving ? "Saving…" : "Save details"}
              </Button>
            </form>
          </SectionCard>

          <SectionCard title="Order">
            {convertedOrderId ? (
              <div className="space-y-3">
                <p className="text-sm text-success">
                  This quote was converted to an order.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/orders/${convertedOrderId}`}>
                    <Package
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="size-4"
                    />
                    View order
                  </Link>
                </Button>
              </div>
            ) : canConvert ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Creates a bulk order for{" "}
                  <span className="tabular-nums text-foreground">
                    {priced
                      ? formatMoney(quote.quoted_amount ?? 0, "en")
                      : "no price set"}
                  </span>
                  . The quote becomes Won and stock is not reserved.
                </p>
                {priced ? (
                  <ConfirmDialog
                    title="Convert this quote to an order?"
                    description={`Creates a bulk order totalling ${formatMoney(
                      quote.quoted_amount ?? 0,
                      "en",
                    )} from this quote. The quote will be marked Won.`}
                    confirmLabel="Create order"
                    onConfirm={handleConvert}
                    trigger={
                      <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        disabled={converting || saving}
                      >
                        <Package
                          aria-hidden="true"
                          strokeWidth={1.75}
                          className="size-4"
                        />
                        {converting ? "Converting…" : "Convert to order"}
                      </Button>
                    }
                  />
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled
                  >
                    <Package
                      aria-hidden="true"
                      strokeWidth={1.75}
                      className="size-4"
                    />
                    Convert to order
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only owners and managers can convert a quote to an order.
              </p>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
