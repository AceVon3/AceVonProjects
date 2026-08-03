// End-to-end check of /methodology against a running dev server.
//
// Verifies the page is honest and complete (spec §Methodology):
//   - Loads with NO profile in localStorage (spec line 540: /methodology
//     is one of two routes exempt from the redirect-to-/setup guard).
//   - Sections present: Scope, Thresholds, Excluded brands, AM Best
//     cross-check, Known limitations.
//   - Scope section names all 8 brands, all 8 covered states, Personal
//     Auto + Homeowners, 2024-2026.
//   - Thresholds section states +5% (Prospect) and -2% (Defend) verbatim.
//   - All 7 excluded brands are listed with a "why" line each.
//   - Validation table has 47 rows (one per directly-scraped state) and the cell
//     values match STATES.validated exactly. Spot-checks: AZ auto=✓
//     home=✓, MT auto=✓ home=✓, WA auto=✓ home=—, CO auto=— home=—.
//   - Known limitations section covers SERFF visibility gaps, CO
//     unvalidated, 40 states not covered, no-future-filings note.
//   - Last-updated date is read from data/last_updated.txt and matches
//     2026-05-27 (the xlsx mtime that step-3 anchored the window to).
//
// Usage: E2E_BASE=http://localhost:3009 npx tsx scripts/e2e_methodology.ts

import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

const EXPECTED_BRANDS = [
  "Allstate", "Encompass", "GEICO", "Liberty Mutual",
  "Progressive", "Safeco", "State Farm", "Travelers",
];
const EXPECTED_STATES = ["AZ", "CO", "ID", "MT", "NV", "OR", "UT", "WA"];
// Only the brands with a defensible rationale are asserted on the
// page. Drive, Esurance, and National General are NOT in the list —
// they're excluded silently by the import script's fail-loudly-on-
// unmatched-company_name gate (zero current rows match those names,
// and derive_brand() returns None for synthetic strings, so any future
// SERFF refresh that introduced them would halt the import rather than
// silently mis-bucketing).
const EXPECTED_EXCLUDED = [
  "LM General", "Standard Fire", "American Economy", "Peerless",
];
const SHOULD_NOT_APPEAR = ["Drive", "Esurance", "National General"];
// Pulled from src/lib/states.ts (the spec's STATES.validated field). The
// page must reflect THIS exactly — drift between the data and the page
// here would silently mislead a skeptical agent.
const EXPECTED_VALIDATION: Record<string, { auto: boolean; home: boolean }> = {
  AZ: { auto: true,  home: true  },
  CO: { auto: false, home: false },
  IL: { auto: true,  home: true  }, // scraped 2026-06-25 (interim->real); AM Best cross-check PPA 93.8% / HO 95.2% / 155-of-156 interim agreement -> both validated
  ID: { auto: true,  home: false },
  MT: { auto: true,  home: true  },
  NV: { auto: true,  home: false },
  OH: { auto: true,  home: true  }, // scraped 2026-06-24; AM Best cross-check 2026-06-25 PPA 96.1% / HO 97.1% / 105-of-105 interim agreement -> both validated
  OR: { auto: true,  home: false },
  UT: { auto: true,  home: false },
  VA: { auto: true,  home: true  }, // scraped 2026-06-22; PPA 92.3%, HO values cross-checked (68.6% is AM Best-only coverage, not value errors)
  WA: { auto: true,  home: false },
  WV: { auto: true,  home: true  }, // scraped 2026-06-26 (interim->real); AM Best cross-check PPA 30/33 (90.9%) / HO 9/10 (90%, 9/9 in-window) / 37-of-40 interim agreement (3 diffs all AM-Best-side) -> both validated
  NH: { auto: true,  home: true  }, // scraped 2026-06-29 (interim->real); AM Best cross-check in-window PPA 22/22 (100%) / HO 14/14 (100%) / 33-of-33 interim agreement (0 disagreements) -> both validated
  VT: { auto: true,  home: true  }, // scraped 2026-06-30 (interim->real); AM Best cross-check PPA material in-window 42/42 (100%) / HO 16/17 (94.1%) / 37-of-37 interim agreement (0 disagreements, 0 soft-misses) -> both validated
  HI: { auto: true,  home: true  }, // scraped 2026-07-01 (interim->real); AM Best cross-check CLEANEST YET: PPA 44/44 (100%) / HO 7/7 (100%) / 41-of-41 interim agreement (0 disagreements, 0 soft-misses, 0 recoveries); AmFam pre-resolved -> both validated
  AK: { auto: true,  home: true  }, // scraped 2026-07-05 (interim->real); coverage-thin AM Best: value-agreement on shared 41/41 (100%), interim 41/41 (0 disagreements), PPA in-window 34/34 / HO 13/13 (100%); scrape far richer (Country 16x undercounted, Farmers+Liberty AM-Best-missing); recovered 2 material COUNTRY CFPC (incl. +9.6%/9,644ph Prospect) -> both validated
  MA: { auto: true,  home: true  }, // scraped 2026-07-06 (interim->real); AM Best cross-check PPA 37/38 (97.4%, 1 recency) / HO 27/27 (100% — first robust-N home) / value-agreement 53/53 (100%) / interim 49/49 (0 disagreements) -> both validated
  ND: { auto: true,  home: true  }, // scraped 2026-07-07 (interim->real); AM Best cross-check (10th point): value-agreement 44/44 (100%) / interim 45/45 (0 disagreements) / in-window PPA 35/35 + HO 20/20 (100%); B9 bare-"farmers" mislabel surfaced+fixed in the same import -> both validated
  RI: { auto: true,  home: true  }, // scraped 2026-07-07 (interim->real); AM Best cross-check (11th point): adjudicated in-window PPA 100% / HO 100% (robust-N 25, coastal); value-agreement 41/42 + interim 40/41 (the 1 differ each = AM Best's own entity transposition, ours source-true); coverage RICHNESS-ONLY x4 -> both validated
  ME: { auto: true,  home: true  }, // scraped 2026-07-08 (interim->real); AM Best cross-check (12th point, cleanest yet): value-agreement 48/48 (100%, first perfect) / interim 46/46 (0 disagreements); adjudicated in-window PPA 45/45 + HO 18/18; isolation-boundary verdict ND/RI-COMPLETE (Nationwide/Travelers watch-points = form/rule richness) -> both validated
  SD: { auto: true,  home: true  }, // scraped 2026-07-08 (interim->real); AM Best cross-check (13th point): adjudicated in-window 100%/100% (HO ROBUST-N 31, hail country); value-agreement 67/67 adjudicated; THE AK-TEST STATE — Country's plains footprint, 0 personal-lines rate filings, AM Best 0 correct -> AK = lone thin case -> both validated
  DE: { auto: true,  home: true  }, // scraped 2026-07-08 (interim->real); the state that surfaced the 3rd silent-drop class (None-vs-False rda gate), fixed pre-ship; post-fix cross-check (14th point): value-agreement 64/64 (100%) / interim 57/57 / PPA 98.3%, adjudicated in-window 100%/100% -> both validated
  AR: { auto: true,  home: true  }, // scraped 2026-07-11; both AR clusters = AM-Best-side transpositions, ours source-true
  KY: { auto: true,  home: true  }, // scraped 2026-07-12; value-agreement 134/135, 0 flags
  WI: { auto: true,  home: true  }, // scraped 2026-07-13; value-agreement 109/109 (7th perfect)
  OK: { auto: true,  home: true  }, // scraped 2026-07-11; value-agreement 101/101 after the B18 recovery (Safeco +8.0% correspondence-FP)
  NE: { auto: true,  home: true  }, // scraped 2026-07-10; cleanest cross-check yet — value-agreement 83/83, 0 flags
  MD: { auto: true,  home: true  }, // scraped 2026-07-11; biggest state (546 targets); value-agreement 69/69, 0 flags
  IA: { auto: true,  home: true  }, // scraped 2026-07-10 (interim->real); value-agreement 107/108 (99.1%); the -158.0% differ = AM-Best-side impossible value, ours source-true
  SC: { auto: true,  home: true  }, // scraped 2026-07-10 (interim->real); value-agreement 56/58 (96.6%); enrichment x2 AM Best lacks incl. a live GEICO Defend
  KS: { auto: true,  home: true  }, // scraped 2026-07-09 (interim->real); value-agreement 68/68 (100%); COUNTRY richness-only — AK-thinness does not reproduce
  NJ: { auto: true,  home: true  }, // scraped 2026-07-10 (interim->real); the state that surfaced B16 (Prior-Approval vocabularies); value-agreement 65/66 (98.5%)
  MS: { auto: true,  home: true  }, // scraped 2026-07-10 (interim->real); value-agreement 84/84 (100%, 3rd perfect); 2 SERFF-invisible watch clusters documented
  IN: { auto: true,  home: true  }, // scraped 2026-07-16 (39th state); value-agreement 130/130 (100%); 0 material soft-misses (8 AM-Best-only all 0.0%/recency); RICHNESS-ONLY x4; Consolidated Ins Co excluded (Peerless doctrine)
  MO: { auto: true,  home: true  }, // scraped 2026-07-21 (40th state); value-agreement 149/149 (100%); 1 flagged soft-miss adjudicated AM Best double-list artifact (TIE PPA phantom); zero-row audit 6/6 zero-value (3 Encompass MO market-exit notices); RICHNESS-ONLY x4
  MN: { auto: true,  home: true  }, // scraped 2026-07-22 (41st state); value-agreement 126/126 (100%); Illinois Farmers +2.7%/34,169ph RECOVERED pre-import (prefix-anchored search gap, WV-Liberty fix family); 1 ours-correct impact disagreement; 1 SERFF-visibility watch item (Allstate NA)
  TN: { auto: true,  home: true  }, // scraped 2026-07-22 (42nd state — chain complete); value-agreement 139/141 (98.6%), both disagreements ours-correct from PDFs (incl. the REAL Encompass umbrella +110.9%); TN DOI actuarial-memo debris class fixed (19 rows, 3 filings); Mountain Laurel -> Progressive (TN-first)
  AL: { auto: false, home: false }, // scraped 2026-07-27 (43rd state, gap-batch): 45-row PARTIAL import, CO-style no-cross-check (no AM Best AL CSV). AL DOI doesn't mandate the rate-data dialog — 85 Rate filings are prose-only; prose extraction + fresh AM Best pull pending
  LA: { auto: false, home: false }, // scraped 2026-07-27 (44th state): 156 rows, CO-style no-cross-check (no AM Best LA CSV); zero-row flags adjudicated zero-effect
  TX: { auto: true,  home: true  }, // scraped 2026-07-30 (45th state — permanent-doctrine unwind, TX was never non-SERFF): 510 rows incl +81 B20 recoveries; value-agreement 201/201 (100%), PPA 123/128 / HO 87/87; TDI open-data census audit ZERO absent; Colonial County Mutual -> Nationwide (TX-first)
  NY: { auto: true,  home: true  }, // scraped 2026-07-30 (46th state — doctrine unwind complete, CA-only permanent): 225 rows (223 + 2 prose); value-agreement 71/73 (97.3%, both differs ours-correct from PDFs — AM Best stale-stage zeroing); PPA 67/69 / HO 29/29; Farmington+Charter Oak -> Travelers; Country-Wide excluded (Countryway class live)
  CA: { auto: true,  home: true  }, // scraped 2026-08-03 (47th state — the LAST ex-"permanent" state, probe-to-import in one day; AMBEST now EMPTY): 96 rows incl 11 B22 disposition-letter recoveries + 1 cdi_supplement; TRIPLE cross-check: AM Best value-agreement 26/26 (100%), CDI approved-% closed-lists arbitration (prior-approval: LBPM filed 41.6 -> approved 31.5 override), CDI reverse census fully adjudicated; Crestbrook -> Nationwide (CA-first)
  CT: { auto: true,  home: true  }, // scraped 2026-07-09 (interim->real); the state that surfaced B14 (the "Flex Rate" filing-type vocabulary, 4th variant) — live GEICO/Progressive PPA signals recovered pre-ship, 25-state retro-sweep 0 exposure; post-fix cross-check (15th point): value-agreement 55/56 (98.2%, the 1 differ = AM Best zeroing a REJECTED filing) / PPA 43/54 / HO 25/33 (AM-Best-only = recency/immaterial/1 new-product), 0 genuine soft-misses -> both validated
};

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("=".repeat(72));
  console.log(`E2E: /methodology against ${BASE}`);
  console.log("=".repeat(72));

  // -- (1) loads with no profile (no redirect) ------------------------------
  console.log("\n(1) /methodology loads with empty localStorage (no redirect)");
  // Clear localStorage by visiting /setup first (it's the one route that
  // never redirects), wiping, then going to /methodology.
  await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(`${BASE}/methodology`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="page-title"]', { timeout: 5000 });
  check("URL stays on /methodology (no redirect)",
    new URL(page.url()).pathname === "/methodology",
    { url: page.url() });
  const heading = (await page.locator('[data-testid="page-title"]').textContent())?.trim();
  check("page heading = 'Methodology'", heading === "Methodology", { heading });

  // -- (2) last-updated date matches data/last_updated.txt -----------------
  console.log("\n(2) last-updated date reads from data/last_updated.txt");
  const expectedAsOf = readFileSync(
    path.join(process.cwd(), "data", "last_updated.txt"),
    "utf-8",
  ).trim();
  const displayedAsOf = (await page.locator('[data-testid="last-updated"]').textContent())?.trim();
  check(`displayed date = '${expectedAsOf}' (from data/last_updated.txt)`,
    displayedAsOf === expectedAsOf,
    { displayedAsOf, expectedAsOf });

  // -- (3) sections present ------------------------------------------------
  console.log("\n(3) all required sections present");
  for (const id of [
    "section-scope", "section-thresholds", "section-excluded",
    "section-validation", "section-limitations",
  ]) {
    const count = await page.locator(`[data-testid="${id}"]`).count();
    check(`section "${id}" present`, count === 1, { id, count });
  }

  // -- (4) scope content ---------------------------------------------------
  console.log("\n(4) scope section names brands, states, lines, dates");
  const scopeText = (await page.locator('[data-testid="section-scope"]').textContent()) ?? "";
  for (const brand of EXPECTED_BRANDS) {
    check(`scope mentions brand "${brand}"`, scopeText.includes(brand));
  }
  for (const state of EXPECTED_STATES) {
    check(`scope mentions state code ${state}`, scopeText.includes(state));
  }
  check("scope mentions 'Personal Auto'", scopeText.includes("Personal Auto"));
  check("scope mentions 'Homeowners'", scopeText.includes("Homeowners"));
  check("scope mentions effective-date range 2024-2026", /2024.{0,3}2026/.test(scopeText));

  // -- (5) thresholds verbatim ----------------------------------------------
  console.log("\n(5) thresholds section states +5% and -2% verbatim");
  const thresholdText = (await page.locator('[data-testid="section-thresholds"]').textContent()) ?? "";
  check("threshold +5% present", /\+\s*5\s*%/.test(thresholdText));
  check("threshold -2% present (either - or unicode minus)",
    /[−-]\s*2\s*%/.test(thresholdText));
  check("'Raising' and 'Prospect' both mentioned in threshold section",
    /Raising/.test(thresholdText) && /Prospect/.test(thresholdText));
  check("'Lowering' and 'Defend' both mentioned in threshold section",
    /Lowering/.test(thresholdText) && /Defend/.test(thresholdText));

  // -- (6) excluded brands -------------------------------------------------
  console.log("\n(6) excluded brands — only the 4 with defensible rationales");
  const excludedItems = await page.$$eval(
    '[data-testid="excluded-list"] li',
    els => els.map(e => e.textContent?.trim() ?? ""),
  );
  check(`excluded list has ${EXPECTED_EXCLUDED.length} entries (got ${excludedItems.length})`,
    excludedItems.length === EXPECTED_EXCLUDED.length);
  for (const brand of EXPECTED_EXCLUDED) {
    const item = excludedItems.find(t => t.startsWith(brand));
    check(`"${brand}" present with a why line`,
      !!item && item.length > brand.length + 5,
      { brand, item: item?.slice(0, 80) });
  }
  // Confirm the page doesn't assert rationales for entities we can't
  // stand behind — they should be excluded silently by the import gate,
  // not listed with a made-up justification.
  for (const brand of SHOULD_NOT_APPEAR) {
    const excludedSection = (await page.locator('[data-testid="section-excluded"]').textContent()) ?? "";
    check(`"${brand}" is NOT listed on the Methodology page`,
      !excludedSection.includes(brand));
  }

  // -- (7) AM Best validation table matches STATES.validated ---------------
  console.log("\n(7) validation table matches STATES.validated exactly");
  const rowCount = await page.locator('[data-testid="validation-row"]').count();
  check(`validation table has 47 rows (got ${rowCount})`, rowCount === 47);
  for (const [code, expected] of Object.entries(EXPECTED_VALIDATION)) {
    const row = page.locator(`[data-testid="validation-row"][data-state="${code}"]`);
    const autoCell = (await row.locator('[data-testid="cell-auto"]').textContent())?.trim();
    const homeCell = (await row.locator('[data-testid="cell-home"]').textContent())?.trim();
    const autoMark = expected.auto ? "✓" : "—";
    const homeMark = expected.home ? "✓" : "—";
    check(`${code} auto = "${autoMark}"`, autoCell === autoMark, { code, autoCell, expected: autoMark });
    check(`${code} home = "${homeMark}"`, homeCell === homeMark, { code, homeCell, expected: homeMark });
  }

  // -- (8) known limitations -----------------------------------------------
  console.log("\n(8) known limitations covers SERFF gaps, CO, 42 states, no-future");
  const limitsText = (await page.locator('[data-testid="section-limitations"]').textContent()) ?? "";
  check("limitations mention SERFF visibility gaps", /SERFF visibility gaps/i.test(limitsText));
  check("limitations mention '10' to '12' missing filings",
    /10.{0,3}12/.test(limitsText));
  check("limitations call out Colorado as unvalidated",
    /Colorado/.test(limitsText) && /validat/i.test(limitsText));
  // 5 not covered = 50 − 45 covered (24 directly scraped incl. VA/OH/IL/WV/NH/VT/HI/AK/MA/ND/RI/ME/SD/DE + 21 AM Best).
  // The uncovered 5: AL/FL/LA (header-only re-pull), NC (structural NCRB gap), WY
  // (no filings). The validation table is 44 rows (one per directly-scraped state;
  // CO shows "— —" — scraped but not yet AM Best cross-checked (OH cross-checked
  // 2026-06-25 -> now ✓✓); AM Best states, interim AND permanent, are not in the
  // table at all).
  // 5->4 at the AL import (2026-07-27): AL flipped data_coverage true, leaving
  // FL/LA/NC/WY uncovered (LA + NC flip at their imports; FL unprobed; WY empty).
  // 4->3 at the LA import (2026-07-27): FL/NC/WY remain (NC flips at its import).
  check("limitations mention '3 states not yet covered'",
    /3 states not yet covered/i.test(limitsText));
  check("limitations include the no-future-dated-filings note",
    /no future-dated filings/i.test(limitsText) || /no future filings/i.test(limitsText));

  await browser.close();

  console.log("\n" + "=".repeat(72));
  if (failures === 0) {
    console.log("E2E ALL CHECKS PASSED");
  } else {
    console.log(`E2E FAILURES: ${failures}`);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
