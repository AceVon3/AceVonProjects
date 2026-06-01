// Verifies the Sub-type rollup against the recon answer key (Feature 8).
// Node-only. Active set = active activities, 12-month, non-null effective.
//
//   180/180 active rolled filings single-valued (non-null sub_type),
//   11 distinct sub-types with these exact rolled counts:
//     PA: PPA 71, Combinations 24, Motorcycle 11, RV 7, Other 3
//     HO: Owner-Occupied 25, Combinations 17, Condo 10, Other 7, Tenant 3, Mobile 2
//
// Usage: npx tsx scripts/verify_subtype.ts

import { getDataAsOf, getDb } from "../src/lib/db";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  [${ok ? "OK  " : "FAIL"}] ${label}: ${actual}${ok ? "" : ` (expected ${expected})`}`);
}

const EXPECTED: Record<string, number> = {
  "19.0001 Private Passenger Auto (PPA)": 71,
  "19.0000 Personal Auto Combinations": 24,
  "19.0002 Motorcycle": 11,
  "19.0003 Recreational Vehicle (RV)": 7,
  "19.0004 Other": 3,
  "04.0003 Owner Occupied Homeowners": 25,
  "04.0000 Homeowners Sub-TOI Combinations": 17,
  "04.0001 Condominium Homeowners": 10,
  "04.0005 Other Homeowners": 7,
  "04.0004 Tenant Homeowners": 3,
  "04.0002 Mobile Homeowners": 2,
};

console.log("=".repeat(72));
console.log("VERIFY: Sub-type rollup vs recon answer key");
console.log("=".repeat(72));

const asOf = getDataAsOf();
const rows = getDb().prepare(`
  SELECT sub_type AS sub
  FROM filings
  WHERE rate_activity IN ('rate_change','rate_change_pending')
    AND effective_date IS NOT NULL
    AND effective_date >= date(?, '-12 months')
`).all(asOf) as { sub: string | null }[];

console.log(`\nasOf=${asOf}, active rolled filings: ${rows.length}`);
check("active rolled filings = 180", rows.length, 180);
check("all active filings single-valued (non-null sub_type)",
  rows.every(r => r.sub != null && r.sub !== ""), true);

const counts = new Map<string, number>();
for (const r of rows) if (r.sub) counts.set(r.sub, (counts.get(r.sub) ?? 0) + 1);
check("distinct sub_types in active set = 11", counts.size, 11);

console.log("\nPer-sub-type rolled counts:");
let exact = true;
for (const [sub, exp] of Object.entries(EXPECTED)) {
  const got = counts.get(sub) ?? 0;
  if (got !== exp) exact = false;
  console.log(`  [${got === exp ? "OK  " : "FAIL"}] ${String(got).padStart(3)} (exp ${exp})  ${sub}`);
}
check("every sub-type count matches recon exactly", exact, true);
// guard against unexpected extra values
const unexpected = Array.from(counts.keys()).filter(k => !(k in EXPECTED));
check("no unexpected sub_type values", unexpected.length, 0);

console.log("\n" + "=".repeat(72));
if (failures === 0) console.log("ALL CHECKS PASSED");
else { console.log(`FAILURES: ${failures}`); process.exit(1); }
