import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  isQuoteAttachmentPath,
  QUOTE_ATTACHMENT_BUCKET,
} from "@/lib/validators/quote-attachment";

// Server-only data access for the admin quotes module (plan §9 Quotes / Phase 4,
// layout 9c.8 "Quotes inbox / Quote detail"). Reads run through the cookie-based
// RSC client so the `has_role(['owner','manager','sales'])` policy on
// quote_requests applies; a role without access simply gets zero rows.

import type { Database } from "@/lib/database.types";

type QuoteStatus = Database["public"]["Enums"]["quote_status"];
type QuoteSource = Database["public"]["Enums"]["quote_source"];

export const QUOTE_STATUS_ORDER: QuoteStatus[] = [
  "new",
  "contacted",
  "quoted",
  "won",
  "lost",
];

/** Urgency bucket derived from `needed_by` (delivery) or `valid_until` (quote). */
export type QuoteUrgency = "overdue" | "due_soon" | "later";

/**
 * Builder snapshot shape stored in `quote_requests.customization` by the
 * Custom Bag Builder wizard (see `site/builder-wizard.tsx`). Parsed defensively
 * — the jsonb is user-facing history and old rows may not match.
 */
export type BuilderSnapshot = {
  category: { id?: string; slug?: string; name?: string } | null;
  size: {
    width?: number;
    height?: number;
    gusset?: number;
    unit?: string;
  } | null;
  material: string | null;
  colors: {
    primary: { name?: string; hex?: string } | null;
    handle: { name?: string; hex?: string } | null;
  } | null;
  printing: { method?: string; text?: string; artwork?: string } | null;
  quantity: number | null;
};

export type AdminQuote = {
  id: string;
  source: QuoteSource;
  company_name: string | null;
  contact_name: string;
  phone: string;
  email: string | null;
  product_id: string | null;
  product_title: string | null;
  category_id: string | null;
  category_name: string | null;
  quantity: number | null;
  custom_size: string | null;
  custom_color: string | null;
  needs_logo_print: boolean;
  needed_by: string | null;
  message: string | null;
  attachment_path: string | null;
  estimated_unit_price: number | null;
  estimated_total: number | null;
  status: QuoteStatus;
  quoted_amount: number | null;
  valid_until: string | null;
  assigned_to: string | null;
  assigned_name: string | null;
  internal_notes: string | null;
  /** NULL until a staff member first opens the detail (unseen badge). */
  first_viewed_at: string | null;
  created_at: string;
  updated_at: string;
  urgency: QuoteUrgency | null;
};

/** Detail view adds the parsed builder snapshot (inbox rows stay light). */
export type AdminQuoteDetail = AdminQuote & {
  builder: BuilderSnapshot | null;
};

export type AssignableStaff = {
  id: string;
  full_name: string;
  role: Database["public"]["Enums"]["user_role"];
};

const LIST_SELECT =
  "id, source, company_name, contact_name, phone, email, product_id, category_id, quantity, custom_size, custom_color, needs_logo_print, needed_by, message, attachment_path, estimated_unit_price, estimated_total, status, quoted_amount, valid_until, assigned_to, internal_notes, first_viewed_at, created_at, updated_at, product:products(title_en), category:categories(name_en), assignee:profiles(full_name)";

// Full literal (not a template) so the generated Supabase types can parse it.
const DETAIL_SELECT =
  "id, source, company_name, contact_name, phone, email, product_id, category_id, quantity, custom_size, custom_color, needs_logo_print, needed_by, message, attachment_path, estimated_unit_price, estimated_total, status, quoted_amount, valid_until, assigned_to, internal_notes, first_viewed_at, created_at, updated_at, customization, product:products(title_en), category:categories(name_en), assignee:profiles(full_name)";

type Joined = {
  product: { title_en: string | null } | null;
  category: { name_en: string | null } | null;
  assignee: { full_name: string | null } | null;
};

/** A selected quote_requests row plus its to-one embeds (list projection). */
type QuoteRow = Omit<
  AdminQuote,
  "urgency" | "product_title" | "category_name" | "assigned_name"
> &
  Joined;

/** PostgREST to-one embeds may come back as an object or a 1-item array. */
function unwrap<T extends object>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * needed_by drives urgency while the request is open; once quoted, the
 * validity window takes over. No date → no urgency badge.
 */
function computeUrgency(
  row: {
    status: QuoteStatus;
    needed_by: string | null;
    valid_until: string | null;
  },
  nowMs: number,
): QuoteUrgency | null {
  const target =
    row.status === "quoted"
      ? (row.valid_until ?? row.needed_by)
      : (row.needed_by ?? row.valid_until);
  if (!target) return null;
  const dayMs = 86_400_000;
  const days = Math.floor(
    (new Date(`${target}T23:59:59+06:00`).getTime() - nowMs) / dayMs,
  );
  if (days < 0) return "overdue";
  if (days <= 2) return "due_soon";
  return "later";
}

function parseBuilder(value: unknown): BuilderSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  const obj = (x: unknown) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? (x as Record<string, unknown>)
      : null;
  const category = obj(v.category);
  const size = obj(v.size);
  const colors = obj(v.colors);
  const printing = obj(v.printing);
  const color = (x: unknown) => {
    const c = obj(x);
    return c
      ? {
          name: typeof c.name === "string" ? c.name : undefined,
          hex: typeof c.hex === "string" ? c.hex : undefined,
        }
      : null;
  };
  return {
    category: category
      ? {
          id: typeof category.id === "string" ? category.id : undefined,
          slug: typeof category.slug === "string" ? category.slug : undefined,
          name: typeof category.name === "string" ? category.name : undefined,
        }
      : null,
    size: size
      ? {
          width: typeof size.width === "number" ? size.width : undefined,
          height: typeof size.height === "number" ? size.height : undefined,
          gusset: typeof size.gusset === "number" ? size.gusset : undefined,
          unit: typeof size.unit === "string" ? size.unit : undefined,
        }
      : null,
    material: typeof v.material === "string" ? v.material : null,
    colors: colors
      ? { primary: color(colors.primary), handle: color(colors.handle) }
      : null,
    printing: printing
      ? {
          method:
            typeof printing.method === "string" ? printing.method : undefined,
          text: typeof printing.text === "string" ? printing.text : undefined,
          artwork:
            typeof printing.artwork === "string" ? printing.artwork : undefined,
        }
      : null,
    quantity: typeof v.quantity === "number" ? v.quantity : null,
  };
}

function toAdminQuote(row: QuoteRow, nowMs: number): AdminQuote {
  return {
    id: row.id as string,
    source: row.source as QuoteSource,
    company_name: (row.company_name as string | null) ?? null,
    contact_name: row.contact_name as string,
    phone: row.phone as string,
    email: (row.email as string | null) ?? null,
    product_id: (row.product_id as string | null) ?? null,
    product_title: unwrap(row.product)?.title_en ?? null,
    category_id: (row.category_id as string | null) ?? null,
    category_name: unwrap(row.category)?.name_en ?? null,
    quantity: (row.quantity as number | null) ?? null,
    custom_size: (row.custom_size as string | null) ?? null,
    custom_color: (row.custom_color as string | null) ?? null,
    needs_logo_print: Boolean(row.needs_logo_print),
    needed_by: (row.needed_by as string | null) ?? null,
    message: (row.message as string | null) ?? null,
    attachment_path: (row.attachment_path as string | null) ?? null,
    estimated_unit_price:
      row.estimated_unit_price == null
        ? null
        : Number(row.estimated_unit_price),
    estimated_total:
      row.estimated_total == null ? null : Number(row.estimated_total),
    status: row.status as QuoteStatus,
    quoted_amount: row.quoted_amount == null ? null : Number(row.quoted_amount),
    valid_until: (row.valid_until as string | null) ?? null,
    assigned_to: (row.assigned_to as string | null) ?? null,
    assigned_name: unwrap(row.assignee)?.full_name ?? null,
    internal_notes: (row.internal_notes as string | null) ?? null,
    first_viewed_at: (row.first_viewed_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    urgency: computeUrgency(row, nowMs),
  };
}

/** Newest first; the inbox filters/paginates client-side over these rows. */
export async function listAdminQuotes(
  status?: QuoteStatus,
): Promise<AdminQuote[]> {
  const supabase = await createClient();
  let query = supabase
    .from("quote_requests")
    .select(LIST_SELECT)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error("Failed to load quotes.", { cause: error });
  const nowMs = Date.now();
  return (data ?? []).map((row) => toAdminQuote(row, nowMs));
}

export type QuoteStatusCounts = {
  all: number;
  new: number;
  contacted: number;
  quoted: number;
  won: number;
  lost: number;
};

export async function countQuotesByStatus(): Promise<QuoteStatusCounts> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_requests")
    .select("status");
  if (error) throw new Error("Failed to count quotes.", { cause: error });
  const counts: QuoteStatusCounts = {
    all: (data ?? []).length,
    new: 0,
    contacted: 0,
    quoted: 0,
    won: 0,
    lost: 0,
  };
  for (const row of data ?? []) counts[row.status] += 1;
  return counts;
}

export async function getAdminQuote(
  id: string,
): Promise<AdminQuoteDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quote_requests")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Failed to load the quote.", { cause: error });
  if (!data) return null;
  const nowMs = Date.now();
  return {
    ...toAdminQuote(data, nowMs),
    builder: parseBuilder(data.customization),
  };
}

/**
 * Plan 15.2 F1 — the id of the order this quote was already converted into, or
 * null. `convert_quote_to_order` is convert-once, so the detail page shows a
 * "View order" link instead of the button when this resolves. Read under the
 * caller's session (staff can already read `orders` through RLS).
 */
export async function findConvertedOrderId(
  quoteId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("source_quote_id", quoteId)
    .maybeSingle();
  if (error)
    throw new Error("Failed to load the linked order.", { cause: error });
  return data ? String(data.id) : null;
}

/**
 * Plan 15.2 B6 — a short-lived signed GET URL so staff can open a private
 * quote attachment. Generated server-side on the service-role client (the
 * bucket denies every direct anon/authenticated read), so the browser never
 * learns a stable URL for a customer's artwork. Returns null for an empty or
 * malformed path, or when the object cannot be signed (missing/expired).
 */
export async function createAttachmentReadUrl(
  path: string | null,
  expiresIn = 300,
): Promise<string | null> {
  if (!path || !isQuoteAttachmentPath(path)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(QUOTE_ATTACHMENT_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Staff who can own a quote — the roles with write access to quote_requests. */
export async function listAssignableStaff(): Promise<AssignableStaff[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("role", ["owner", "manager", "sales"])
    .order("full_name");
  if (error) throw new Error("Failed to load staff.", { cause: error });
  return (data ?? []).map((row) => ({
    id: row.id,
    full_name: row.full_name ?? "Unnamed",
    role: row.role,
  }));
}
