import path from "node:path";
import { defineConfig } from "vitest/config";

import { assertLocalSupabase } from "./e2e/test-env";

// Plan 15.2 A2: unit tests carry no DB writes today, but the same local-only
// rule applies so a future test can never reach the live project by accident.
// Thrown at config load — `vitest run` aborts before any file executes.
assertLocalSupabase("vitest");

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // src/server/* carries `import "server-only"`; under Node's default
      // export condition that package throws at import time. Unit tests are
      // server-side code paths, so resolve it to its own empty module.
      "server-only": path.resolve(
        import.meta.dirname,
        "./node_modules/server-only/empty.js",
      ),
    },
  },
});
