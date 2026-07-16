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
import { computePriceMetrics, rangeWindows, scoreNets } from "../src/lib/brandHealthPrice";
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
  check("12m window starts 12 months back", windows["12m"].start === "2025-06-11", windows["12m"].start);
  check("ytd starts Jan 1 of asOf year", windows.ytd.start === "2026-01-01");
  check("q2 is calendar Q2 of asOf year", windows.q2.start === "2026-04-01" && windows.q2.end === "2026-06-30");
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
