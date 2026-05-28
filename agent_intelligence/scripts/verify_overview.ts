// Node-level verification of the Overview helpers against real filings.db
// data. Confirms that for the captive State Farm AZ+NV profile:
//   - Prospect/Defend counts = 13/8 (matching /prospect and /defend)
//   - Most Urgent (Tier 2 = largest |impact| in 12-month window) picks
//     GECC-134661852 GEICO +50.9% NV with an "In effect Nw" pill
//   - Recent Changes feed top row matches the spec's verification order
//
// Usage: npx tsx scripts/verify_overview.ts

import {
  CaptiveProfile,
  IndependentProfile,
  getDefendFilings,
  getProspectFilings,
} from "../src/lib/filings";
import { getDataAsOf } from "../src/lib/db";
import { computeMostUrgent, computeRecentChanges } from "../src/lib/overview";

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
check("prospect count = 13", prospect.length === 13, { actual: prospect.length });
check("defend count = 8", defend.length === 8, { actual: defend.length });

const mu = computeMostUrgent(prospect, defend, asOf);
if (!mu) {
  check("most urgent computed (not null)", false);
} else {
  check("most urgent SERFF = GECC-134661852",
    mu.filing.serff_tracking_number === "GECC-134661852",
    { actual: mu.filing.serff_tracking_number });
  check("most urgent brand = GEICO", mu.filing.brand === "GEICO", { actual: mu.filing.brand });
  check("most urgent state = NV", mu.filing.state === "NV", { actual: mu.filing.state });
  check("most urgent impact ≈ +50.88%",
    Math.abs(mu.filing.overall_rate_impact - 50.88) < 0.05,
    { actual: mu.filing.overall_rate_impact });
  check("most urgent classification = prospect",
    mu.classification === "prospect", { actual: mu.classification });
  check("most urgent tier = 2 (no future-dated; collapsed fallback fires)",
    mu.tier === 2, { actual: mu.tier });
  check("most urgent pill text matches 'In effect Nw' shape",
    /^In effect \d+w$/.test(mu.pillText), { actual: mu.pillText });
}

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
check("top row brand = Travelers (spec verification)",
  feed[0]?.filing.brand === "Travelers", { actual: feed[0]?.filing.brand });
check("top row classification = defend",
  feed[0]?.classification === "defend", { actual: feed[0]?.classification });

console.log("\n" + "=".repeat(72));
if (failures === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.log(`FAILURES: ${failures}`);
  process.exit(1);
}
