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
 * - `getClientKey()` turns the client IP into a salted SHA-256 hash: logs and
 *   `rate_limits.key` never contain the raw IP (plan 9b "no PII in logs").
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
  | "upload_ip";

/** Defaults from plan 15.2 B2, approved verbatim by the owner. */
export const RATE_LIMIT_DEFAULTS: Record<RateLimitKind, RateLimitRule> = {
  checkout_phone: { limit: 3, windowSeconds: 3600 },
  checkout_ip: { limit: 10, windowSeconds: 3600 },
  lookup_ip: { limit: 10, windowSeconds: 600 },
  lookup_order: { limit: 5, windowSeconds: 3600 },
  quote_ip: { limit: 5, windowSeconds: 3600 },
  upload_ip: { limit: 20, windowSeconds: 3600 },
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

/** Salted SHA-256 of the client IP — stable, non-reversible, log-safe. */
export function hashClientIp(ip: string, salt = rateLimitSalt()): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Salted hash of the caller's IP, for `*_ip` limit keys and the B4 ip_hash
 * blocklist. Behind any proxy (Vercel, Supabase local Kong) XFF is present;
 * with no proxy header at all we return null and callers skip IP-based rules
 * rather than sharing one "unknown" bucket.
 */
export async function getClientKey(): Promise<string | null> {
  const h = await headers();
  const ip = firstForwardedHop(h.get("x-forwarded-for"));
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
 * Consume one unit of `key`'s current window and report whether the caller is
 * still allowed (B1 RPC). Keys are `${kind}:${identity}` so every rule owns
 * its own counter space. Fail-open on any infrastructure error.
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
      console.error("[abuse] check_rate_limit failed, failing open:", error?.message);
      return true;
    }
    return data;
  } catch (error) {
    console.error("[abuse] check_rate_limit threw, failing open:", error);
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
