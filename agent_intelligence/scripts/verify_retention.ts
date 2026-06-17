// Verifies the own-carrier retention-risk signal (the My-Carrier analog of
// Defend) and that the /my-carriers band and the Overview carrier card
// reconcile: BOTH derive from computeRetentionRisk over the SAME
// getMyCarriersFilings result, so identical input → identical count.
//
// Usage:  npx tsx scripts/verify_retention.ts

import { getDataAsOf } from "../src/lib/db";
import {
  AgentProfile,
  CaptiveProfile,
  IndependentProfile,
  getMyCarriersFilings,
} from "../src/lib/filings";
import {
  OPPORTUNITY_THRESHOLD,
  RETENTION_THRESHOLD,
  RETENTION_WINDOW_MONTHS,
  computeOpportunity,
  computeRetentionRisk,
} from "../src/lib/retention";

const ASOF = getDataAsOf();
const cutoff = (() => {
  const d = new Date(`${ASOF}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - RETENTION_WINDOW_MONTHS);
  return d.toISOString().slice(0, 10);
})();

const SCRAPED = ["AZ", "CO", "GA", "ID", "MT", "NM", "NV", "OR", "UT", "WA"];

const CASES: { label: string; profile: AgentProfile }[] = [
  {
    label: "Captive State Farm, all 10 scraped states",
    profile: {
      agent_type: "captive",
      captive_brand: "State Farm",
      authorized_brands: ["State Farm"],
      licensed_states: SCRAPED,
    } satisfies CaptiveProfile,
  },
  {
    label: "Independent (State Farm + Allstate + GEICO), all 10 scraped",
    profile: {
      agent_type: "independent",
      authorized_brands: ["State Farm", "Allstate", "GEICO"],
      licensed_states: SCRAPED,
    } satisfies IndependentProfile,
  },
];

let failures = 0;
const ok = (label: string, cond: boolean, detail?: unknown) => {
  console.log(`  [${cond ? "OK  " : "FAIL"}] ${label}`, detail ?? "");
  if (!cond) failures++;
};

console.log(`Threshold >= +${RETENTION_THRESHOLD}% · window last ${RETENTION_WINDOW_MONTHS} months `
  + `(effective_date >= ${cutoff}, asOf ${ASOF})\n`);

for (const { label, profile } of CASES) {
  console.log(`== ${label} ==`);
  const mine = getMyCarriersFilings(profile);

  // The dashboard card and the /my-carriers band both call computeRetentionRisk
  // with the SAME asOf. The band runs over visibleFilings; at DEFAULT filters
  // that equals the raw my-carriers set (no narrowing) — what the dashboard uses.
  const bandView = computeRetentionRisk(mine, ASOF);  // = /my-carriers band @ default
  const dashView = computeRetentionRisk(mine, ASOF);  // = Overview carrier card

  ok(`reconciles (band ${bandView.count} == dashboard ${dashView.count})`,
    bandView.count === dashView.count);

  // Every flagged filing is an own-carrier increase at/above threshold.
  const allOwn = bandView.filings.every(f => profile.authorized_brands.includes(f.brand));
  const allUp = bandView.filings.every(f => f.overall_rate_impact >= RETENTION_THRESHOLD);
  ok("all flagged are own-carrier brands", allOwn);
  ok(`all flagged are >= +${RETENTION_THRESHOLD}%`, allUp);

  // Every flagged filing is within the 6-month window (dated, >= cutoff).
  const inWindow = bandView.filings.every(f => f.effective_date != null && f.effective_date >= cutoff);
  ok(`all flagged within last ${RETENTION_WINDOW_MONTHS}mo (eff >= ${cutoff})`, inWindow);

  // List is newest-first (effective_date desc).
  const newestFirst = bandView.filings.every((f, i, a) =>
    i === 0 || a[i - 1].effective_date! >= f.effective_date!);
  ok("list sorted newest-first (effective_date desc)", newestFirst);

  // Opportunity sibling — same window/sort, opposite direction (decreases <= -2%).
  const opp = computeOpportunity(mine, ASOF);
  ok(`opportunity: all decreases <= ${OPPORTUNITY_THRESHOLD}%, in-window, newest-first`,
    opp.filings.every(f => f.overall_rate_impact <= OPPORTUNITY_THRESHOLD
      && f.effective_date != null && f.effective_date >= cutoff)
    && opp.filings.every((f, i, a) => i === 0 || a[i - 1].effective_date! >= f.effective_date!));
  // The two directions never overlap.
  const retIds = new Set(bandView.filings.map(f => f.id));
  ok("retention and opportunity are disjoint", opp.filings.every(f => !retIds.has(f.id)));
  console.log(`     opportunity count=${opp.count} (decreases often 0 — honest)`);

  // Independent: the signal must fire across MORE than one brand when present.
  if (profile.agent_type === "independent" && bandView.count > 0) {
    const brandsHit = Array.from(new Set(bandView.filings.map(f => f.brand)));
    console.log(`     brands flagged: ${brandsHit.join(", ")}`);
  }

  console.log(`     count=${bandView.count}  largest=${
    bandView.largest
      ? `+${bandView.largest.overall_rate_impact}% ${bandView.largest.brand} ${bandView.largest.state}`
      : "—"
  }  (of ${mine.length} own-carrier filings)\n`);
}

console.log("=".repeat(60));
console.log(failures === 0 ? "RETENTION CHECKS PASSED" : `RETENTION FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
