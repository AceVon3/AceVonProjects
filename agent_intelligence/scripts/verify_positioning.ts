// Verifies the Rate Positioning classifier against the recon answer key.
// Node-only (no browser), like verify_queries.ts.
//
// Re-baselined for the 2026-06 expansion (data as-of 2026-06-11; 13 brands /
// Re-keyed 2026-07-10 (B16 correction): +5 recovered rows in AZ/NV/OR/UT
// moved one cell insufficient->comparable(thin) and +2 independent
// comparisons — 42 comparable (23 high, 19 thin) / 24 insufficient / 66
// independent. Prior note:
// 10 states). The 8-state cell structure is unchanged (10 anchored / 6
// unanchored / 41 comparable); the as-of shift moved one comparison from
// higher-confidence to thin (24→23 / 17→18). "insufficient" dropped (29→25)
// because the classifier is now COVERAGE-AWARE: the 5 GA-only brands are no
// longer counted as absent competitors in the 8 non-GA states (they aren't
// collected there). Every total below was independently reconciled against a
// separate count-only recompute over the active rolled filings (they agreed).
//
//   Captive State Farm, all 8 states:
//     10 anchored / 6 unanchored cells; 41 comparable (23 high, 18 thin); 25 insufficient
//   Independent {State Farm, Travelers, Progressive}, all 8 states:
//     64 comparable, 30 higher-confidence
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

// Re-keyed 2026-07-22: MN import (41st state) — moved pins are the +1-day
// as_of slide only (MN not in ALL_8): the 5 aged rows (eff exactly 2025-07-21,
// incl ALSE-134570882 OR +31.0 / ALSE-134604458 UT +10.7) drop comparisons ->
// captive comparable 47->46, thin 23->22, insufficient 26->27; independent
// comparable 78->77. verify_queries.ts carries the same aged-row attribution.
//
// Re-keyed 2026-08-18 for the 26h2 refresh + NC import (as_of 2026-08-10,
// db 10634 raw / 6690 rolled) — this file was missed in the 08-10 re-key and
// had been failing since. The refresh backfilled ~half a year of newer
// filings across the 8 states, roughly doubling in-window comparisons:
// captive 11/5/46 (24 high, 22 thin)/27 -> 15/1/96 (36/60)/51; independent
// 77/33 -> 166/57. Every total below was independently reconciled against a
// count-only SQL recompute over the active rolled filings (they agreed
// exactly). The same-day 0026->2026 effective-date fix (NWPP-134775715, PA)
// is outside ALL_8 and moved nothing here — proven by a row-diff of the DB
// before/after the fix.
console.log("=".repeat(72));
console.log("VERIFY: Rate Positioning classifier vs recon answer key");
console.log("=".repeat(72));

console.log("\nCaptive State Farm, all 8 states:");
const c = getPositioning(captive).totals;
check("anchored cells", c.anchoredCellCount, 15);
check("unanchored cells", c.unanchoredCellCount, 1);
check("comparable comparisons", c.comparable, 96);
check("  higher-confidence (>=2 each)", c.higherConfidence, 36);
check("  thin", c.thin, 60);
check("insufficient (covered competitor absent)", c.insufficient, 51);

console.log("\nIndependent {State Farm, Travelers, Progressive}, all 8 states:");
const i = getPositioning(independent).totals;
check("comparable comparisons", i.comparable, 166);
check("  higher-confidence (>=2 each)", i.higherConfidence, 57);

console.log("\n" + "=".repeat(72));
if (failures === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.log(`FAILURES: ${failures}`);
  process.exit(1);
}
