// Verifies the Sub-type rollup against the recon answer key (Feature 8).
// Node-only. Active set = active activities, 12-month, non-null effective.
//
//   293/293 active rolled filings single-valued (non-null sub_type) (2026-06-11 baseline),
//   11 distinct sub-types with these exact rolled counts:
//     PA: PPA 121, Combinations 43, Motorcycle 11, RV 8, Other 3
//     HO: Owner-Occupied 30, Combinations 49, Condo 10, Other 7, Tenant 5, Mobile 6
//
// Usage: npx tsx scripts/verify_subtype.ts

import { getDataAsOf, getDb } from "../src/lib/db";

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  [${ok ? "OK  " : "FAIL"}] ${label}: ${actual}${ok ? "" : ` (expected ${expected})`}`);
}

// Re-keyed 2026-07-11: NE/MD interim->scraped (+80 active = 1014; deltas
// exactly NE+MD). Prior 934 note:
// Re-keyed 2026-07-10 (2nd): IA/SC interim->scraped (+76 active = 934;
// deltas exactly IA+SC: PPA +25, HO-Comb +23, Auto-Comb +12, Owner-Occ +3,
// Motorcycle +4, RV +4, Other-HO +2, Mobile +2, Other +1). Prior 858 note:
// Re-keyed 2026-07-10: THE MEGA PASS — KS/NJ/MS interim->scraped (+124 active)
// + the B16 12-state correction (+22 active incl. VA Nationwide Defend) = 858.
// Prior 2026-07-09 CT baseline 712. Earlier note:
// Re-keyed 2026-07-09 when CT moved interim->scraped (+29 active = 712; per-sub_type deltas exactly CT's: PPA +13, HO-Comb +10, Auto-Comb +4, Other +1, Condo +1; distinct still 11 — CT's 5 active sub_types are a subset). Prior 2026-07-08 DE baseline 683. Earlier note:
// Re-keyed 2026-07-08 when DE moved interim->scraped (+20 active: PPA +10, HO-Comb +4, Auto-Comb +3, Motorcycle +2, Condo +1) AND the rda-gate correction added IL's rate-neutral LBPM-134651724 (HO-Comb +1) = 683. Prior 2026-07-08 SD baseline 662. Earlier note:
// Re-keyed 2026-07-08 when SD moved interim->scraped (+28 active = 662; per-sub_type deltas exactly SD's: PPA +11, HO-Comb +7, Motorcycle +3, Auto-Comb +2, Owner-Occ +2, Tenant +1, RV +1, Other +1; distinct still 11 — SD's 8 active sub_types are a subset). Prior 2026-07-08 ME baseline 634. Earlier note:
// Re-keyed 2026-07-08 when ME moved interim->scraped (+20 active = 634; per-sub_type deltas exactly ME's: PPA +8, Auto-Comb +6, HO-Comb +3, Motorcycle +2, RV +1; distinct still 11 — ME's 5 active sub_types are a subset). Prior 2026-07-07 RI baseline 614. Earlier note:
// Re-keyed 2026-07-07 when RI moved interim->scraped (+20 active = 614; per-sub_type deltas exactly RI's: PPA +11, HO-Comb +6, Condo +2, Auto-Comb +1; distinct still 11 — RI's 4 active sub_types are a subset). Prior 2026-07-07 ND baseline 594. Earlier note:
// Re-keyed 2026-07-07 when ND moved interim->scraped (+28 active = 594; per-sub_type deltas exactly ND's: PPA +10, HO-Comb +6, Other-HO +4, Auto-Comb +3, Owner-Occ +3, Motorcycle +1, Mobile +1; distinct still 11 — ND's 7 sub_types are a subset). Prior 2026-07-06 MA baseline 566. Earlier note:
// Re-keyed 2026-07-06 when MA moved interim->scraped (+15 active = 566; per-sub_type deltas exactly MA's: PPA +4, Auto-Comb +3, Motorcycle +1, RV +1, HO-Comb +6; distinct still 11 — MA's 5 sub_types are a subset). Prior 2026-07-07 B6 baseline 551. Earlier note:
// Re-keyed 2026-07-07 for the B6 shared-parser fix (comma-percent class): +1 active = 551 — exactly IL CFPC-134419708 (19.0000 Personal Auto Combinations +1, the recovered active Defend, -4.4%/334k ph); all other sub-types unchanged; distinct still 11. Prior 2026-07-05 AK baseline 550. Earlier note:
// Re-keyed 2026-07-05 when AK moved interim->scraped (+23 active = 550; per-sub_type deltas exactly AK's: PPA +9, Auto-Comb +1, Motorcycle +2, RV +2, Owner-Occ +4, HO-Comb +3, Condo +1, Other-HO +1; distinct still 11 — AK's 8 sub_types are a subset). Prior 2026-07-01 HI baseline 527. Earlier note:
// Re-keyed 2026-07-01 when HI moved interim->scraped (+17 active = 527; per-sub_type deltas exactly HI's: PPA +10, Auto-Comb +3, Motorcycle +1, HO-Comb +2, Condo +1; distinct still 11 — HI's 5 sub_types are a subset). Prior 2026-06-30 VT baseline 510. Earlier note:
// Re-keyed 2026-06-30 when VT moved interim->scraped (+15 active = 510; per-sub_type deltas exactly VT's: PPA +1, Auto-Comb +3, Motorcycle +2, RV +2, HO-Comb +5, Owner-Occ +1, Condo +1; distinct still 11 — VT's 7 sub_types are a subset). Prior 2026-06-29 NH baseline 495. Earlier note:
// Re-keyed 2026-06-24 when OH moved interim->scraped (+48 active rolled) and VA
// refreshed 277->282 (+2 active rolled): active 342 -> 392. Per-sub_type deltas
// are exactly VA's + OH's contribution; distinct sub_types still 11 (OH's are a
// subset of the existing 11). Prior 2026-06-22 baseline was 342 (VA->scraped).
const EXPECTED: Record<string, number> = {
  "19.0001 Private Passenger Auto (PPA)": 420,
  "19.0000 Personal Auto Combinations": 154,
  "19.0002 Motorcycle": 51,
  "19.0003 Recreational Vehicle (RV)": 30,
  "19.0004 Other": 10,
  "04.0003 Owner Occupied Homeowners": 71,
  "04.0000 Homeowners Sub-TOI Combinations": 223,
  "04.0001 Condominium Homeowners": 19,
  "04.0005 Other Homeowners": 14,
  "04.0004 Tenant Homeowners": 9,
  "04.0002 Mobile Homeowners": 13,
};

console.log("=".repeat(72));
console.log("VERIFY: Sub-type rollup vs recon answer key");
console.log("=".repeat(72));

const asOf = getDataAsOf();
// Scoped to source='serff_scraped': the 293/single-valued sub_type recon is a
// SCRAPED-data invariant. AM Best interim rows (source='ambest_sourced', IL only)
// are line-level with NULL sub_type by design and are checked separately.
const rows = getDb().prepare(`
  SELECT sub_type AS sub
  FROM filings
  WHERE source = 'serff_scraped'
    AND rate_activity IN ('rate_change','rate_change_pending')
    AND effective_date IS NOT NULL
    AND effective_date >= date(?, '-12 months')
`).all(asOf) as { sub: string | null }[];

console.log(`\nasOf=${asOf}, active rolled filings: ${rows.length}`);
check("active rolled filings = 1014", rows.length, 1014);
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
