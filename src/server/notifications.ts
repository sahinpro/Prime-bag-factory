import "server-only";

import { timingSafeEqual } from "node:crypto";

import { Resend } from "resend";

import type { Json } from "@/lib/database.types";
import { formatMoney } from "@/lib/format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Notifications outbox (plan §3b and 15.2 C1).
//
// Quotes (Phase 4): `notifyNewQuote` still delivers immediately and records
// the outcome. A quote submission must never fail because mail failed.
//
// Orders (C1): the order INSERT trigger enqueues an `admin_alert` and a
// pending `email` row in the same transaction. `deliverPendingEmails` is the
// scheduled sender (Vercel Cron → `/api/cron/send-notifications`). It claims
// a batch (attempts += 1), sends through Resend, then stores `sent` or
// `last_error`. Five failed attempts mark the row `failed`. No Resend key
// means the worker skips without burning an attempt; the bell still works.
//
// Admin-bell status: channel "admin_alert", pending = unread, sent = read.
// Payloads never include a phone number or a street address.

export const EMAIL_MAX_ATTEMPTS = 5;

export type NewQuoteForNotify = {
  id: string;
  source: "form" | "builder";
  contactName: string;
  companyName?: string | null;
  phone: string;
  quantity?: number | null;
  neededBy?: string | null;
  message?: string | null;
};

export type AdminAlert = {
  id: string;
  href: string;
  title: string;
  detail: string;
  ref: string;
  createdAt: string;
  unread: boolean;
};

export type EmailDeliveryResult = {
  ok: true;
  skipped: "unconfigured" | null;
  claimed: number;
  sent: number;
  retrying: number;
  failed: number;
};

function shortRef(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

function oneLine(value: string): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Company identity for the email body/recipient, read with the service role
 *  (the submitter has no session). Falls back to the seeded defaults. */
async function getCompanyContact(): Promise<{ name: string; email: string }> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("settings")
      .select("value")
      .eq("key", "company")
      .maybeSingle();
    const value = (data?.value ?? {}) as Record<string, unknown>;
    return {
      name: typeof value.name === "string" ? value.name : "Prime Bag Factory",
      email: typeof value.email === "string" ? value.email : "",
    };
  } catch {
    return { name: "Prime Bag Factory", email: "" };
  }
}

export async function notifyNewQuote(quote: NewQuoteForNotify): Promise<void> {
  const admin = createAdminClient();
  const ref = shortRef(quote.id);

  // 1. Admin bell alert (unread until marked read).
  try {
    await admin.from("notifications").insert({
      channel: "admin_alert",
      recipient: "admin",
      template: "new_quote",
      status: "pending",
      payload: {
        quote_id: quote.id,
        ref,
        source: quote.source,
        contact_name: quote.contactName,
        company_name: quote.companyName ?? null,
      },
    });
  } catch (error) {
    console.error("admin_alert insert failed", error);
  }

  // 2. Email to the company address via Resend (optional until the owner
  //    sets RESEND_API_KEY + MAIL_FROM; missing config is skipped, not an error).
  const apiKey = process.env.RESEND_API_KEY;
  const mailFrom = process.env.MAIL_FROM;
  const company = await getCompanyContact();
  if (!apiKey || !mailFrom || !company.email) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const subject = `New ${quote.source === "builder" ? "builder" : "quote"} request ${ref} — ${quote.companyName || quote.contactName}`;
  const lines = [
    `Contact: ${quote.contactName}${quote.companyName ? ` (${quote.companyName})` : ""}`,
    `Phone: ${quote.phone}`,
    quote.quantity ? `Quantity: ${quote.quantity} pcs` : null,
    quote.neededBy ? `Needed by: ${quote.neededBy}` : null,
    quote.message ? `Message: ${quote.message}` : null,
    "",
    `Open in admin: ${siteUrl}/admin/quotes/${quote.id}`,
  ].filter(Boolean);

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: mailFrom,
      to: company.email,
      subject,
      text: lines.join("\n"),
    });
    await admin.from("notifications").insert({
      channel: "email",
      recipient: company.email,
      template: "new_quote",
      status: error ? "failed" : "sent",
      attempts: 1,
      last_error: error ? error.message : null,
      sent_at: error ? null : new Date().toISOString(),
      payload: { quote_id: quote.id, ref },
    });
  } catch (error) {
    // Network/API blow-up must never break the quote flow — log and record.
    console.error("Resend send failed", error);
    try {
      await admin.from("notifications").insert({
        channel: "email",
        recipient: company.email,
        template: "new_quote",
        status: "failed",
        attempts: 1,
        last_error: error instanceof Error ? error.message : String(error),
        payload: { quote_id: quote.id, ref },
      });
    } catch (inner) {
      console.error("failed-email outbox insert failed", inner);
    }
  }
}

function textField(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

/** Plain-text company email for a new-order outbox row. Returns null when
 *  the payload has no order id or number — the sender then fails the row
 *  instead of mailing a broken link. Phone and address are never read. */
export function newOrderEmail(
  payload: Record<string, unknown>,
  siteUrl: string,
): { subject: string; text: string } | null {
  const orderNo = oneLine(textField(payload, "order_no"));
  const orderId = textField(payload, "order_id").trim();
  if (!orderNo || !orderId) return null;

  const name = oneLine(textField(payload, "customer_name")) || "Customer";
  const source = payload.source === "admin" ? "admin" : "web";
  const totalRaw = payload.total;
  const total =
    typeof totalRaw === "number"
      ? totalRaw
      : typeof totalRaw === "string"
        ? Number(totalRaw)
        : Number.NaN;
  const lines = [
    `Order: ${orderNo}`,
    `Channel: ${source}`,
    `Customer: ${name}`,
    Number.isFinite(total) ? `Total: ${formatMoney(total, "en")}` : null,
    "",
    `Open in admin: ${siteUrl}/admin/orders/${orderId}`,
  ].filter((line): line is string => line !== null);

  return {
    subject: `New ${source} order ${orderNo} — ${name}`,
    text: lines.join("\n"),
  };
}

/** After a claim has already incremented `attempts`, decide the row's next
 *  status. A null error is success. Under the cap, a failure stays pending
 *  so the next cron tick retries it. */
export function emailOutcome(
  attempts: number,
  error: string | null,
): { status: "pending" | "sent" | "failed"; lastError: string | null } {
  if (!error) return { status: "sent", lastError: null };
  return {
    status: attempts >= EMAIL_MAX_ATTEMPTS ? "failed" : "pending",
    lastError: error.slice(0, 500),
  };
}

/** Constant-time check for the cron route. A missing secret fails closed. */
export function cronAuthorized(
  header: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !header) return false;
  const expected = `Bearer ${secret}`;
  const received = Buffer.from(header);
  const wanted = Buffer.from(expected);
  if (received.length !== wanted.length) return false;
  return timingSafeEqual(received, wanted);
}

type ClaimedEmail = {
  id: string;
  recipient: string;
  template: string | null;
  payload: Json;
  attempts: number;
};

function asRecord(payload: Json): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

/** Send claimed `new_order` emails. Counts only — the HTTP response must
 *  not echo recipients. */
export async function deliverPendingEmails(): Promise<EmailDeliveryResult> {
  const empty: EmailDeliveryResult = {
    ok: true,
    skipped: null,
    claimed: 0,
    sent: 0,
    retrying: 0,
    failed: 0,
  };

  const apiKey = process.env.RESEND_API_KEY;
  const mailFrom = process.env.MAIL_FROM;
  if (!apiKey || !mailFrom) {
    return { ...empty, skipped: "unconfigured" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_pending_emails", {
    p_limit: 20,
  });
  if (error || !data) {
    console.error("claim_pending_emails failed", error);
    return empty;
  }

  const rows = data as ClaimedEmail[];
  const resend = new Resend(apiKey);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const result: EmailDeliveryResult = { ...empty, claimed: rows.length };

  for (const row of rows) {
    const message = newOrderEmail(asRecord(row.payload), siteUrl);
    let sendError: string | null = null;
    if (!message) {
      sendError = "unreadable new_order payload";
    } else {
      try {
        const { error: mailError } = await resend.emails.send({
          from: mailFrom,
          to: row.recipient,
          subject: message.subject,
          text: message.text,
        });
        if (mailError) sendError = mailError.message;
      } catch (caught) {
        sendError = caught instanceof Error ? caught.message : String(caught);
      }
    }

    const outcome = emailOutcome(
      message ? row.attempts : EMAIL_MAX_ATTEMPTS,
      sendError,
    );
    if (outcome.status === "sent") result.sent += 1;
    else if (outcome.status === "failed") result.failed += 1;
    else result.retrying += 1;

    const { error: updateError } = await admin
      .from("notifications")
      .update({
        status: outcome.status,
        last_error: outcome.lastError,
        sent_at: outcome.status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", row.id);
    if (updateError) {
      console.error("notification outcome update failed", updateError);
    }
  }

  return result;
}

function toAlert(row: {
  id: string;
  status: string;
  created_at: string;
  template: string | null;
  payload: unknown;
}): AdminAlert {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  const unread = row.status === "pending";
  const orderId = typeof p.order_id === "string" ? p.order_id : "";

  // F2 production moves share the order id, so they are matched first.
  if (row.template === "production_status" && orderId) {
    const orderNo = typeof p.order_no === "string" ? p.order_no : "";
    const name =
      typeof p.customer_name === "string" ? p.customer_name : "Customer";
    const stage =
      typeof p.production_status === "string"
        ? p.production_status.replace(/_/g, " ")
        : "updated";
    return {
      id: row.id,
      href: `/admin/orders/${orderId}`,
      title: `Production: ${stage}`,
      detail: name,
      ref: orderNo,
      createdAt: row.created_at,
      unread,
    };
  }

  if (orderId) {
    const orderNo = typeof p.order_no === "string" ? p.order_no : "";
    const name =
      typeof p.customer_name === "string" ? p.customer_name : "Customer";
    return {
      id: row.id,
      href: `/admin/orders/${orderId}`,
      title: "New order",
      detail: name,
      ref: orderNo,
      createdAt: row.created_at,
      unread,
    };
  }

  const quoteId = typeof p.quote_id === "string" ? p.quote_id : "";
  const source = typeof p.source === "string" ? p.source : "form";
  const contactName =
    typeof p.contact_name === "string" ? p.contact_name : "Unknown";
  const companyName =
    typeof p.company_name === "string" ? p.company_name : null;
  return {
    id: row.id,
    href: quoteId ? `/admin/quotes/${quoteId}` : "",
    title: `New ${source === "builder" ? "builder" : "quote"} request`,
    detail: companyName || contactName,
    ref: typeof p.ref === "string" ? p.ref : "",
    createdAt: row.created_at,
    unread,
  };
}

/** Recent admin-bell alerts through the staff client — RLS grants
 *  notifications to owner/manager only, other roles simply see nothing. */
export async function listAdminAlerts(limit = 8): Promise<AdminAlert[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, status, created_at, template, payload")
    .eq("channel", "admin_alert")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map(toAlert);
}

/** Flip unread (pending) alerts to read (sent). Same RLS-scoped client. */
export async function markAdminAlertsRead(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("channel", "admin_alert")
    .eq("status", "pending");
  if (error)
    throw new Error("Could not mark alerts as read.", { cause: error });
}
