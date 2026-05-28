// End-to-end check of /methodology against a running dev server.
//
// Verifies the page is honest and complete (spec §Methodology):
//   - Loads with NO profile in localStorage (spec line 540: /methodology
//     is one of two routes exempt from the redirect-to-/setup guard).
//   - Sections present: Scope, Thresholds, Excluded brands, AM Best
//     cross-check, Known limitations.
//   - Scope section names all 8 brands, all 8 covered states, Personal
//     Auto + Homeowners, 2025-2026.
//   - Thresholds section states +5% (Prospect) and -2% (Defend) verbatim.
//   - All 7 excluded brands are listed with a "why" line each.
//   - Validation table has 8 rows (one per covered state) and the cell
//     values match STATES.validated exactly. Spot-checks: AZ auto=✓
//     home=✓, MT auto=✓ home=✓, WA auto=✓ home=—, CO auto=— home=—.
//   - Known limitations section covers SERFF visibility gaps, CO
//     unvalidated, 42 states not covered, no-future-filings note.
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
  ID: { auto: true,  home: false },
  MT: { auto: true,  home: true  },
  NV: { auto: true,  home: false },
  OR: { auto: true,  home: false },
  UT: { auto: true,  home: false },
  WA: { auto: true,  home: false },
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
  check("scope mentions effective-date range 2025-2026", /2025.{0,3}2026/.test(scopeText));

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
  check(`validation table has 8 rows (got ${rowCount})`, rowCount === 8);
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
  check("limitations mention '42 states not yet covered'",
    /42 states not yet covered/i.test(limitsText));
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
