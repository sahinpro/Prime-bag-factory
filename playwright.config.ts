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
    // Plan 15.2 task 6: run against the production build, not `next dev`.
    // Dev-mode hydration/streaming was the source of the e2e flake; `next start`
    // serves the same artifact CI and production ship, so a green run here is a
    // green run for real. Playwright runs under Node — never start with `bun --bun`.
    command: "npx next build && npx next start --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/en",
    // The build is part of the command, so allow it to finish before timing out.
    timeout: 180_000,
    // Never reuse a server we did not start. If :3000 is taken, fail loudly.
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
        /quote-attachment\.spec\.ts/,
      ],
    },
    {
      name: "admin",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
      // Authenticated admin screens: the axe matrix, the orders feature spec and
      // the private-artwork round trip (public upload + staff signed-URL read).
      testMatch: [
        /a11y-admin\.spec\.ts/,
        /admin-orders\.spec\.ts/,
        /quote-attachment\.spec\.ts/,
      ],
      // Supabase SSR refreshes the session cookie on each authed request; many
      // parallel workers sharing one storageState race that refresh and abort
      // connections (ECONNRESET). Run these serially.
      fullyParallel: false,
      workers: 1,
    },
  ],
});
