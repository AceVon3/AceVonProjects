// Phase 3 verification for the Price Competitiveness pillar.
// Run: npx tsx scripts/verify_brand_health_price.ts
//
// Cross-checks computePriceMetrics against an INDEPENDENT recomputation
// (raw SQL here, its own scoring math) so a bug in the pillar module can't
// verify itself. Also proves the invariants:
// - windows anchor to data/last_updated.txt, quarters to its year
// - ordering: lower net movement → higher score, strictly monotonic
// - bounds: multi-peer scores in [30,90]; extremes hit exactly 90/30
// - brands with no filings in a window have NO metric (null path, never 0)
// - future quarters (after asOf) produce no metrics
// - metadata: scope "state", tier official/licensed per source, momentum note

import Database from "better-sqlite3";
import path from "node:path";

import { BH_RANGE_KEYS } from "../src/lib/brandHealth";
import {
  computePriceMetrics,
  priceTrend,
  priorRangeWindows,
  rangeWindows,
  scoreNets,
  volatilityBand,
} from "../src/lib/brandHealthPrice";
import { getDataAsOf } from "../src/lib/db";
import { BRANDS, type Brand } from "../src/lib/constants";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failures++;
    console.error(`  FAIL  ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

const asOf = getDataAsOf();
const windows = rangeWindows(asOf);
console.log(`asOf = ${asOf}`);

// Independent DB connection + independent aggregation.
const db = new Database(path.join(process.cwd(), "data", "filings.db"), { readonly: true });
function independentNets(state: string, start: string, end: string): Map<Brand, number> {
  const rows = db
    .prepare(
      `SELECT brand, SUM(overall_rate_impact) AS net
         FROM filings
        WHERE state = ? AND line_of_business = 'Personal Auto'
          AND rate_activity IN ('rate_change', 'rate_change_pending')
          AND overall_rate_impact IS NOT NULL
          AND effective_date BETWEEN ? AND ?
        GROUP BY brand`,
    )
    .all(state, start, end) as Array<{ brand: Brand; net: number }>;
  return new Map(rows.filter(r => (BRANDS as readonly string[]).includes(r.brand)).map(r => [r.brand, r.net]));
}

console.log("window resolution");
{
  check("12m window ends at asOf", windows["12m"].end === asOf, windows["12m"]);
  check("12m window starts 12 months back", windows["12m"].start === "2025-07-16", windows["12m"].start);
  check("ytd starts Jan 1 of asOf year", windows.ytd.start === "2026-01-01");
  check("q2 is calendar Q2 of asOf year", windows.q2.start === "2026-04-01" && windows.q2.end === "2026-06-30");
}

console.log("trend — prior windows + band");
{
  const priors = priorRangeWindows(asOf);
  check("prior 12m window is the 12 months before",
    priors["12m"].window.end === windows["12m"].start &&
    priors["12m"].window.start === "2024-07-16", priors["12m"]);
  // Month-shift semantics: q2 (Apr 1 - Jun 30) minus 3 months = Jan 1 -
  // Mar 30 — one day short of calendar Q1 by design (uniform month shift).
  check("prior quarter = q2 shifted back 3 months",
    priors.q2.window.start === "2026-01-01" && priors.q2.window.end === "2026-03-30", priors.q2);
  check("ytd compares to the same span last year",
    priors.ytd.window.start === "2025-01-01" && priors.ytd.label === "same period last year", priors.ytd);
  check("prior windows never precede the dataset (>= 2024-01-01)",
    Object.values(priors).every(p => p.window.start >= "2024-01-01"),
    Object.fromEntries(Object.entries(priors).map(([k, p]) => [k, p.window.start])));
  check("+3pp -> growing (accelerating)", priceTrend(5, 2) === "growing");
  check("-3pp -> declining (cooling)", priceTrend(0, 3) === "declining");
  check("inside band -> stable", priceTrend(4, 2) === "stable" && priceTrend(2, 4) === "stable");
  check("Encompass AZ case: +24 -> 0 reads cooling", priceTrend(0.0, 24.0) === "declining");
}

console.log("context notes — volatility + state average (display-only)");
{
  check("volatility bands on distribution quartiles",
    volatilityBand(2.9) === "consistent" && volatilityBand(3) === "moderate" &&
    volatilityBand(8) === "moderate" && volatilityBand(8.1) === "volatile");

  // Independent stdev recomputation for AZ from raw rows.
  const rows = db
    .prepare(
      `SELECT brand, overall_rate_impact AS v FROM filings
        WHERE state='AZ' AND line_of_business='Personal Auto'
          AND rate_activity IN ('rate_change','rate_change_pending')
          AND overall_rate_impact IS NOT NULL`,
    )
    .all() as Array<{ brand: Brand; v: number }>;
  const byBrand = new Map<Brand, number[]>();
  for (const r of rows) {
    if ((BRANDS as readonly string[]).includes(r.brand)) {
      byBrand.set(r.brand, [...(byBrand.get(r.brand) ?? []), r.v]);
    }
  }
  const az = computePriceMetrics("AZ");
  let volChecked = 0;
  for (const [brand, vals] of Array.from(byBrand.entries())) {
    if (vals.length < 3) continue;
    const mean = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
    const stdev = Math.sqrt(
      vals.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / vals.length,
    );
    const note = az[brand]?.["12m"]?.note ?? az[brand]?.["6m"]?.note ?? "";
    if (!note) continue;
    const m = note.match(/Filing pattern: (\w+) \(±([\d.]+)pp across (\d+) filings/);
    check(`AZ ${brand}: volatility in note matches independent stdev`,
      m !== null && Math.abs(parseFloat(m[2]) - stdev) < 0.05 &&
      Number(m[3]) === vals.length && m[1] === volatilityBand(stdev),
      { note: m?.slice(1), expected: [volatilityBand(stdev), stdev.toFixed(1), vals.length] });
    volChecked++;
  }
  check("volatility verified for >= 4 AZ brands", volChecked >= 4, volChecked);

  const sample = az["State Farm"]?.["12m"];
  check("state-average expenditure cited (AZ $1,344, NAIC 2023)",
    /State avg auto expenditure: \$1,344\/yr \(NAIC 2023/.test(sample?.note ?? ""), sample?.note);
}

for (const state of ["AZ", "NV", "GA", "CA"]) {
  console.log(`state ${state}`);
  const computed = computePriceMetrics(state);

  for (const range of ["12m", "q1"] as const) {
    const nets = independentNets(state, windows[range].start, windows[range].end);
    const filed = Array.from(nets.keys());

    // 1:1 coverage — a metric exists iff the brand filed in the window.
    const withMetric = BRANDS.filter(b => computed[b]?.[range] !== undefined);
    check(
      `${range}: metrics exactly for filing brands (${filed.length})`,
      withMetric.length === filed.length && withMetric.every(b => nets.has(b)),
      { withMetric, filed },
    );
    if (filed.length === 0) continue;

    // Independent re-score and exact match.
    const netVals = Array.from(nets.values());
    let allMatch = true;
    for (const b of filed) {
      const expected = scoreNets(netVals, nets.get(b)!);
      if (computed[b]![range]!.value !== expected) allMatch = false;
    }
    check(`${range}: scores match independent recomputation`, allMatch);

    // Monotonic: strictly lower net → strictly higher-or-equal score, and
    // the min/max nets hit 90/30 exactly when there's spread.
    const sorted = filed.slice().sort((a, b) => nets.get(a)! - nets.get(b)!);
    const scores = sorted.map(b => computed[b]![range]!.value);
    const monotonic = scores.every((s, i) => i === 0 || s <= scores[i - 1]);
    check(`${range}: lower movement never scores lower`, monotonic, Object.fromEntries(sorted.map(b => [b, [nets.get(b), computed[b]![range]!.value]])));
    if (new Set(netVals).size > 1) {
      check(`${range}: extremes score 90 and 30`, scores[0] === 90 && scores[scores.length - 1] === 30, [scores[0], scores[scores.length - 1]]);
    }

    // Metadata invariants.
    const meta = computed[filed[0]]![range]!;
    check(
      `${range}: metadata (scope/tier/asOf/note)`,
      meta.scope === "state" &&
        (meta.sourceTier === "official" || meta.sourceTier === "licensed") &&
        meta.dataAsOf === asOf &&
        /momentum/i.test(meta.note ?? "") &&
        /not price levels/i.test(meta.note ?? ""),
      meta,
    );
  }

  // Future quarters have no filings — Q4 must be empty for every brand.
  const q4Brands = BRANDS.filter(b => computed[b]?.q4 !== undefined);
  check("q4 (future) produces no metrics", q4Brands.length === 0, q4Brands);
}

console.log("scoring function edge cases");
{
  check("single value → neutral 60", scoreNets([5], 5) === 60);
  check("all-equal → 60", scoreNets([3, 3, 3], 3) === 60);
  check("min → 90", scoreNets([1, 5, 9], 1) === 90);
  check("max → 30", scoreNets([1, 5, 9], 9) === 30);
  check("midpoint → 60", scoreNets([1, 5, 9], 5) === 60);
}

// Spot print: AZ 12m table for eyeball sanity.
{
  const computed = computePriceMetrics("AZ");
  const nets = independentNets("AZ", windows["12m"].start, windows["12m"].end);
  console.log("AZ 12m (brand, net movement %, score):");
  for (const [b, net] of Array.from(nets.entries()).sort((x, y) => x[1] - y[1])) {
    console.log(`    ${b.padEnd(18)} ${net >= 0 ? "+" : ""}${net.toFixed(2).padStart(7)}  → ${computed[b]!["12m"]!.value}`);
  }
}

console.log("");
if (failures > 0) {
  console.error(`${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("All Brand Health price-pillar checks passed.");
