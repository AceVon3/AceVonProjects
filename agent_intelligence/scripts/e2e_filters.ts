// End-to-end check of the table-page filters across /prospect, /defend,
// and /my-carriers. Spec rules:
//
//   - Each page owns filter state (React state, not localStorage).
//   - Filters reset to default when the user navigates away and back.
//   - Defaults: state = all licensed; line = both; window = 12m;
//     sort = effective_desc; (my-carriers) carrier = all authorized.
//   - Time window anchors to data freshness (asOf), not wall clock.
//   - Server refetches when window changes; state/line/carrier/sort
//     apply client-side without a network round-trip.
//
// Expected numbers for Independent in AZ+NV (asOf 2026-05-27):
//
//   /prospect    default      = 14    AZ-only = 4    HO-only = 6
//                window 90d   = 3     window 30d = 0
//                sort impact  → GEICO +50.9% first
//   /defend      default      = 10    window 90d = 2  window 30d = 0
//   /my-carriers SF+Travelers default = 12  (SF=8, Travelers=4)
//                Carrier filter → SF only = 8 rows
//                window 90d = 1   window 30d = 0
//
// Usage: E2E_BASE=http://localhost:3100 npx tsx scripts/e2e_filters.ts

import { Page, chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

const PROFILE_BASE = {
  full_name: "Test", zip_code: "99206", home_state: "WA",
  employee_count: 5, employee_states: ["WA"],
  created_at: "2026-05-28T00:00:00.000Z",
};

const INDEPENDENT_AZ_NV = {
  ...PROFILE_BASE,
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers"],
  licensed_states: ["AZ", "NV"],
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

async function gotoTable(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  // Wait for either table rows or empty-state.
  await page.waitForSelector('[data-testid="filter-bar"]', { timeout: 5000 });
}

async function rowCount(page: Page): Promise<number> {
  return page.$$eval("table tbody tr", rs => rs.length);
}

async function openChip(page: Page, testid: string): Promise<void> {
  await page.locator(`[data-testid="${testid}"]`).click();
  await page.waitForSelector(`[data-testid="${testid}-panel"]`, { timeout: 3000 });
}

async function setOnlyStates(page: Page, ...states: string[]): Promise<void> {
  await openChip(page, "chip-states");
  // The checkbox panel has data-testid="opt-state-<code>" with data-checked
  const optionLocator = page.locator('[data-testid^="opt-state-"]');
  const all = await optionLocator.evaluateAll(els =>
    els.map(e => ({
      code: (e.getAttribute("data-testid") ?? "").replace("opt-state-", ""),
      checked: e.getAttribute("data-checked") === "true",
    })),
  );
  const want = new Set(states);
  for (const opt of all) {
    const shouldBeChecked = want.has(opt.code);
    if (opt.checked !== shouldBeChecked) {
      await page.locator(`[data-testid="opt-state-${opt.code}"]`).click();
    }
  }
  // Close the panel by clicking the chip again.
  await page.locator('[data-testid="chip-states"]').click();
}

async function setOnlyLines(page: Page, ...lines: string[]): Promise<void> {
  await openChip(page, "chip-lines");
  const all = await page.locator('[data-testid^="opt-line-"]').evaluateAll(els =>
    els.map(e => ({
      line: (e.getAttribute("data-testid") ?? "").replace("opt-line-", ""),
      checked: e.getAttribute("data-checked") === "true",
    })),
  );
  const want = new Set(lines);
  for (const opt of all) {
    const shouldBeChecked = want.has(opt.line);
    if (opt.checked !== shouldBeChecked) {
      await page.locator(`[data-testid="opt-line-${opt.line}"]`).click();
    }
  }
  await page.locator('[data-testid="chip-lines"]').click();
}

async function setWindow(page: Page, window: "12m" | "90d" | "30d"): Promise<void> {
  await openChip(page, "chip-time");
  // Window changes are now client-side (the page fetches the broadest
  // 12m set once and narrows in-memory via applyFilters). No fetch to
  // wait for — just give React one commit tick to re-render.
  await page.locator(`[data-testid="opt-window-${window}"]`).click();
  await page.waitForTimeout(80);
}

async function setSort(page: Page, sort: "effective_desc" | "impact_desc"): Promise<void> {
  await openChip(page, "chip-sort");
  await page.locator(`[data-testid="opt-sort-${sort}"]`).click();
  // Sort is client-side, no fetch; one tick to let React commit.
  await page.waitForTimeout(50);
}

async function setOnlyCarriers(page: Page, ...carriers: string[]): Promise<void> {
  await openChip(page, "chip-carriers");
  const all = await page.locator('[data-testid^="opt-carrier-"]').evaluateAll(els =>
    els.map(e => ({
      carrier: (e.getAttribute("data-testid") ?? "").replace("opt-carrier-", ""),
      checked: e.getAttribute("data-checked") === "true",
    })),
  );
  const want = new Set(carriers);
  for (const opt of all) {
    const shouldBeChecked = want.has(opt.carrier);
    if (opt.checked !== shouldBeChecked) {
      await page.locator(`[data-testid="opt-carrier-${opt.carrier}"]`).click();
    }
  }
  await page.locator('[data-testid="chip-carriers"]').click();
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("=".repeat(72));
  console.log(`E2E: filters against ${BASE}`);
  console.log("=".repeat(72));

  // -- /prospect, Independent AZ+NV ---------------------------------------
  console.log("\n/prospect — Independent AZ+NV");
  await setProfile(page, INDEPENDENT_AZ_NV);
  await gotoTable(page, "/prospect");
  check("default → 14 rows", (await rowCount(page)) === 14);
  check("default header count = 14",
    (await page.locator('[data-testid="header-count"]').textContent())?.trim() === "14");

  console.log("\n  Narrow states → AZ only");
  await setOnlyStates(page, "AZ");
  check("AZ-only → 4 rows", (await rowCount(page)) === 4);
  // Confirm every visible row's state cell = AZ.
  const stateCells = await page.$$eval("table tbody tr td:nth-child(2)", tds =>
    tds.map(t => t.textContent?.trim() ?? ""));
  check("every visible row is in AZ",
    stateCells.length > 0 && stateCells.every(s => s === "AZ"),
    { stateCells });

  console.log("\n  Restore states → AZ + NV");
  await setOnlyStates(page, "AZ", "NV");
  check("restored → 14 rows", (await rowCount(page)) === 14);

  console.log("\n  Narrow lines → Homeowners only");
  await setOnlyLines(page, "Homeowners");
  check("HO-only → 6 rows", (await rowCount(page)) === 6);
  const lineCells = await page.$$eval("table tbody tr td:nth-child(3)", tds =>
    tds.map(t => t.textContent?.trim() ?? ""));
  check("every visible row is Homeowners",
    lineCells.length > 0 && lineCells.every(s => s === "Homeowners"));

  console.log("\n  Restore lines → both");
  await setOnlyLines(page, "Personal Auto", "Homeowners");
  check("restored → 14 rows", (await rowCount(page)) === 14);

  console.log("\n  Window 30d (anchored to asOf 2026-05-27)");
  await setWindow(page, "30d");
  let n = await rowCount(page);
  check("30d → 0 rows (dataset has nothing within 30 days of asOf)", n === 0, { n });

  console.log("\n  Window 90d");
  await setWindow(page, "90d");
  n = await rowCount(page);
  check("90d → 3 rows", n === 3, { n });

  console.log("\n  Window 12m");
  await setWindow(page, "12m");
  n = await rowCount(page);
  check("12m → 14 rows", n === 14, { n });

  console.log("\n  Sort → rate impact (largest)");
  await setSort(page, "impact_desc");
  const firstBrand = await page.locator("table tbody tr td:first-child").first().textContent();
  const firstImpact = await page.locator("table tbody tr td:nth-child(4)").first().textContent();
  check("first row brand = GEICO",
    firstBrand?.replace(/Mine$/, "").trim() === "GEICO", { firstBrand });
  check("first row impact = +50.9%",
    !!firstImpact && /\+50\.9%/.test(firstImpact), { firstImpact });

  // -- Filter persistence: nav away + back resets to default --------------
  console.log("\n  Persistence: nav to / and back → filters reset");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="ov-cards"]', { timeout: 5000 });
  await page.goto(`${BASE}/prospect`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="filter-bar"]', { timeout: 5000 });
  check("after nav-away-and-back → 14 rows (default)", (await rowCount(page)) === 14);
  const sortChipLabel = await page.locator('[data-testid="chip-sort"]').textContent();
  check("sort chip back to 'Effective (newest)'",
    !!sortChipLabel && /Effective \(newest\)/.test(sortChipLabel), { sortChipLabel });
  const stateChipLabel = await page.locator('[data-testid="chip-states"]').textContent();
  check("state chip back to 'All 2 states' default",
    !!stateChipLabel && /All 2 states/.test(stateChipLabel), { stateChipLabel });

  // -- /defend, Independent AZ+NV ------------------------------------------
  console.log("\n/defend — Independent AZ+NV");
  await gotoTable(page, "/defend");
  check("default → 10 rows", (await rowCount(page)) === 10);

  await setWindow(page, "90d");
  let dn = await rowCount(page);
  check("/defend 90d → 2 rows", dn === 2, { dn });
  await setWindow(page, "30d");
  dn = await rowCount(page);
  check("/defend 30d → 0 rows", dn === 0, { dn });
  await setWindow(page, "12m");

  // -- /my-carriers, Independent SF+Travelers AZ+NV ------------------------
  console.log("\n/my-carriers — Independent SF+Travelers AZ+NV");
  await gotoTable(page, "/my-carriers");
  check("default → 12 rows", (await rowCount(page)) === 12);

  console.log("\n  Carrier filter → State Farm only");
  await setOnlyCarriers(page, "State Farm");
  check("SF-only → 8 rows", (await rowCount(page)) === 8);
  const brandCells = await page.$$eval("table tbody tr td:first-child", tds =>
    tds.map(t => t.textContent?.trim() ?? ""));
  check("every row's carrier is State Farm",
    brandCells.length > 0 && brandCells.every(b => b === "State Farm"),
    { brandCells });

  await setOnlyCarriers(page, "State Farm", "Travelers");
  check("restored carriers → 12 rows", (await rowCount(page)) === 12);

  await setWindow(page, "90d");
  let mn = await rowCount(page);
  check("/my-carriers 90d → 1 row", mn === 1, { mn });
  await setWindow(page, "30d");
  mn = await rowCount(page);
  check("/my-carriers 30d → 0 rows", mn === 0, { mn });
  await setWindow(page, "12m");

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
