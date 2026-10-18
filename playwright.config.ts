import { defineConfig, devices } from "@playwright/test";

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
    reuseExistingServer: !process.env.CI,
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
