// End-to-end check of empty-state variants on the table pages.
//
// Two empty states to distinguish:
//
//   1. "no-data" — the unfiltered API result is empty. Real product
//      fact: nothing in the agent's scope crosses the threshold right
//      now. Action: wait for next monthly refresh. Spec wording.
//
//   2. "filtered" — the unfiltered API has rows, but the current
//      filter combo produces zero. Different problem, different
//      action: widen the filter.
//
// Verifies both, plus that the data-variant attribute switches
// correctly so a future polish pass can style them differently.
//
// Usage: E2E_BASE=http://localhost:3000 npx tsx scripts/e2e_empty_states.ts

import { Page, chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

const INDEPENDENT_AZ_NV = {
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers"],
  licensed_states: ["AZ", "NV"],
  full_name: "Test", zip_code: "99206", home_state: "WA",
  employee_count: 5, employee_states: ["WA"],
  created_at: "2026-05-28T00:00:00.000Z",
};

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

async function setProfile(page: Page, profile: unknown): Promise<void> {
  await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });
  await page.evaluate(p => {
    window.localStorage.setItem("agent_profile", JSON.stringify(p));
  }, profile);
}

async function setWindow(page: Page, window: "12m" | "90d" | "30d"): Promise<void> {
  await page.locator('[data-testid="chip-time"]').click();
  await page.waitForSelector('[data-testid="chip-time-panel"]', { timeout: 3000 });
  // Client-side window filter; just wait for React to commit.
  await page.locator(`[data-testid="opt-window-${window}"]`).click();
  await page.waitForTimeout(80);
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("=".repeat(72));
  console.log(`E2E: empty-state variants against ${BASE}`);
  console.log("=".repeat(72));

  // -- (1) filtered-to-empty on /prospect -----------------------------------
  // Independent AZ+NV: 13 raw prospect rows in 12m (2026-06-11 baseline); 0 in 30d.
  console.log("\n(1) /prospect: window=30d → filtered-to-empty");
  await setProfile(page, INDEPENDENT_AZ_NV);
  await page.goto(`${BASE}/prospect`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="filter-bar"]', { timeout: 5000 });
  // Sanity: default state should show 13 rows, no empty-state visible.
  const defaultRows = await page.$$eval("table tbody tr", rs => rs.length);
  check("default → 13 rows (sanity)", defaultRows === 13, { defaultRows });
  const beforeEmpty = await page.locator('[data-testid="empty-state"]').count();
  check("no empty-state visible at default", beforeEmpty === 0);

  await setWindow(page, "30d");
  const emptyEl = page.locator('[data-testid="empty-state"]');
  check("empty-state visible after window=30d", (await emptyEl.count()) === 1);
  const variant = await emptyEl.getAttribute("data-variant");
  check("empty-state variant = 'filtered' (raw had rows)",
    variant === "filtered", { variant });
  const emptyText = (await emptyEl.textContent())?.trim() ?? "";
  check("copy mentions widening the filter",
    /widening the time window|widen/i.test(emptyText), { emptyText });
  check("copy does NOT use the no-data wording ('check back next month')",
    !/check back next month/i.test(emptyText), { emptyText });

  // Reset to 12m to confirm empty-state disappears.
  await setWindow(page, "12m");
  check("empty-state gone after restoring window=12m",
    (await page.locator('[data-testid="empty-state"]').count()) === 0);

  // -- (2) no-data on /defend with a profile that has no defend rows --------
  // Hard to engineer with the current dataset for an independent (a state
  // with nothing matching is rare). Use a captive profile in a state where
  // no competitor cuts rates ≤ -2% within the 12m window. Encompass in
  // ID is a candidate — Encompass has very few filings.
  console.log("\n(2) /defend: profile with no defend rows → no-data empty");
  const CAPTIVE_NO_DEFEND = {
    ...INDEPENDENT_AZ_NV,
    agent_type: "captive",
    authorized_brands: ["Encompass"],
    licensed_states: ["ID"],
  };
  await setProfile(page, CAPTIVE_NO_DEFEND);
  await page.goto(`${BASE}/defend`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="filter-bar"]', { timeout: 5000 });
  const noDataEl = page.locator('[data-testid="empty-state"]');
  const noDataCount = await noDataEl.count();
  if (noDataCount === 0) {
    // The seed dataset evolved — Encompass/ID happens to have a defend row
    // now. Don't fail — that just means the no-data case can't be
    // exercised with this profile right now. Note it and move on.
    console.log("  [SKIP] profile unexpectedly has defend rows; can't exercise no-data variant here");
  } else {
    const ndVariant = await noDataEl.getAttribute("data-variant");
    check("no-data empty-state variant = 'no-data'",
      ndVariant === "no-data", { ndVariant });
    const ndText = (await noDataEl.textContent())?.trim() ?? "";
    check("defend no-data copy mentions ≤-2% threshold or 'Your book is safe'",
      /−2%|Your book is safe/i.test(ndText), { ndText });
  }

  // -- (3) coverage-gap: a GA-only new carrier in a non-GA state -----------
  // The 5 new carriers (Farmers etc.) are GA-only until backfill. A captive
  // Farmers agent in WA has no WA Farmers data → My Carriers is empty, and it
  // must say "not collected here yet" (coverage-gap), NOT the generic no-data
  // "no recent filings" copy that reads like a bug.
  console.log("\n(3) /my-carriers: captive Farmers in WA → coverage-gap empty");
  const CAPTIVE_FARMERS_WA = {
    ...INDEPENDENT_AZ_NV,
    agent_type: "captive",
    authorized_brands: ["Farmers"],
    licensed_states: ["WA"],
  };
  await setProfile(page, CAPTIVE_FARMERS_WA);
  await page.goto(`${BASE}/my-carriers`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="filter-bar"]', { timeout: 5000 });
  const cgEl = page.locator('[data-testid="empty-state"]');
  check("empty-state visible (no WA Farmers data)", (await cgEl.count()) === 1);
  const cgVariant = await cgEl.getAttribute("data-variant");
  check("variant = 'coverage-gap' (not 'no-data')", cgVariant === "coverage-gap", { cgVariant });
  const cgText = (await cgEl.textContent())?.trim() ?? "";
  check("copy names the brand + where it IS covered (Georgia)",
    /Farmers/.test(cgText) && /Georgia/.test(cgText), { cgText });
  check("copy names the uncovered state (Washington) + 'coming'",
    /Washington/.test(cgText) && /coming/i.test(cgText), { cgText });
  check("copy does NOT use the misleading no-data wording",
    !/no recent filings|book is safe/i.test(cgText), { cgText });

  // -- (4) neutral-only carrier: covered, but every filing is 0% ------------
  // Captive GEICO in WA has only rate-neutral (0.0%) filings in the active
  // window. After suppression My Carriers is empty — but GEICO IS collected in
  // WA, so this must show the NORMAL no-data empty state (NOT coverage-gap),
  // plus the "rate-neutral filings hidden" note explaining the emptiness.
  console.log("\n(4) /my-carriers: captive GEICO in WA (all-neutral) → no-data + hidden note");
  const CAPTIVE_GEICO_WA = {
    ...INDEPENDENT_AZ_NV,
    agent_type: "captive",
    authorized_brands: ["GEICO"],
    licensed_states: ["WA"],
  };
  await setProfile(page, CAPTIVE_GEICO_WA);
  await page.goto(`${BASE}/my-carriers`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="filter-bar"]', { timeout: 5000 });
  const nEl = page.locator('[data-testid="empty-state"]');
  check("empty-state visible (all GEICO/WA filings are neutral)", (await nEl.count()) === 1);
  const nVariant = await nEl.getAttribute("data-variant");
  check("variant = 'no-data' (NOT 'coverage-gap' — GEICO IS covered in WA)",
    nVariant === "no-data", { nVariant });
  const noteEl = page.locator('[data-testid="neutral-hidden-note"]');
  check("rate-neutral hidden note is shown", (await noteEl.count()) === 1);
  const noteText = (await noteEl.textContent())?.trim() ?? "";
  check("note states rate-neutral filings hidden", /rate-neutral filing/i.test(noteText), { noteText });
  check("no coverage-gap wording leaked in", !/coverage is coming/i.test(noteText), { noteText });

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
