// End-to-end check of /prospect against a running dev server.
//
// Phase A: Captive State Farm in AZ + NV
//   - 13 rows
//   - first column header = "Competitor"
//   - no row's Carrier cell contains "State Farm" (own brand excluded)
//   - every row has title="Filing: <serff>"
//   - the GEICO NV +50.9% row carries the entity-spread info dot
//   - policyholders cell is abbreviated (e.g. "15.6k", or "—")
//
// Phase B: Independent in AZ + NV with [State Farm, Travelers]
//   - 14 rows
//   - first column header = "Carrier"
//   - exactly the State Farm + Travelers rows show the Mine pill
//   - those same rows carry the warm-tinted background
//
// Usage (dev server must be running):
//   E2E_BASE=http://localhost:3003 npx tsx scripts/e2e_prospect.ts

import { Page, chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

const CAPTIVE_SF = {
  agent_type: "captive",
  authorized_brands: ["State Farm"],
  licensed_states: ["AZ", "NV"],
  full_name: "Test Captive",
  zip_code: "99206",
  home_state: "WA",
  employee_count: 5,
  employee_states: ["WA"],
  created_at: "2026-05-28T00:00:00.000Z",
};

const INDEPENDENT_SF_TRV = {
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers"],
  licensed_states: ["AZ", "NV"],
  full_name: "Test Independent",
  zip_code: "99206",
  home_state: "WA",
  employee_count: 5,
  employee_states: ["WA"],
  created_at: "2026-05-28T00:00:00.000Z",
};

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

async function setProfileAndOpen(page: Page, profile: unknown): Promise<void> {
  // /setup never redirects, so use it to establish the origin and inject
  // localStorage before navigating to /prospect.
  await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });
  await page.evaluate(p => {
    window.localStorage.setItem("agent_profile", JSON.stringify(p));
  }, profile);
  await page.goto(`${BASE}/prospect`, { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr", { timeout: 5000 });
}

async function rowBrands(page: Page): Promise<string[]> {
  return page.$$eval('table tbody tr [data-testid="row-brand"]', cells =>
    cells.map(c => c.textContent?.trim() ?? ""),
  );
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("=".repeat(72));
  console.log(`E2E: /prospect against ${BASE}`);
  console.log("=".repeat(72));

  // -- Phase A: Captive State Farm, AZ + NV ---------------------------------
  console.log("\nPhase A: Captive State Farm, AZ + NV");
  await setProfileAndOpen(page, CAPTIVE_SF);

  const rowCount = await page.$$eval("table tbody tr", rs => rs.length);
  check("12 rows on screen", rowCount === 12, { rowCount });

  const firstHeader = (await page.locator("table thead th").first().textContent())?.trim();
  check("first column header = 'Competitor'", firstHeader === "Competitor", { firstHeader });
  // State + Sub-type now live inside the carrier cell, so the columns are
  // Competitor · Line · Impact · Effective · Status · Policyholders.
  const col3Header = (await page.locator("table thead th").nth(2).textContent())?.trim();
  check("column 3 header = 'Impact'", col3Header === "Impact", { col3Header });

  const brands = await rowBrands(page);
  check("no row contains 'State Farm' in the Carrier cell",
    brands.every(b => !b.includes("State Farm")), { sample: brands });

  const serffTitles = await page.$$eval("table tbody tr", rs =>
    rs.map(r => r.getAttribute("title") ?? ""),
  );
  // SERFF numbers vary in shape: ALSE-134630441, GECC-134661852, TRVD-G134570380.
  const allHaveSerffTitle = serffTitles.every(t => /^Filing: [A-Z]+-[A-Z0-9]+$/.test(t));
  check("every row has title='Filing: <serff>'", allHaveSerffTitle,
    { sampleTitle: serffTitles[0] });

  // The GEICO NV +50.9% row (GECC-134661852) is the canonical multi-entity
  // case (spread 30.49% → 56.47%). Locate it via its row title.
  const geicoRow = page.locator('tr[title="Filing: GECC-134661852"]');
  const geicoExists = (await geicoRow.count()) === 1;
  check("GECC-134661852 row is present", geicoExists);
  if (geicoExists) {
    const dotCount = await geicoRow.locator('[data-testid="entity-spread-dot"]').count();
    check("GECC-134661852 row carries the entity-spread info dot",
      dotCount === 1, { dotCount });
    const dotTooltip = await geicoRow.locator('[data-testid="entity-spread-dot"]').getAttribute("title");
    check("info dot tooltip mentions 'Premium-weighted across 2 entities'",
      !!dotTooltip?.includes("Premium-weighted across 2 entities"),
      { dotTooltip });
  }

  // Policyholders cells: each is either "—" or matches the abbreviation
  // regex. Policyholders is now column 6.
  const polCells = await page.$$eval("table tbody tr td:nth-child(6)", tds =>
    tds.map(t => t.textContent?.trim() ?? ""),
  );
  const polRe = /^(—|\d{1,3}(\.\d)?[kM]?)$/;
  check("every policyholders cell is abbreviated or em-dash",
    polCells.every(c => polRe.test(c)),
    { offending: polCells.filter(c => !polRe.test(c)) });

  // Spot-check: at least one row shows the entity-spread dot (sanity — we
  // already asserted GEICO above, but this also covers a regression where
  // the dot fails to render anywhere).
  const totalDots = await page.locator('[data-testid="entity-spread-dot"]').count();
  check("at least one entity-spread dot on the page", totalDots >= 1, { totalDots });

  // Sub-type info bubble: clickable, opens a popover with the explanation,
  // and a catch-all sub-type carries the "Not a single specific product" line.
  const infoBtns = page.locator('[data-testid="subtype-info"]');
  check("sub-type info bubbles present", (await infoBtns.count()) >= 1);
  await infoBtns.first().click();
  await page.waitForSelector('[data-testid="subtype-popover"]', { timeout: 3000 }).catch(() => {});
  const popover = page.locator('[data-testid="subtype-popover"]');
  check("clicking the i opens the sub-type popover", (await popover.count()) === 1);
  const popText = (await popover.textContent()) ?? "";
  check("popover has a non-trivial explanation", popText.length > 40, { len: popText.length });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(80);
  check("Escape closes the popover",
    (await page.locator('[data-testid="subtype-popover"]').count()) === 0);

  // Find a catch-all (Combinations/Other) sub-type and confirm the framing.
  // The sub-type label now lives in the carrier cell (first column), so read
  // it there — brand/state text never contains "Combinations"/"Other".
  const labels = await page.$$eval("table tbody tr td:first-child", tds =>
    tds.map((t, i) => ({ i, text: t.textContent?.trim() ?? "" })));
  const caIdx = labels.findIndex(l => /Combinations|Other/.test(l.text));
  if (caIdx >= 0) {
    await page.locator(`table tbody tr:nth-child(${caIdx + 1}) [data-testid="subtype-info"]`).click();
    await page.waitForSelector('[data-testid="subtype-popover"]', { timeout: 3000 }).catch(() => {});
    const caText = (await page.locator('[data-testid="subtype-popover"]').textContent()) ?? "";
    check("catch-all popover says 'Not a single specific product'",
      /Not a single specific product/i.test(caText), { caText: caText.slice(0, 80) });
    check("catch-all popover is tagged 'catch-all'", /catch-all/i.test(caText));
    await page.keyboard.press("Escape");
  } else {
    check("a catch-all sub-type is visible to test", false, { note: "none found in captive AZ+NV prospect" });
  }

  // -- Phase B: Independent (State Farm + Travelers), AZ + NV ---------------
  console.log("\nPhase B: Independent (SF + Travelers), AZ + NV");
  await setProfileAndOpen(page, INDEPENDENT_SF_TRV);

  const indRowCount = await page.$$eval("table tbody tr", rs => rs.length);
  check("13 rows on screen", indRowCount === 13, { indRowCount });

  const indFirstHeader = (await page.locator("table thead th").first().textContent())?.trim();
  check("first column header = 'Carrier'", indFirstHeader === "Carrier", { indFirstHeader });

  // Mine pill: every State Farm/Travelers row must have one, no other row.
  const rowsWithPill = await page.$$eval("table tbody tr", rs =>
    rs.map(r => ({
      brand: r.querySelector('[data-testid="row-brand"]')?.textContent?.trim() ?? "",
      hasMine: !!r.querySelector('[data-testid="mine-pill"]'),
      // Use computed style — the warm tint comes from a Tailwind class
      // (bg-mine-bg) after the token consolidation, not inline style.
      bg: window.getComputedStyle(r as HTMLElement).backgroundColor,
    })),
  );
  const owned = new Set(["State Farm", "Travelers"]);
  const expectedMine = rowsWithPill.filter(r => owned.has(r.brand));
  const unexpectedMine = rowsWithPill.filter(r => !owned.has(r.brand) && r.hasMine);

  check("exactly the owned-brand rows have the Mine pill",
    expectedMine.every(r => r.hasMine) && unexpectedMine.length === 0,
    {
      ownedMissingPill: expectedMine.filter(r => !r.hasMine).map(r => r.brand),
      nonOwnedWithPill: unexpectedMine.map(r => r.brand),
    });
  check("at least one Mine pill is present", expectedMine.some(r => r.hasMine),
    { count: expectedMine.length });

  // Warm tint: the mine-bg color is rgba(255, 230, 200, 0.18). Browser
  // computed style serializes the same way. Match on substring.
  const mineRowsHaveTint = expectedMine.every(r => r.bg.includes("255, 230, 200"));
  const nonMineRowsNoTint = rowsWithPill
    .filter(r => !owned.has(r.brand))
    .every(r => !r.bg.includes("255, 230, 200"));
  check("owned rows carry warm tint background", mineRowsHaveTint,
    { sampleOwnedBg: expectedMine[0]?.bg });
  check("non-owned rows do NOT carry warm tint", nonMineRowsNoTint);

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
