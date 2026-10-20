"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { quoteSchema } from "@/lib/validators/quote";
import {
  getClientKey,
  isAllowed,
  isBlocked,
  normalizePhone,
} from "@/server/abuse";
import { notifyNewQuote } from "@/server/notifications";

/**
 * Public quote submission. There is NO anon insert policy on `quote_requests`
 * (plan 3b: no public writes), so we validate with zod and write through the
 * service-role client, which bypasses RLS. Spam guard = honeypot + a rolling
 * per-phone rate limit (plan 8). Field errors are returned as stable codes and
 * localized by the client, since a server action cannot read the UI locale.
 */

export type QuoteResult = {
  ok: boolean;
  ref?: string;
  fieldErrors?: Record<string, string>;
  formError?: string;
};

const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 5; // requests per phone per window

function fieldCodeForIssue(code: string): string {
  if (code === "invalid_format") return "errEmail";
  if (code === "too_small" || code === "custom") return "errRequired";
  return "errGeneric";
}

export async function submitQuote(
  _prev: QuoteResult | null,
  formData: FormData,
): Promise<QuoteResult> {
  // 1. Honeypot: a filled `website` is a bot. Fail open (pretend success) so the
  //    signal isn't useful to a spammer.
  const honeypot = String(formData.get("website") ?? "");
  if (honeypot.trim() !== "") {
    return { ok: true, ref: "" };
  }

  // 2. Flatten FormData → plain object for zod.
  const raw: Record<string, unknown> = {};
  for (const key of [
    "source",
    "contact_name",
    "phone",
    "email",
    "company_name",
    "product_id",
    "category_id",
    "quantity",
    "custom_size",
    "custom_color",
    "needs_logo_print",
    "needed_by",
    "message",
    "attachment_path",
    "customization",
  ] as const) {
    raw[key] = formData.get(key) ?? "";
  }

  const parsed = quoteSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "form");
      if (!fieldErrors[field])
        fieldErrors[field] = fieldCodeForIssue(issue.code);
    }
    return { ok: false, fieldErrors };
  }

  const data = parsed.data;

  // 3a. Blocklist (plan 15.2 B4): blocked phones and IPs see the same
  //     generic error the insert failure produces — the block itself is
  //     never named.
  if (await isBlocked("phone", normalizePhone(data.phone))) {
    return { ok: false, formError: "errGeneric" };
  }
  const clientIp = await getClientKey();
  if (clientIp && (await isBlocked("ip_hash", clientIp))) {
    return { ok: false, formError: "errGeneric" };
  }

  // 3b. Rate limits. (a) IP rule from the B1 RPC (plan 15.2 B3): stops phone-
  //     number rotation, which used to make this endpoint unlimited-request
  //     territory (finding R3). (b) the existing rolling per-phone count over
  //     quote_requests is kept — it survives even if abuse.ts fails open.
  if (clientIp && !(await isAllowed("quote_ip", clientIp))) {
    return { ok: false, formError: "errRateLimited" };
  }

  const admin = createAdminClient();
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("quote_requests")
    .select("id", { count: "exact", head: true })
    .eq("phone", data.phone)
    .gte("created_at", since);
  if ((count ?? 0) >= RATE_MAX) {
    return { ok: false, formError: "errRateLimited" };
  }

  // 4. Structural parse of the builder snapshot (kept as text in the form).
  let customization: unknown = null;
  if (data.customization) {
    try {
      customization = JSON.parse(data.customization);
    } catch {
      customization = null;
    }
  }

  // 5. Insert as a fresh, unassigned request.
  const { data: inserted, error } = await admin
    .from("quote_requests")
    .insert({
      source: data.source,
      contact_name: data.contact_name,
      phone: data.phone,
      email: data.email ?? null,
      company_name: data.company_name ?? null,
      product_id: data.product_id ?? null,
      category_id: data.category_id ?? null,
      quantity: data.quantity ?? null,
      custom_size: data.custom_size ?? null,
      custom_color: data.custom_color ?? null,
      needs_logo_print: data.needs_logo_print,
      needed_by: data.needed_by ?? null,
      message: data.message ?? null,
      attachment_path: data.attachment_path ?? null,
      customization: customization as never,
      status: "new",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, formError: "errGeneric" };
  }

  // Short, friendly reference the visitor can quote back to us.
  const ref = inserted.id.slice(0, 8).toUpperCase();

  // 6. Notify the owner (admin bell + Resend email, Phase 4 task 2).
  // Best-effort inside — a delivery failure never rejects the submission.
  await notifyNewQuote({
    id: inserted.id,
    source: data.source,
    contactName: data.contact_name,
    companyName: data.company_name ?? null,
    phone: data.phone,
    quantity: data.quantity ?? null,
    neededBy: data.needed_by ?? null,
    message: data.message ?? null,
  });

  return { ok: true, ref };
}
