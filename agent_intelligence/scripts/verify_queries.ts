// Runs the spec's per-query verification cases against the real filings.db
// and prints actual row counts. Used as a build-time sanity check after
// regenerating the SQLite file.
//
// Usage:  npx tsx scripts/verify_queries.ts

import {
  AgentProfile,
  CaptiveProfile,
  IndependentProfile,
  getDefendFilings,
  getMyCarriersFilings,
  getProspectFilings,
} from "../src/lib/filings";
import { getDataAsOf, getDb } from "../src/lib/db";

const ALL_8 = ["AZ", "CO", "ID", "MT", "NV", "OR", "UT", "WA"];

type ProspectDefendCase = {
  label: string;
  profile: AgentProfile;
  expected_prospect: number;
  expected_defend: number;
};

type MyCarriersCase = {
  label: string;
  profile: IndependentProfile;
  expected: number;
};

// Re-keyed 2026-07-27: AL import (43rd state) — all three moved pins trace to
// ONE aged filing: ALSE-134500694 Allstate WA -2.9% (eff 2025-07-24) left the
// +5-day slide window -> captive-SF defend 26->25, independent defend 35->34,
// my-carriers all-8 71->70. AL is in no case's state set (adds 3 active rows
// total, none in ALL_8).
// Re-keyed 2026-07-22: MN import (41st state) — every moved pin is the +1-day
// as_of slide only (MN is in no case's state set; 5 rows eff exactly 2025-07-21
// aged out). Prospect all-8: ALSE-134570882 OR +31.0, ALSE-134604458 UT +10.7
// aged -> captive-SF 39->37, independent 48->46; defend untouched. My-carriers
// all-8: the LBPM-134399434 ID / ALSE-134489276+134489925 WA agings -> 73->71.
// Re-keyed 2026-07-21: MO import (40th state) — every moved pin is the +5-day
// as_of slide only (MO is in no case's state set). Defend all-8: GNSC-134605705
// UT (State Farm -9.9), LBPM-134543988 MT (Safeco -4.0), LBPM-134586929 OR
// (Safeco -4.0) aged out (eff 2025-07-18/19/20) -> independent 38->35,
// captive-SF 28->26 (GNSC is SF, already excluded there). My-carriers:
// LBPM-134532655 OR + the two Safeco rows aged out -> 25->24, 75->73.
const PROSPECT_DEFEND_CASES: ProspectDefendCase[] = [
  {
    label: "Captive State Farm, AZ+NV",
    profile: {
      agent_type: "captive",
      captive_brand: "State Farm",
      authorized_brands: ["State Farm"],
      licensed_states: ["AZ", "NV"],
    } satisfies CaptiveProfile,
    expected_prospect: 13,
    expected_defend: 7,
  },
  {
    label: "Captive Allstate, AZ+NV",
    profile: {
      agent_type: "captive",
      captive_brand: "Allstate",
      authorized_brands: ["Allstate"],
      licensed_states: ["AZ", "NV"],
    } satisfies CaptiveProfile,
    expected_prospect: 10,
    expected_defend: 6,
  },
  {
    label: "Captive State Farm, all 8 states",
    profile: {
      agent_type: "captive",
      captive_brand: "State Farm",
      authorized_brands: ["State Farm"],
      licensed_states: ALL_8,
    } satisfies CaptiveProfile,
    expected_prospect: 37,
    // Re-keyed 2026-07-30 (TX import / B20 fold-in): 25 -> 26. The +1 is UT
    // ALSE-134657702 Allstate Personal Auto -7.0% eff 2025-10-14 — a B20
    // new-product override save (non-own-brand, so it lands in SF Defend).
    expected_defend: 26,
  },
  {
    label: "Independent, AZ+NV",
    profile: {
      agent_type: "independent",
      authorized_brands: ["State Farm", "Allstate", "GEICO"], // brands don't matter for Prospect/Defend (independents see all 13)
      licensed_states: ["AZ", "NV"],
    } satisfies IndependentProfile,
    expected_prospect: 14,
    expected_defend: 9,
  },
  {
    label: "Independent, all 8 states",
    profile: {
      agent_type: "independent",
      authorized_brands: ["State Farm", "Allstate", "GEICO"],
      licensed_states: ALL_8,
    } satisfies IndependentProfile,
    // Re-keyed 2026-08-03 (CA import): 45 -> 44. -1 = WA SFMA-134422784 aged
    // out by the 4-day as_of slide (07-30 -> 08-03); old-vs-new db diff at the
    // same as_of is EMPTY (CA is not in the 8 western test states, so the CA
    // import itself cannot move these counts). Prior note:
    // Re-keyed 2026-07-30: 46 -> 45. -1 = CO SFMA-134532940 SF Personal Auto
    // +13.4% eff 2025-07-29 aged out by the 3-day as_of slide (07-27 -> 07-30).
    expected_prospect: 44,
    expected_defend: 34,
  },
];

const MY_CARRIERS_CASES: MyCarriersCase[] = [
  {
    label: "Independent, sells SF + Travelers, AZ+NV",
    profile: {
      agent_type: "independent",
      authorized_brands: ["State Farm", "Travelers"],
      licensed_states: ["AZ", "NV"],
    },
    expected: 10,
  },
  {
    label: "Independent, sells SF + Travelers + Progressive, AZ+CO+NV",
    profile: {
      agent_type: "independent",
      authorized_brands: ["State Farm", "Travelers", "Progressive"],
      licensed_states: ["AZ", "CO", "NV"],
    },
    // Re-keyed 2026-07-30: 24 -> 21. -3 = the CO State Farm Personal Auto trio
    // (SFMA-134532992/134532940/134532998, all eff 2025-07-29) aged out by the
    // 3-day as_of slide. Nothing added: no TX/B20 rows touch this scope.
    expected: 21,
  },
  {
    label: "Independent, sells Allstate + Liberty Mutual + Safeco, all 8 states",
    profile: {
      agent_type: "independent",
      authorized_brands: ["Allstate", "Liberty Mutual", "Safeco"],
      licensed_states: ALL_8,
    },
    // Re-keyed 2026-07-30 (TX import / B20 fold-in): 70 -> 71. The B20 sweep
    // added 6 rows to this brand/state slice; 5 are exactly-0% (suppressed by
    // the rate-neutral filter) — the +1 is UT ALSE-134657702 Allstate Personal
    // Auto -7.0% eff 2025-10-14 (a new-product override save, 17,653 ph).
    expected: 71,
  },
];

function mark(actual: number, expected: number): string {
  return actual === expected ? "OK  " : "FAIL";
}

function main(): void {
  // Window anchors to data freshness (data/last_updated.txt), not the wall
  // clock — so verification is deterministic per data snapshot.
  const db = getDb();
  const ref = getDataAsOf();
  const windowStart = db
    .prepare("SELECT date(?, '-12 months') AS d")
    .get(ref) as { d: string };

  console.log("=".repeat(78));
  console.log("VERIFY: per-query test cases against data/filings.db");
  console.log(`  asOf (data freshness)     = ${ref}`);
  console.log(`  date(asOf, '-12 months')  = ${windowStart.d}`);
  console.log("=".repeat(78));

  // Sanity totals for the active window — baseline is 293 filings (data as-of 2026-06-11).
  const active = db
    .prepare(
      `SELECT COUNT(*) AS n FROM filings
       WHERE rate_activity IN ('rate_change','rate_change_pending')
         AND effective_date >= date(?, '-12 months')`,
    )
    .get(ref) as { n: number };
  console.log(`  active-window filings (all states, all brands) = ${active.n}  (baseline: 293)`);
  console.log("=".repeat(78));

  let allOk = true;

  console.log("\nProspect / Defend cases:");
  console.log("  expected = (prospect / defend)");
  for (const c of PROSPECT_DEFEND_CASES) {
    const p = getProspectFilings(c.profile).length;
    const d = getDefendFilings(c.profile).length;
    const okP = mark(p, c.expected_prospect);
    const okD = mark(d, c.expected_defend);
    if (p !== c.expected_prospect || d !== c.expected_defend) allOk = false;
    console.log(
      `  [${okP}] [${okD}]  ${c.label.padEnd(45)} ` +
        `prospect ${p} (exp ${c.expected_prospect})  ` +
        `defend ${d} (exp ${c.expected_defend})`,
    );
  }

  console.log("\nMy Carriers cases (no impact threshold):");
  for (const c of MY_CARRIERS_CASES) {
    const n = getMyCarriersFilings(c.profile).length;
    const ok = mark(n, c.expected);
    if (n !== c.expected) allOk = false;
    console.log(
      `  [${ok}]        ${c.label.padEnd(58)} ` +
        `rows ${n} (exp ${c.expected})`,
    );
  }

  console.log("\n" + "=".repeat(78));
  if (allOk) {
    console.log("ALL CHECKS PASSED");
  } else {
    console.log("ONE OR MORE CASES MISMATCHED — investigate before continuing");
    process.exit(1);
  }
}

main();
