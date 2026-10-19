// Phase 3 performance gate (plan §8 / Phase 3 task 8): mobile Lighthouse on the
// key public pages. Runs against an already-started production server, scores the
// Performance category in the default mobile preset (Moto G Power + slow 4G,
// simulated throttling) and exits non-zero if any route falls under the threshold.
//
// Env:
//   LIGHTHOUSE_BASE_URL  default http://localhost:3000
//   LIGHTHOUSE_PATHS     comma-separated locale-relative paths
//                        (default "/en,/en/quote,/en/product/premium-delivery-bag";
//                        the product slug comes from supabase/seed.sql — the same
//                        database CI lighthouse runs against, plan 15.2 A6)
//   LIGHTHOUSE_MIN_PERF  minimum performance score 0-100 (default 90)
//
// Chrome is auto-discovered; set CHROME_PATH to pin a binary on a runner.
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";

const base = (
  process.env.LIGHTHOUSE_BASE_URL ?? "http://localhost:3000"
).replace(/\/+$/, "");
const paths = (
  process.env.LIGHTHOUSE_PATHS ??
  "/en,/en/quote,/en/product/premium-delivery-bag"
)
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

type Row = {
  path: string;
  score: number | null;
  error?: string;
  /** Failing-audit context printed under the score line (CI log is the only
   * place some pages can be measured — ubuntu-latest, not this machine). */
  diagnostics: string[];
};

// Pull the numbers that compose the score plus the top opportunities, so a
// red CI run explains itself instead of being re-guessed locally. Only the
// handful of LHR fields we print are typed; the rest stays lighthouse's own.
type LhrNode = { selector?: string; snippet?: string };
type LhrAudit = {
  title?: string;
  displayValue?: string;
  details?: {
    type?: string;
    overallSavingsMs?: number;
    items?: { node?: LhrNode; items?: { node?: LhrNode }[] }[];
  };
};

function collectDiagnostics(lhr: { audits?: unknown }): string[] {
  const audits = (lhr.audits ?? {}) as Record<string, LhrAudit | undefined>;
  const dv = (id: string) => audits[id]?.displayValue ?? "n/a";
  const lines = [
    `FCP ${dv("first-contentful-paint")} · LCP ${dv("largest-contentful-paint")} · TBT ${dv("total-blocking-time")} · CLS ${dv("cumulative-layout-shift")} · SI ${dv("speed-index")}`,
  ];
  // Lighthouse 13 moved the LCP element into the LCP breakdown insight; the
  // legacy audit id is kept as a fallback. The node can sit at different
  // depths across versions, so search the audit's details generically.
  const findNode = (value: unknown): LhrNode | undefined => {
    if (!value || typeof value !== "object") return undefined;
    const obj = value as Record<string, unknown>;
    if (typeof obj.snippet === "string" || typeof obj.selector === "string") {
      return { selector: obj.selector as string, snippet: obj.snippet as string };
    }
    for (const child of Object.values(obj)) {
      const found = findNode(child);
      if (found) return found;
    }
    return undefined;
  };
  const lcpNode =
    findNode(audits["lcp-breakdown-insight"]?.details) ??
    findNode(audits["largest-contentful-paint-element"]?.details);
  if (lcpNode?.snippet || lcpNode?.selector) {
    lines.push(
      `LCP element: ${lcpNode.selector ?? ""} ${(lcpNode.snippet ?? "").slice(0, 120)}`.trim(),
    );
  }
  const opportunities = Object.values(audits)
    .filter(
      (a) =>
        a?.details?.type === "opportunity" &&
        (a.details.overallSavingsMs ?? 0) > 0,
    )
    .sort(
      (a, b) =>
        (b?.details?.overallSavingsMs ?? 0) - (a?.details?.overallSavingsMs ?? 0),
    )
    .slice(0, 3)
    .map(
      (a) => `${a?.title} (~${Math.round(a?.details?.overallSavingsMs ?? 0)} ms)`,
    );
  if (opportunities.length > 0) {
    lines.push(`Opportunities: ${opportunities.join("; ")}`);
  }
  return lines;
}

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
        rows.push({ path, score: null, error: "no result returned", diagnostics: [] });
        continue;
      }
      const runtimeError = lhr.runtimeError;
      if (runtimeError && runtimeError.code !== "NO_ERROR") {
        rows.push({ path, score: null, error: runtimeError.message, diagnostics: [] });
        continue;
      }
      const score = lhr.categories.performance?.score ?? null;
      rows.push({
        path,
        score: score == null ? null : Math.round(score * 100),
        diagnostics: collectDiagnostics(lhr),
      });
    } catch (err) {
      rows.push({ path, score: null, error: (err as Error).message, diagnostics: [] });
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
  if (!ok) {
    for (const line of row.diagnostics) {
      console.log(`      ${line}`);
    }
  }
}

if (failed) {
  console.error("\nPerformance gate FAILED.");
  process.exit(1);
}
console.log("\nPerformance gate passed.");
