// Phase 3 performance gate (plan §8 / Phase 3 task 8): mobile Lighthouse on the
// key public pages. Runs against an already-started production server, scores the
// Performance category in the default mobile preset (Moto G Power + slow 4G,
// simulated throttling) and exits non-zero if any route falls under the threshold.
//
// Env:
//   LIGHTHOUSE_BASE_URL  default http://localhost:3000
//   LIGHTHOUSE_PATHS     comma-separated locale-relative paths (default "/en,/en/quote")
//   LIGHTHOUSE_MIN_PERF  minimum performance score 0-100 (default 90)
//
// Chrome is auto-discovered; set CHROME_PATH to pin a binary on a runner.
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const base = (
  process.env.LIGHTHOUSE_BASE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");
const paths = (process.env.LIGHTHOUSE_PATHS ?? "/en,/en/quote")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);
const minPerf = Number(process.env.LIGHTHOUSE_MIN_PERF ?? "90");

if (!Number.isFinite(minPerf) || minPerf < 0 || minPerf > 100) {
  console.error(
    `LIGHTHOUSE_MIN_PERF must be 0-100, got "${process.env.LIGHTHOUSE_MIN_PERF}"`,
  );
  process.exit(1);
}

const chrome = await launch({
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
});

type Row = { path: string; score: number | null; error?: string };
const rows: Row[] = [];

try {
  for (const path of paths) {
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    try {
      const result = await lighthouse(url, {
        port: chrome.port,
        output: "json",
        logLevel: "error",
        onlyCategories: ["performance"],
      });
      const lhr = result?.lhr;
      if (!lhr) {
        rows.push({ path, score: null, error: "no result returned" });
        continue;
      }
      const runtimeError = lhr.runtimeError;
      if (runtimeError && runtimeError.code !== "NO_ERROR") {
        rows.push({ path, score: null, error: runtimeError.message });
        continue;
      }
      const score = lhr.categories.performance?.score ?? null;
      rows.push({
        path,
        score: score == null ? null : Math.round(score * 100),
      });
    } catch (err) {
      rows.push({ path, score: null, error: (err as Error).message });
    }
  }
} finally {
  await chrome.kill();
}

let failed = false;
console.log(`\nLighthouse mobile · threshold ${minPerf}/100\n`);
for (const row of rows) {
  if (row.error || row.score == null) {
    failed = true;
    console.log(`  ✗ ${row.path.padEnd(28)} ${row.error ?? "no score"}`);
    continue;
  }
  const ok = row.score >= minPerf;
  failed ||= !ok;
  console.log(
    `  ${ok ? "✓" : "✗"} ${row.path.padEnd(28)} ${row.score}/100${ok ? "" : `  (< ${minPerf})`}`,
  );
}

if (failed) {
  console.error("\nPerformance gate FAILED.");
  process.exit(1);
}
console.log("\nPerformance gate passed.");
