import { Resend } from "resend";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// New-quote notifications (plan §10 Phase 4 task 2). Owner decision 2026-10-18:
// email via Resend (owner provisions RESEND_API_KEY/MAIL_FROM) plus the
// `notifications` outbox so the admin bell shows alerts. A submission must
// never fail because notification delivery failed — everything here is
// best-effort and records its outcome on the outbox row.
//
// Status semantics until the full Phase 5 outbox:
// - channel "admin_alert": recipient "admin"; status pending = unread in the
//   bell, sent = marked read.
// - channel "email": one row per delivery attempt outcome (sent/failed).
//
// WhatsApp: there is no server-side WhatsApp API configured (Meta Cloud API /
// Twilio would be a new provider + credentials). Instead the public
// confirmation shows a prefilled wa.me link to NEXT_PUBLIC_WHATSAPP_NUMBER so
// the request visibly "comes to our WhatsApp" (Decision Log 2026-10-18).

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
  quoteId: string;
  ref: string;
  source: string;
  contactName: string;
  companyName: string | null;
  createdAt: string;
  unread: boolean;
};

function shortRef(id: string): string {
  return id.slice(0, 8).toUpperCase();
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

function toAlert(row: {
  id: string;
  status: string;
  created_at: string;
  payload: unknown;
}): AdminAlert {
  const p = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    quoteId: typeof p.quote_id === "string" ? p.quote_id : "",
    ref: typeof p.ref === "string" ? p.ref : "",
    source: typeof p.source === "string" ? p.source : "form",
    contactName:
      typeof p.contact_name === "string" ? p.contact_name : "Unknown",
    companyName:
      typeof p.company_name === "string" ? p.company_name : null,
    createdAt: row.created_at,
    unread: row.status === "pending",
  };
}

/** Recent admin-bell alerts through the staff client — RLS grants
 *  notifications to owner/manager only, other roles simply see nothing. */
export async function listAdminAlerts(limit = 8): Promise<AdminAlert[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, status, created_at, payload")
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
  if (error) throw new Error("Could not mark alerts as read.", { cause: error });
}
