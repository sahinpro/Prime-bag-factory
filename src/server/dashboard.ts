import { createClient } from "@/lib/supabase/server";

// Server-only data access for the admin dashboard (plan 9c.7 / Phase 2 task 5).
// All reads run through the cookie-based RSC client, so `has_role()` RLS policies
// apply: a role without a SELECT grant simply gets zero rows (never an error),
// which the UI renders as an EmptyState. Connection/RLS failures are surfaced via
// `fatal` so the page can show an ErrorState with Retry instead of crashing.

export type Range = "7d" | "30d" | "90d";

const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };

const QUOTE_STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;

// Chart colors reference the semantic chart tokens (no raw hex in components; the
// mapping lives here as the single source used by the server-computed pipeline).
const STAGE_HEX: Record<(typeof QUOTE_STATUSES)[number], string> = {
  new: "var(--chart-1)",
  contacted: "var(--chart-4)",
  quoted: "var(--chart-2)",
  won: "var(--chart-3)",
  lost: "var(--chart-5)",
};

const STAGE_LABEL: Record<(typeof QUOTE_STATUSES)[number], string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

const NEEDS_ACTION: (typeof QUOTE_STATUSES)[number][] = ["new", "contacted"];

export type DashboardData = {
  range: Range;
  days: number;
  newQuotes: { count: number; deltaPct: number | null; spark: number[] };
  lowStockCount: number;
  pipeline: { stage: string; label: string; value: number; color: string }[];
  quotesNeedingAction: {
    id: string;
    contact: string;
    company: string | null;
    quantity: number | null;
    neededBy: string | null;
    status: string;
    ageDays: number;
  }[];
  lowStock: {
    variantId: string;
    sku: string;
    product: string;
    available: number;
    threshold: number;
  }[];
  activity: {
    id: string;
    action: string;
    table: string;
    recordId: string | null;
    actor: string | null;
    at: string;
  }[];
  missingBangla: { products: number; categories: number };
  /** Non-fatal query problems; the page can note these without blocking. */
  degraded: string[];
  /** True when the database could not be reached at all (show ErrorState + Retry). */
  fatal: boolean;
};

function isFatalError(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "FETCH_ERROR" ||
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "PGRST301" || // JWT / no session
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("socket")
  );
}

function dayAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function getDashboardData(range: Range): Promise<DashboardData> {
  const supabase = await createClient();
  const days = RANGE_DAYS[range];
  const windowStart = dayAgo(days);
  const priorStart = dayAgo(days * 2);
  const degraded: string[] = [];
  let fatal = false;

  // A. Quote pipeline — current counts per stage (all time).
  const { data: statusRows, error: statusErr } = await supabase
    .from("quote_requests")
    .select("status");
  if (statusErr) {
    if (isFatalError(statusErr)) fatal = true;
    else degraded.push("quote pipeline");
  }
  const stageCounts: Record<string, number> = {};
  for (const row of statusRows ?? []) {
    stageCounts[row.status] = (stageCounts[row.status] ?? 0) + 1;
  }
  const pipeline = QUOTE_STATUSES.map((stage) => ({
    stage,
    label: STAGE_LABEL[stage],
    value: stageCounts[stage] ?? 0,
    color: STAGE_HEX[stage],
  }));

  // B. Windowed quotes — new count, sparkline, needing-action list.
  const { data: quoteRows, error: quoteErr } = await supabase
    .from("quote_requests")
    .select(
      "id, contact_name, company_name, quantity, needed_by, status, created_at",
    )
    .gte("created_at", priorStart.toISOString())
    .order("created_at", { ascending: false });
  if (quoteErr && isFatalError(quoteErr)) fatal = true;
  if (quoteErr && !isFatalError(quoteErr)) degraded.push("quotes");

  const rows = quoteRows ?? [];
  const inWindow = rows.filter((r) => new Date(r.created_at) >= windowStart);
  const inPrior = rows.filter(
    (r) =>
      new Date(r.created_at) >= priorStart &&
      new Date(r.created_at) < windowStart,
  );
  const count = inWindow.length;
  const prev = inPrior.length;
  const deltaPct = prev > 0 ? Math.round(((count - prev) / prev) * 100) : null;

  const spark = new Array(days).fill(0);
  for (const r of inWindow) {
    const ageDays = Math.min(
      days - 1,
      Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(r.created_at).getTime()) / 86_400_000,
        ),
      ),
    );
    spark[days - 1 - ageDays] += 1;
  }

  const quotesNeedingAction = rows
    .filter((r) =>
      NEEDS_ACTION.includes(r.status as (typeof QUOTE_STATUSES)[number]),
    )
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      contact: r.contact_name,
      company: r.company_name,
      quantity: r.quantity,
      neededBy: r.needed_by,
      status: r.status,
      ageDays: Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(r.created_at).getTime()) / 86_400_000,
        ),
      ),
    }));

  // C. Low stock — active variants where available < threshold.
  const { data: variantRows, error: variantErr } = await supabase
    .from("product_variants")
    .select(
      "id, sku, stock_qty, reserved_qty, low_stock_threshold, product:products(title_en)",
    )
    .eq("is_active", true);
  if (variantErr && isFatalError(variantErr)) fatal = true;
  if (variantErr && !isFatalError(variantErr)) degraded.push("stock");

  const lowStock: DashboardData["lowStock"] = [];
  for (const v of variantRows ?? []) {
    const available = (v.stock_qty ?? 0) - (v.reserved_qty ?? 0);
    const threshold = v.low_stock_threshold ?? 0;
    if (available < threshold) {
      const product = Array.isArray(v.product)
        ? v.product[0]?.title_en
        : v.product?.title_en;
      lowStock.push({
        variantId: v.id,
        sku: v.sku,
        product: product ?? "Untitled product",
        available,
        threshold,
      });
    }
  }
  lowStock.sort((a, b) => a.available - b.available);

  // D. Missing Bangla counts (content health strip).
  const { count: productsMissing, error: prodErr } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .is("title_bn", null);
  if (prodErr && isFatalError(prodErr)) fatal = true;
  const { count: categoriesMissing, error: catErr } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .is("name_bn", null);
  if (catErr && isFatalError(catErr)) fatal = true;

  // E. Activity feed — latest audit entries with actor name.
  const { data: auditRows, error: auditErr } = await supabase
    .from("audit_logs")
    .select(
      "id, action, table_name, record_id, created_at, actor:profiles(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(10);
  if (auditErr && isFatalError(auditErr)) fatal = true;
  if (auditErr && !isFatalError(auditErr)) degraded.push("activity");

  const activity = (auditRows ?? []).map((r) => {
    const actor = Array.isArray(r.actor)
      ? r.actor[0]?.full_name
      : r.actor?.full_name;
    return {
      id: r.id,
      action: r.action,
      table: r.table_name,
      recordId: r.record_id,
      actor: actor ?? null,
      at: r.created_at,
    };
  });

  return {
    range,
    days,
    newQuotes: { count, deltaPct, spark },
    lowStockCount: lowStock.length,
    pipeline,
    quotesNeedingAction,
    lowStock,
    activity,
    missingBangla: {
      products: productsMissing ?? 0,
      categories: categoriesMissing ?? 0,
    },
    degraded,
    fatal,
  };
}
