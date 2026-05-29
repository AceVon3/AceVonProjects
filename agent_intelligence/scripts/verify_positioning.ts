// Verifies the Rate Positioning classifier against the recon answer key.
// Node-only (no browser), like verify_queries.ts.
//
//   Captive State Farm, all 8 states:
//     10 anchored / 6 unanchored cells; 41 comparable (24 high, 17 thin); 29 insufficient
//   Independent {State Farm, Travelers, Progressive}, all 8 states:
//     69 comparable, 34 higher-confidence
//
// Usage:  npx tsx scripts/verify_positioning.ts

import { getPositioning } from "../src/lib/positioning";
import type { AgentProfile } from "../src/lib/filings";

const ALL_8 = ["AZ", "CO", "ID", "MT", "NV", "OR", "UT", "WA"];

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  [${ok ? "OK  " : "FAIL"}] ${label}: ${actual}${ok ? "" : ` (expected ${expected})`}`);
}

const captive: AgentProfile = {
  agent_type: "captive",
  captive_brand: "State Farm",
  authorized_brands: ["State Farm"],
  licensed_states: ALL_8,
};

const independent: AgentProfile = {
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers", "Progressive"],
  licensed_states: ALL_8,
};

console.log("=".repeat(72));
console.log("VERIFY: Rate Positioning classifier vs recon answer key");
console.log("=".repeat(72));

console.log("\nCaptive State Farm, all 8 states:");
const c = getPositioning(captive).totals;
check("anchored cells", c.anchoredCellCount, 10);
check("unanchored cells", c.unanchoredCellCount, 6);
check("comparable comparisons", c.comparable, 41);
check("  higher-confidence (>=2 each)", c.higherConfidence, 24);
check("  thin", c.thin, 17);
check("insufficient (competitor absent)", c.insufficient, 29);

console.log("\nIndependent {State Farm, Travelers, Progressive}, all 8 states:");
const i = getPositioning(independent).totals;
check("comparable comparisons", i.comparable, 69);
check("  higher-confidence (>=2 each)", i.higherConfidence, 34);

console.log("\n" + "=".repeat(72));
if (failures === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.log(`FAILURES: ${failures}`);
  process.exit(1);
}
