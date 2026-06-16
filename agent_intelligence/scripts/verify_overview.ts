// Node-level verification of the Overview helpers against real filings.db
// data. Confirms that for the captive State Farm AZ+NV profile:
//   - Prospect/Defend counts = 12/7 (matching /prospect and /defend)
//   - Most Urgent (Tier 2 = largest |impact| in 12-month window) picks
//     GECC-134661852 GEICO +50.9% NV with an "In effect Nw" pill
//   - Recent Changes feed top row matches the spec's verification order
//
// Usage: npx tsx scripts/verify_overview.ts

import {
  CaptiveProfile,
  IndependentProfile,
  getDefendFilings,
  getMyCarriersFilings,
  getProspectFilings,
} from "../src/lib/filings";
import { getDataAsOf } from "../src/lib/db";
import {
  CARRIER_ACTIVITY_EXTRA,
  computeCarrierActivity,
  computeMostUrgent,
  computeRecentChanges,
} from "../src/lib/overview";

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
check("prospect count = 12", prospect.length === 12, { actual: prospect.length });
check("defend count = 7", defend.length === 7, { actual: defend.length });

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

// -- "Your carrier's activity" curated recent slice ------------------------
// The card shows individual own-carrier filings selected from the SAME My
// Carriers set the /my-carriers page renders — a different SLICE of the same
// data, never a separate query. So every displayed row must be one of those
// filings (reconciliation), and the per-state coverage logic must hold.
console.log("\nCarrier-activity slice (captive State Farm, AZ+NV):");
const myc = getMyCarriersFilings(CAPTIVE_SF);
const mycIds = new Set(myc.map(f => f.id));
const { rows, noFilingStates } = computeCarrierActivity(myc, CAPTIVE_SF.licensed_states);

check("My Carriers source = 6 filings (matches /my-carriers; 0% rate-neutral suppressed)", myc.length === 6, { actual: myc.length });

// Reconciliation: every shown row is a real My Carriers filing (same source).
check("every shown row is one of the My Carriers filings (reconciles)",
  rows.every(r => mycIds.has(r.id)), { shown: rows.length });
check("no duplicate rows", new Set(rows.map(r => r.id)).size === rows.length);
check("every shown row is State Farm (own carrier only)",
  rows.every(r => r.brand === "State Farm"),
  { brands: Array.from(new Set(rows.map(r => r.brand))) });

// Coverage floor: each licensed state that HAS filings appears at least once;
// states with none are noted, not dropped — and the two sets partition the
// licensed states exactly.
const filedStates = new Set(myc.map(f => f.state));
const shownStates = new Set(rows.map(r => r.state));
check("every filed state is represented (coverage floor)",
  Array.from(filedStates).every(s => shownStates.has(s)),
  { filed: Array.from(filedStates).sort(), shown: Array.from(shownStates).sort() });
check("no-filings states are exactly the licensed states with no filings",
  JSON.stringify(noFilingStates)
    === JSON.stringify(CAPTIVE_SF.licensed_states.filter(s => !filedStates.has(s)).sort()),
  { noFilingStates });
check("floor + no-filings states partition the licensed set",
  shownStates.size + noFilingStates.length === CAPTIVE_SF.licensed_states.length,
  { shown: shownStates.size, none: noFilingStates.length, licensed: CAPTIVE_SF.licensed_states.length });

// Cap: rows = per-state floor + up to CARRIER_ACTIVITY_EXTRA, never more than
// the source set.
check("row count = floor + min(extra, remaining), capped",
  rows.length === Math.min(myc.length, filedStates.size + CARRIER_ACTIVITY_EXTRA),
  { rows: rows.length, floor: filedStates.size, extra: CARRIER_ACTIVITY_EXTRA, source: myc.length });

// Display order: newest-first (nulls last).
const effMs = (d: string | null) => (d ? Date.parse(`${d}T00:00:00Z`) : -Infinity);
const orderedDesc = rows.every((r, i) =>
  i === 0 || effMs(rows[i - 1].effective_date) >= effMs(r.effective_date));
check("rows are sorted by effective date desc (nulls last)", orderedDesc,
  { dates: rows.map(r => r.effective_date) });

rows.forEach(r =>
  console.log(`  ${(r.effective_date ?? "—").padEnd(11)} ${r.brand.padEnd(11)} ${r.state}  ${r.line_of_business.padEnd(14)} ${r.overall_rate_impact >= 0 ? "+" : ""}${r.overall_rate_impact.toFixed(1)}%`),
);
console.log(`  no-filings states: ${noFilingStates.length ? noFilingStates.join(", ") : "(none)"}`);

// Empty-input contract (drives the "No recent … filings" empty message).
const emptySlice = computeCarrierActivity([], CAPTIVE_SF.licensed_states);
check("computeCarrierActivity([], states) returns no rows (empty-state trigger)",
  emptySlice.rows.length === 0);
check("empty source ⇒ ALL licensed states are no-filings states",
  JSON.stringify(emptySlice.noFilingStates) === JSON.stringify([...CAPTIVE_SF.licensed_states].sort()),
  { noFilingStates: emptySlice.noFilingStates });

console.log("\n" + "=".repeat(72));
if (failures === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.log(`FAILURES: ${failures}`);
  process.exit(1);
}
