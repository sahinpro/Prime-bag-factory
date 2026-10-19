import { defineConfig, devices } from "@playwright/test";

import { assertLocalSupabase, TEST_ENV_KEYS } from "./e2e/test-env";

// Plan 15.2 A2: load `.env.test` and abort before anything starts unless the
// effective Supabase URL is the local stack. The dev server below inherits
// process.env, and real env vars beat `.env.local` in Next.js — so the whole
// suite can never reach the live project.
assertLocalSupabase("playwright");

const testEnv = Object.fromEntries(
  TEST_ENV_KEYS.filter((key) => process.env[key]).map((key) => [
    key,
    process.env[key] as string,
  ]),
);

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://127.0.0.1:3000",
  },
  webServer: {
    // Playwright runs under Node. Do not start Next with `bun --bun`.
    command: "npx next dev --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/en",
    // Never reuse a server we did not start: a bun-run dev server (see the
    // 2026-10-18 Decision Log trap) serves HTML that never hydrates, and every
    // interaction test would silently no-op. If :3000 is taken, fail loudly.
    reuseExistingServer: false,
    env: testEnv,
  },
  projects: [
    {
      // Signs in a staff account (E2E_STAFF_EMAIL / E2E_STAFF_PASSWORD) and saves
      // storageState. Without those env vars it writes a baseline file and the
      // dependent admin project self-skips its tests.
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [
        /.*\.setup\.ts/,
        /a11y-admin\.spec\.ts/,
        /admin-orders\.spec\.ts/,
      ],
    },
    {
      name: "admin",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
      // Authenticated admin screens: the axe matrix and the orders feature spec.
      testMatch: [/a11y-admin\.spec\.ts/, /admin-orders\.spec\.ts/],
      // Supabase SSR refreshes the session cookie on each authed request; many
      // parallel workers sharing one storageState race that refresh and abort
      // connections (ECONNRESET). Run these serially.
      fullyParallel: false,
      workers: 1,
    },
  ],
});
