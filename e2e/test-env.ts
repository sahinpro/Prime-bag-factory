import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Test safety (plan 15.2 A2): unit and e2e tests must only ever speak to the
 * local Supabase stack (`supabase start`), never to the live project.
 *
 * `.env.test` (gitignored, local-only; copy `.env.test.example`) is the source
 * of truth for the DB-facing variables below. It is applied over
 * `process.env` on purpose: `bun run test` pre-loads `.env.local` (the live
 * project) into the environment, and the test values must win. The assert
 * then aborts if the effective URL is not localhost — so a missing or stale
 * `.env.test` fails closed instead of silently mutating production.
 */

const ROOT = process.cwd();

/** Whitelist: only these keys from `.env.test` are allowed to override env. */
export const TEST_ENV_KEYS = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_WHATSAPP_NUMBER",
  "E2E_STAFF_EMAIL",
  "E2E_STAFF_PASSWORD",
] as const;

export function parseDotEnv(text: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    const quoted =
      value.length > 1 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));
    if (quoted) value = value.slice(1, -1);
    if (key) vars[key] = value;
  }
  return vars;
}

let applied = false;

/** Loads `.env.test` (if present) and lets it own the whitelisted vars. */
export function applyTestEnv(): void {
  if (applied) return;
  applied = true;
  const file = path.join(ROOT, ".env.test");
  if (!existsSync(file)) return;
  const vars = parseDotEnv(readFileSync(file, "utf8"));
  for (const key of TEST_ENV_KEYS) {
    const value = vars[key];
    if (value !== undefined && value !== "") process.env[key] = value;
  }
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/** Function declaration (not an arrow) so TS narrows the caller after it. */
function abortTests(runner: string, reason: string): never {
  throw new Error(
    `[${runner}] refusing to run tests: ${reason}\n` +
      "Tests may only target the local Supabase stack (plan 15.2 A2). " +
      "Run `bunx supabase start`, then copy `.env.test.example` to `.env.test` " +
      "(keys come from the start output) and retry. " +
      "Never point tests at the live project.",
  );
}

/**
 * Abort (throw before any test runs) unless the effective Supabase URL is the
 * local stack. Plain http only: a https `localhost` would not be the CLI.
 */
export function assertLocalSupabase(runner: string): void {
  applyTestEnv();
  const raw: string = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!raw) abortTests(runner, "NEXT_PUBLIC_SUPABASE_URL is not set");
  const target = parseSupabaseUrl(raw, runner);
  if (target.protocol !== "http:") {
    abortTests(runner, `NEXT_PUBLIC_SUPABASE_URL "${raw}" must be plain http:// on the local stack`);
  }
  if (!LOCAL_HOSTS.has(target.hostname)) {
    abortTests(runner, `NEXT_PUBLIC_SUPABASE_URL "${raw}" is not localhost/127.0.0.1`);
  }
}

function parseSupabaseUrl(raw: string, runner: string): URL {
  try {
    return new URL(raw);
  } catch {
    return abortTests(runner, `NEXT_PUBLIC_SUPABASE_URL "${raw}" is not a valid URL`);
  }
}
