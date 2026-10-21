import { NextResponse, type NextRequest } from "next/server";

/**
 * D6 (plan §15) — CSP report sink for the admin panel's
 * `Content-Security-Policy-Report-Only`. In report-only mode the browser POSTs
 * every would-be violation here instead of blocking it, so we can watch for a
 * clean week before flipping to enforcement.
 *
 * It writes NOTHING to the database and trusts nothing from the client: reports
 * are only summarized to the server logs, and the policy field is dropped
 * because it embeds the per-request nonce (logging it would leak the nonce).
 * A misbehaving or spoofed page could spam reports, so a best-effort in-memory
 * token bucket caps log volume per instance (no shared state by design — this is
 * an observability endpoint, not a security control).
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;

let windowStart = Date.now();
let seen = 0;

function allow(): boolean {
  const now = Date.now();
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    seen = 0;
  }
  seen += 1;
  return seen <= MAX_PER_WINDOW;
}

export async function POST(request: NextRequest) {
  if (!allow()) return new NextResponse(null, { status: 204 });

  try {
    const payload: unknown = await request.json();
    const wrapper =
      payload && typeof payload === "object" && "csp-report" in payload
        ? (payload as { "csp-report": Record<string, unknown> })["csp-report"]
        : payload;
    const report = (wrapper ?? {}) as Record<string, unknown>;

    console.warn("[csp-report]", {
      "document-uri": report["document-uri"],
      "violated-directive": report["violated-directive"],
      "effective-directive": report["effective-directive"],
      "blocked-uri": report["blocked-uri"],
      // Never log `original-policy` (contains the nonce), `referrer` (may carry
      // a query string) or `script-sample` (may echo page content).
    });
  } catch {
    // Non-JSON or malformed body — nothing useful to record.
  }

  // A report endpoint must never influence the page or leak timing.
  return new NextResponse(null, { status: 204 });
}
