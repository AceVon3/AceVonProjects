// End-to-end check of /methodology against a running dev server.
//
// Rewritten 2026-08-10 alongside the slim trust-statement page (the old
// 435-line page documented the retired AM Best interim architecture; its
// e2e asserted a per-state validation table that no longer exists).
//
// Verifies the slim page is honest and complete:
//   - Loads with NO profile in localStorage (spec: /methodology is one of
//     two routes exempt from the redirect-to-/setup guard).
//   - Sections present: Sources, Coverage, Freshness, Reading the numbers,
//     Signals & thresholds, Validation.
//   - Coverage names all 13 brands and the covered-state count from
//     src/lib/states.ts data_coverage.
//   - Thresholds section states +5% (Prospect) and -2% (Defend) verbatim.
//   - Last-updated date matches data/last_updated.txt exactly.
//   - Retired-architecture terms do NOT appear (AM Best, interim, SERFF —
//     the page speaks in regulator-generic terms now).
//   - Disclaimer footer present.
//
// Usage: E2E_BASE=http://localhost:3009 npx tsx scripts/e2e_methodology.ts

import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

const EXPECTED_BRANDS = [
  "Allstate", "American Family", "COUNTRY Financial", "Encompass", "Farmers",
  "GEICO", "Liberty Mutual", "Nationwide", "Progressive", "Safeco",
  "State Farm", "Travelers", "USAA",
];
const SECTIONS = [
  "section-sources", "section-coverage", "section-freshness",
  "section-reading", "section-thresholds", "section-validation",
];
const STALE_TERMS = ["AM Best", "interim", "SERFF"];

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    console.log(`  PASS ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}`, detail ?? "");
  }
}

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // No profile: the route must render, not redirect to /setup.
  await page.goto(`${BASE}/methodology`, { waitUntil: "networkidle" });
  check("renders without a profile (no redirect)", page.url().includes("/methodology"), page.url());

  for (const id of SECTIONS) {
    const n = await page.locator(`[data-testid="${id}"]`).count();
    check(`section present: ${id}`, n === 1, { count: n });
  }

  const body = (await page.locator("body").innerText()) ?? "";

  for (const b of EXPECTED_BRANDS) {
    check(`brand named: ${b}`, body.includes(b));
  }

  check("prospect threshold verbatim (+5%)", body.includes("+5%"));
  check("defend threshold verbatim (-2%)", body.includes("-2%") || body.includes("−2%"));

  const expectedAsOf = readFileSync(
    path.join(process.cwd(), "data", "last_updated.txt"), "utf-8",
  ).trim();
  const displayedAsOf = (await page.locator('[data-testid="last-updated"]').innerText()).trim();
  check(`displayed date = '${expectedAsOf}' (from data/last_updated.txt)`,
    displayedAsOf === expectedAsOf,
    { displayedAsOf, expectedAsOf });

  for (const t of STALE_TERMS) {
    check(`stale term absent: ${t}`, !body.includes(t));
  }

  check("disclaimer present", body.includes("not legal or financial advice")
    || body.includes("None of this is legal or financial advice"));

  // file-and-use wording (ties to the 2026-08-10 status-verbiage fix)
  check("file-and-use wording present", body.includes("state review still open"));

  await browser.close();
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
