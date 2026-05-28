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
    expected_defend: 8,
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
    expected_defend: 7,
  },
  {
    label: "Captive State Farm, all 8 states",
    profile: {
      agent_type: "captive",
      captive_brand: "State Farm",
      authorized_brands: ["State Farm"],
      licensed_states: ALL_8,
    } satisfies CaptiveProfile,
    expected_prospect: 41,
    expected_defend: 30,
  },
  {
    label: "Independent, AZ+NV",
    profile: {
      agent_type: "independent",
      authorized_brands: ["State Farm", "Allstate", "GEICO"], // brands don't matter for Prospect/Defend (independents see all 8)
      licensed_states: ["AZ", "NV"],
    } satisfies IndependentProfile,
    expected_prospect: 14,
    expected_defend: 10,
  },
  {
    label: "Independent, all 8 states",
    profile: {
      agent_type: "independent",
      authorized_brands: ["State Farm", "Allstate", "GEICO"],
      licensed_states: ALL_8,
    } satisfies IndependentProfile,
    expected_prospect: 49,
    expected_defend: 40,
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
    expected: 12,
  },
  {
    label: "Independent, sells SF + Travelers + Progressive, AZ+CO+NV",
    profile: {
      agent_type: "independent",
      authorized_brands: ["State Farm", "Travelers", "Progressive"],
      licensed_states: ["AZ", "CO", "NV"],
    },
    expected: 32,
  },
  {
    label: "Independent, sells Allstate + Liberty Mutual + Safeco, all 8 states",
    profile: {
      agent_type: "independent",
      authorized_brands: ["Allstate", "Liberty Mutual", "Safeco"],
      licensed_states: ALL_8,
    },
    expected: 110,
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

  // Sanity totals for the active window — spec says 180 filings.
  const active = db
    .prepare(
      `SELECT COUNT(*) AS n FROM filings
       WHERE rate_activity IN ('rate_change','rate_change_pending')
         AND effective_date >= date(?, '-12 months')`,
    )
    .get(ref) as { n: number };
  console.log(`  active-window filings (all states, all brands) = ${active.n}  (spec: 180)`);
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
