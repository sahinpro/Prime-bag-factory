import "server-only";

import { createHash } from "node:crypto";

import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/server";
import { toAsciiDigits } from "@/lib/format";

/**
 * Plan 15.2 B2 — the abuse-protection surface used by server actions and route
 * handlers. One dependency on B1: every counter is the `check_rate_limit` RPC,
 * executed with the service-role client (only that role may call it).
 *
 * - `getClientKey()` turns the client IP into a salted SHA-256 hash and
 *   `hashPhone()` does the same for the phone half of `*_phone` keys: logs
 *   and `rate_limits.key` never contain a raw IP or a raw phone number
 *   (plan 9b "no PII in logs").
 *   On Vercel the platform-set headers are authoritative
 *   (`x-vercel-forwarded-for`, else `x-real-ip`); the leftmost
 *   `x-forwarded-for` hop is client-controlled and is only trusted off-Vercel
 *   (local dev, e2e behind Kong).
 * - Rules are named and have defaults in code, but `settings.rate_limits`
 *   (jsonb) can override any rule without a deploy — owner-tunable numbers
 *   were approved on 2026-10-19 (see Decision Log).
 * - If the RPC itself fails, callers fail OPEN: a limiter outage must not take
 *   checkout or quotes down (consistent with the settings fail-open rule).
 */

export type RateLimitRule = { limit: number; windowSeconds: number };

export type RateLimitKind =
  | "checkout_phone"
  | "checkout_ip"
  | "lookup_ip"
  | "lookup_order"
  | "quote_ip"
  | "upload_ip"
  | "admin_reset_ip"
  | "admin_reset_email";

/** Defaults from plan 15.2 B2, approved verbatim by the owner. The
 * `admin_reset_*` rules (password-recovery track, 2026-10-22) cap how often one
 * IP — or one address — may ask for a reset mail; generous enough that an
 * operator retyping an address is never locked out. */
export const RATE_LIMIT_DEFAULTS: Record<RateLimitKind, RateLimitRule> = {
  checkout_phone: { limit: 3, windowSeconds: 3600 },
  checkout_ip: { limit: 10, windowSeconds: 3600 },
  lookup_ip: { limit: 10, windowSeconds: 600 },
  lookup_order: { limit: 5, windowSeconds: 3600 },
  quote_ip: { limit: 5, windowSeconds: 3600 },
  upload_ip: { limit: 20, windowSeconds: 3600 },
  admin_reset_ip: { limit: 10, windowSeconds: 3600 },
  admin_reset_email: { limit: 5, windowSeconds: 3600 },
};

/**
 * Fallback salt when RATE_LIMIT_SALT is unset (local dev, CI). The value only
 * needs to be stable per environment; production hosts must set a private
 * salt so hashed IPs are not rainbow-table matchable (documented in
 * .env.example).
 */
const FALLBACK_SALT = "pbf-insecure-dev-salt";

function rateLimitSalt(): string {
  const salt = process.env.RATE_LIMIT_SALT;
  return salt && salt.length > 0 ? salt : FALLBACK_SALT;
}

/** First hop of an X-Forwarded-For list, trimmed; null when absent. */
export function firstForwardedHop(
  forwardedFor: string | null | undefined,
): string | null {
  const first = forwardedFor?.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

/** Salted SHA-256 — the one hashing recipe for every identity in a key. */
function saltedHash(value: string, salt: string): string {
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

/** Salted SHA-256 of the client IP — stable, non-reversible, log-safe. */
export function hashClientIp(ip: string, salt = rateLimitSalt()): string {
  return saltedHash(ip, salt);
}

/**
 * Pick the client IP from request headers. `onVercel` (from the build-time
 * `VERCEL` env var) uses only the platform-set, un-spoofable headers;
 * everywhere else (local stack, e2e) falls back to the XFF first hop.
 * Exported pure so the precedence is unit-testable.
 */
export function pickClientIp(
  getHeader: (name: string) => string | null,
  onVercel: boolean,
): string | null {
  if (onVercel) {
    return (
      firstForwardedHop(getHeader("x-vercel-forwarded-for")) ??
      firstForwardedHop(getHeader("x-real-ip"))
    );
  }
  return firstForwardedHop(getHeader("x-forwarded-for"));
}

/**
 * Salted hash of the caller's IP, for `*_ip` limit keys and the B4 ip_hash
 * blocklist. With no trustworthy header at all we return null and callers
 * skip IP-based rules rather than sharing one "unknown" bucket.
 */
export async function getClientKey(): Promise<string | null> {
  const h = await headers();
  const ip = pickClientIp(
    (name) => h.get(name),
    Boolean(process.env.VERCEL),
  );
  return ip ? hashClientIp(ip) : null;
}

/** Canonical phone for limit keys and the blocklist: ascii digits, +880 → 0. */
export function normalizePhone(raw: string): string {
  const digits = toAsciiDigits(raw).replace(/\D/g, "");
  // 880 + 1XXXXXXXXX (the shape after dropping "+"/spaces) → 01XXXXXXXXX.
  if (digits.startsWith("880")) return `0${digits.slice(3)}`;
  return digits;
}

/**
 * Salted SHA-256 of the *normalized* phone, for `*_phone` limit keys — same
 * recipe and salt as the IP hash, so `rate_limits` never stores a phone
 * number. Format variants (+880, spaces, Bangla digits) collapse onto one
 * bucket because `normalizePhone()` runs first. NOT for `blocked_contacts`,
 * which intentionally shows staff the readable phone (B4).
 */
export function hashPhone(raw: string, salt = rateLimitSalt()): string {
  return saltedHash(normalizePhone(raw), salt);
}

/**
 * Salted SHA-256 of a normalized (trimmed, lowercased) email for
 * `admin_reset_email` limit keys — same recipe as the IP/phone hashes, so
 * `rate_limits` never stores a readable address (no PII in logs, plan D1).
 */
export function hashEmail(raw: string, salt = rateLimitSalt()): string {
  return saltedHash(raw.trim().toLowerCase(), salt);
}

/**
 * Merged rules: code defaults overridden per rule by `settings.rate_limits`
 * jsonb, e.g. `{"checkout_phone": {"limit": 4, "windowSeconds": 3600}}`.
 * A missing, unreadable or malformed settings row means "use the defaults" —
 * never a denial of service for real customers.
 */
export async function getRateLimitRules(): Promise<
  Record<RateLimitKind, RateLimitRule>
> {
  const merged = { ...RATE_LIMIT_DEFAULTS };
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "rate_limits")
    .maybeSingle();
  if (error || !data) return merged;
  const value = (data.value ?? {}) as Record<string, unknown>;
  for (const kind of Object.keys(RATE_LIMIT_DEFAULTS) as RateLimitKind[]) {
    const override = value[kind];
    if (typeof override !== "object" || override === null) continue;
    const { limit, windowSeconds } = override as Record<string, unknown>;
    merged[kind] = {
      limit:
        typeof limit === "number" && Number.isInteger(limit) && limit >= 1
          ? limit
          : RATE_LIMIT_DEFAULTS[kind].limit,
      windowSeconds:
        typeof windowSeconds === "number" &&
        Number.isInteger(windowSeconds) &&
        windowSeconds >= 1
          ? windowSeconds
          : RATE_LIMIT_DEFAULTS[kind].windowSeconds,
    };
  }
  return merged;
}

/**
 * One-line structured record for a broken limiter. Deliberately PII-free:
 * the rule kind and its numbers, never the full key — since the item-0 fix
 * the identity half is already a hash, but the policy stays log-kind-only.
 */
function limiterFailureLine(
  key: string,
  rule: RateLimitRule,
  detail: string,
): string {
  const kind = key.split(":")[0] ?? "unknown";
  return JSON.stringify({
    scope: "abuse.limiter",
    event: "check_rate_limit_failed",
    kind,
    limit: rule.limit,
    windowSeconds: rule.windowSeconds,
    detail,
  });
}

/**
 * Consume one unit of `key`'s current window and report whether the caller is
 * still allowed (B1 RPC). Keys are `${kind}:${identity}` so every rule owns
 * its own counter space. Fail-open on any infrastructure error — but visible:
 * a limiter outage logs a structured error so it cannot rot silently (review
 * of B3, 2026-10-20).
 */
export async function limit(
  key: string,
  rule: RateLimitRule,
): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("check_rate_limit", {
      p_key: key,
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    if (error || data === null || data === undefined) {
      console.error(limiterFailureLine(key, rule, error?.message ?? "empty result"));
      return true;
    }
    return data;
  } catch (error) {
    console.error(
      limiterFailureLine(key, rule, error instanceof Error ? error.message : String(error)),
    );
    return true;
  }
}

/** Convenience: the kind's current rule + composed key in one call. */
export async function isAllowed(
  kind: RateLimitKind,
  identity: string,
): Promise<boolean> {
  const rules = await getRateLimitRules();
  return limit(`${kind}:${identity}`, rules[kind]);
}

/**
 * Plan 15.2 B4 — is this identity on the staff blocklist? `phone` values are
 * `normalizePhone()` output, `ip_hash` values are `getClientKey()` output, so
 * the table never holds a raw IP and phone comparisons are format-proof.
 * There is no anon read policy on `blocked_contacts`, so this goes through
 * the service-role client like the limiter does. A read failure logs a
 * structured line and returns false — same fail-open rule as `limit()`: a
 * broken lookup must not turn away real customers.
 */
export async function isBlocked(
  type: "phone" | "ip_hash",
  value: string,
): Promise<boolean> {
  if (value === "") return false;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("blocked_contacts")
      .select("id")
      .eq("type", type)
      .eq("value", value)
      .maybeSingle();
    if (error) {
      console.error(
        JSON.stringify({
          scope: "abuse.blocklist",
          event: "blocked_contacts_read_failed",
          type,
          detail: error.message,
        }),
      );
      return false;
    }
    return data !== null;
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "abuse.blocklist",
        event: "blocked_contacts_read_failed",
        type,
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
    return false;
  }
}
