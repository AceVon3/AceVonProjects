// Node-level verification of the Overview helpers against real filings.db data.
// For the captive State Farm AZ+NV profile:
//   - Prospect/Defend counts = 14/7 (matching /prospect and /defend; re-keyed 2026-07-15 PA/MI+B19)
//   - Recent Changes feed top row matches the spec's verification order
//   - The "My Carrier" alert card's two own-carrier counts (retention /
//     opportunity) reconcile with the My Carriers set, and both window/sort
//     correctly (see verify_retention.ts for the per-direction invariants).
//
// Usage: npx tsx scripts/verify_overview.ts

import {
  CaptiveProfile,
  getDefendFilings,
  getMyCarriersFilings,
  getProspectFilings,
} from "../src/lib/filings";
import { getDataAsOf } from "../src/lib/db";
import { computeRecentChanges } from "../src/lib/overview";
import { computeOpportunity, computeRetentionRisk } from "../src/lib/retention";

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

const CAPTIVE_SF: CaptiveProfile = {
  agent_type: "captive",
  captive_brand: "State Farm",
  authorized_brands: ["State Farm"],
  licensed_states: ["AZ", "NV"],
};

console.log("=".repeat(72));
console.log("VERIFY: Overview helpers against data/filings.db");
console.log("=".repeat(72));

const asOf = getDataAsOf();
console.log(`asOf (data freshness) = ${asOf}\n`);

console.log("Captive State Farm, AZ + NV:");
const prospect = getProspectFilings(CAPTIVE_SF);
const defend = getDefendFilings(CAPTIVE_SF);
check("prospect count = 14", prospect.length === 14, { actual: prospect.length });
check("defend count = 7", defend.length === 7, { actual: defend.length });

const feed = computeRecentChanges(prospect, defend, asOf);
console.log("\nRecent changes feed (top 8, newest first):");
feed.forEach((r, i) => {
  console.log(
    `  ${i + 1}. ${r.filing.effective_date}  ${r.filing.brand.padEnd(15)} ${r.filing.state}  ` +
    `${r.filing.overall_rate_impact >= 0 ? "+" : ""}${r.filing.overall_rate_impact.toFixed(2)}%  ` +
    `(${r.classification}, ${r.ageWeeks}w${r.future ? " left" : ""})`,
  );
});
check("feed has 8 rows", feed.length === 8, { actual: feed.length });
check("top row brand = Safeco (spec verification; re-keyed 2026-07-15 — B19 recovery outranks)",
  feed[0]?.filing.brand === "Safeco", { actual: feed[0]?.filing.brand });
check("top row classification = prospect",
  feed[0]?.classification === "prospect", { actual: feed[0]?.classification });

// -- "My Carrier" alert card: two own-carrier directions -------------------
// Both counts derive from the SAME getMyCarriersFilings set the /my-carriers
// page renders, via the shared retention.ts helpers — so the dashboard card and
// the tab reconcile by construction. (Per-direction window/sort invariants live
// in verify_retention.ts; here we assert the reconciliation + direction signs.)
console.log("\nMy Carrier alerts (captive State Farm, AZ+NV):");
const myc = getMyCarriersFilings(CAPTIVE_SF);
const retention = computeRetentionRisk(myc, asOf);
const opportunity = computeOpportunity(myc, asOf);

const mycIds = new Set(myc.map(f => f.id));
check("retention set ⊆ My Carriers set (reconciles)",
  retention.filings.every(f => mycIds.has(f.id)), { count: retention.count });
check("opportunity set ⊆ My Carriers set (reconciles)",
  opportunity.filings.every(f => mycIds.has(f.id)), { count: opportunity.count });
check("all retention rows are own-carrier increases >= +5%",
  retention.filings.every(f => f.brand === "State Farm" && f.overall_rate_impact >= 5));
check("all opportunity rows are own-carrier decreases <= -2%",
  opportunity.filings.every(f => f.brand === "State Farm" && f.overall_rate_impact <= -2));
// The two directions never overlap.
const retIds = new Set(retention.filings.map(f => f.id));
check("retention and opportunity sets are disjoint",
  opportunity.filings.every(f => !retIds.has(f.id)));
console.log(`  retention=${retention.count} (largest ${retention.largest
  ? `+${retention.largest.overall_rate_impact}% ${retention.largest.state}` : "—"})`);
console.log(`  opportunity=${opportunity.count} (largest ${opportunity.largest
  ? `${opportunity.largest.overall_rate_impact}% ${opportunity.largest.state}` : "—"})`);

// Empty-input contract (drives the "0" counts when no own-carrier data yet).
check("computeRetentionRisk([], asOf) ⇒ count 0", computeRetentionRisk([], asOf).count === 0);
check("computeOpportunity([], asOf) ⇒ count 0", computeOpportunity([], asOf).count === 0);
check("empty asOf ⇒ count 0 (prerender guard)", computeRetentionRisk(myc, "").count === 0);

console.log("\n" + "=".repeat(72));
if (failures === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.log(`FAILURES: ${failures}`);
  process.exit(1);
}
