// End-to-end check of the Overview (/) against a running dev server.
//
// Captive State Farm, AZ + NV:
//   - Prospect card count = 12 (matches /prospect)
//   - Defend card count   = 7  (matches /defend)
//   - Most Urgent card    = GEICO +50.9% in NV, pill "In effect 11w",
//                           card uses the urgent (red-border) style and
//                           links to /prospect (since impact > 0)
//   - Compliance card     = "{n} states tracked" where n = employee_states
//                           length; "Last checked …" line present; no
//                           wording that implies change-detection ("new
//                           law", "changes detected", etc.)
//   - Recent Changes feed top row = Travelers (matches spec verification)
//
// Usage: E2E_BASE=http://localhost:3006 npx tsx scripts/e2e_overview.ts

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
  employee_states: ["WA", "OR", "AZ"], // 3 states for the Compliance card
  created_at: "2026-05-28T00:00:00.000Z",
};

// A captive whose carrier filed nothing in their state — exercises the
// "No recent {brand} filings in your states" empty state.
const CAPTIVE_ENCOMPASS_AZ = {
  agent_type: "captive",
  authorized_brands: ["Encompass"],
  licensed_states: ["AZ"],
  full_name: "Test Captive",
  zip_code: "99206",
  home_state: "WA",
  employee_count: 5,
  employee_states: ["WA"],
  created_at: "2026-05-28T00:00:00.000Z",
};

// A captive selling all 8 states whose carrier filed in only 5 of them —
// exercises the per-state coverage floor AND the "No recent filings … in:
// {states}" note (Progressive has no filings in ID, UT, WA).
const CAPTIVE_PROGRESSIVE_8 = {
  agent_type: "captive",
  authorized_brands: ["Progressive"],
  licensed_states: ["AZ", "CO", "ID", "MT", "NV", "OR", "UT", "WA"],
  full_name: "Test Captive",
  zip_code: "99206",
  home_state: "WA",
  employee_count: 5,
  employee_states: ["WA"],
  created_at: "2026-05-28T00:00:00.000Z",
};

const FORBIDDEN_COMPLIANCE_PHRASES = [
  /\bnew law\b/i,
  /\bchanges detected\b/i,
  /\bnewly\s/i,
  /\bupdated regulation/i,
];

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

async function setProfileAndOpen(page: Page, profile: unknown, path: string): Promise<void> {
  await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });
  await page.evaluate(p => {
    window.localStorage.setItem("agent_profile", JSON.stringify(p));
  }, profile);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("=".repeat(72));
  console.log(`E2E: Overview (/) against ${BASE} — captive State Farm, AZ + NV`);
  console.log("=".repeat(72));

  await setProfileAndOpen(page, CAPTIVE_SF, "/");
  await page.waitForSelector('[data-testid="ov-cards"]', { timeout: 5000 });

  // Page header
  const subtitle = (await page.locator('[data-testid="page-subtitle"]').textContent())?.trim();
  check("page subtitle = 'State Farm · AZ, NV'",
    subtitle === "State Farm · AZ, NV", { subtitle });

  // -- Counts ---------------------------------------------------------------
  const prospectCount = (await page.locator('[data-testid="ov-prospect-count"]').textContent())?.trim();
  check("Prospect card count = 12", prospectCount === "12", { prospectCount });

  const defendCount = (await page.locator('[data-testid="ov-defend-count"]').textContent())?.trim();
  check("Defend card count = 7", defendCount === "7", { defendCount });

  // Cross-check against /prospect and /defend table row counts so the
  // "counts reconcile" contract is exercised end-to-end.
  await page.goto(`${BASE}/prospect`, { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr", { timeout: 5000 });
  const prospectRows = await page.$$eval("table tbody tr", rs => rs.length);
  check("/prospect renders the same 12 rows", prospectRows === 12, { prospectRows });

  await page.goto(`${BASE}/defend`, { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr", { timeout: 5000 });
  const defendRows = await page.$$eval("table tbody tr", rs => rs.length);
  check("/defend renders the same 7 rows", defendRows === 7, { defendRows });

  // Back to Overview for the rest.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="ov-cards"]', { timeout: 5000 });

  // -- Most Urgent ----------------------------------------------------------
  const muCard = page.locator('[data-testid="ov-card-most-urgent"]');
  check("Most Urgent card is the non-empty variant",
    (await muCard.count()) === 1);
  const muBody = (await muCard.locator('[data-testid="ov-most-urgent-body"]').textContent())?.trim();
  check("Most Urgent body shows 'GEICO' + impact + 'in NV'",
    !!muBody && muBody.includes("GEICO") && muBody.includes("NV") && /\+50\.9%/.test(muBody),
    { muBody });
  const pillText = (await muCard.locator('[data-testid="ov-most-urgent-pill"]').textContent())?.trim();
  check("Most Urgent pill = 'In effect 11w'", pillText === "In effect 11w", { pillText });
  const muTier = await muCard.getAttribute("data-tier");
  check("Most Urgent reports tier 2 (collapsed fallback)", muTier === "2", { muTier });
  const muHref = await muCard.getAttribute("href");
  check("Most Urgent links to /prospect (impact > 0)", muHref === "/prospect", { muHref });

  // The card uses the accented (2px red) border per spec.
  const muBorder = await muCard.evaluate(el => window.getComputedStyle(el as HTMLElement).borderTopWidth);
  check("Most Urgent card has 2px border (accented)", muBorder === "2px", { muBorder });

  // -- Compliance card ------------------------------------------------------
  const compCard = page.locator('[data-testid="ov-card-compliance"]');
  const compStates = (await compCard.locator('[data-testid="ov-compliance-states"]').textContent())?.trim();
  check("Compliance card shows '3 states tracked' (employee_states.length=3)",
    compStates === "3 states tracked", { compStates });
  const compText = (await compCard.textContent()) ?? "";
  check("Compliance card includes 'Last checked …'",
    /Last checked\s+[A-Z][a-z]{2}\s+\d{1,2}/.test(compText), { compText });
  for (const re of FORBIDDEN_COMPLIANCE_PHRASES) {
    check(`Compliance card does NOT say ${re}`, !re.test(compText), { compText });
  }
  check("Compliance card includes 'View resources →'", /View resources/.test(compText));

  // -- Recent Changes feed --------------------------------------------------
  const feed = page.locator('[data-testid="recent-changes"]');
  check("Recent Changes section exists", (await feed.count()) === 1);
  const feedRows = await feed.locator('[data-testid="feed-row"]').count();
  check("Recent Changes shows ≤ 8 rows", feedRows > 0 && feedRows <= 8, { feedRows });
  const firstFeed = await feed.locator('[data-testid="feed-row"]').first().textContent();
  check("Top feed row is Travelers (matches spec verification ordering)",
    !!firstFeed && /Travelers/.test(firstFeed) && /defend/.test(firstFeed),
    { firstFeed });

  // -- "Your carrier's activity" recent-filings slice (captive SF AZ+NV) ----
  // Floor = 2 (AZ + NV) + 3 extras (CARRIER_ACTIVITY_EXTRA) = 5 rows; both
  // states have filings, so no "no-filings" note here.
  const ca = page.locator('[data-testid="carrier-activity"]');
  check("carrier-activity card present", (await ca.count()) === 1);
  const caTitle = (await ca.locator("h3").textContent())?.trim() ?? "";
  check("captive title names the carrier ('Your carrier (State Farm) — recent filings')",
    /Your carrier \(State Farm\) — recent filings/i.test(caTitle), { caTitle });
  const caItems = await ca.locator('[data-testid="carrier-activity-item"]').count();
  check("carrier-activity shows 5 filing rows (floor 2 + 3 extras)",
    caItems === 5, { caItems });
  // Each row carries its own filing detail: line, signed change, dated year.
  const firstRow = (await ca.locator('[data-testid="carrier-activity-item"]').first().textContent()) ?? "";
  check("row shows a line of business", /Personal Auto|Homeowners/.test(firstRow), { firstRow });
  check("row shows a signed rate change", /[+−]\d+\.\d%/.test(firstRow), { firstRow });
  const firstEff = (await ca.locator('[data-testid="carrier-activity-eff"]').first().textContent())?.trim() ?? "";
  check("row shows an effective date with year",
    /^[A-Z][a-z]{2} \d{1,2}, 20\d{2}$/.test(firstEff), { firstEff });
  // "See all" link to the full My Carrier table.
  const seeAll = ca.locator('[data-testid="carrier-activity-seeall"]');
  check("'See all' link present", (await seeAll.count()) === 1);
  check("'See all' links to /my-carriers",
    (await seeAll.getAttribute("href")) === "/my-carriers", { href: await seeAll.getAttribute("href") });
  // Both AZ and NV filed → no no-filings note.
  check("no 'no-filings' note when every licensed state has filings",
    (await ca.locator('[data-testid="carrier-activity-nofilings"]').count()) === 0);

  // -- Coverage floor + no-filings note (captive Progressive, all 8) --------
  // Progressive filed in 5 of 8 states; ID/UT/WA must be noted, not dropped,
  // and the 5 filed states must each still be represented by ≥1 row.
  console.log("\nCoverage case: captive Progressive, all 8 states");
  await setProfileAndOpen(page, CAPTIVE_PROGRESSIVE_8, "/");
  await page.waitForSelector('[data-testid="ov-cards"]', { timeout: 5000 });
  const caP = page.locator('[data-testid="carrier-activity"]');
  const note = caP.locator('[data-testid="carrier-activity-nofilings"]');
  check("no-filings note present", (await note.count()) === 1);
  const noteText = (await note.textContent())?.trim() ?? "";
  check("no-filings note lists exactly ID, MT, UT, WA",
    /No recent rate-moving filings from your carrier in:\s*ID,\s*MT,\s*UT,\s*WA/i.test(noteText), { noteText });
  // Coverage floor: each of the 5 filed states appears in at least one row.
  const shownStates = new Set(
    await caP.locator('[data-testid="carrier-activity-state"]').allTextContents(),
  );
  for (const st of ["AZ", "CO", "NV", "OR"]) {
    check(`filed state ${st} is represented (coverage floor)`, shownStates.has(st),
      { st, shown: Array.from(shownStates).sort() });
  }
  check("no-filings states (ID/MT/UT/WA) are NOT shown as rows",
    !["ID", "MT", "UT", "WA"].some(s => shownStates.has(s)),
    { shown: Array.from(shownStates).sort() });

  // -- Empty case (captive Encompass AZ — carrier filed nothing) ------------
  console.log("\nEmpty case: captive Encompass in AZ");
  await setProfileAndOpen(page, CAPTIVE_ENCOMPASS_AZ, "/");
  await page.waitForSelector('[data-testid="ov-cards"]', { timeout: 5000 });
  const ca2 = page.locator('[data-testid="carrier-activity"]');
  check("carrier-activity card still present (not omitted)", (await ca2.count()) === 1);
  const empty = ca2.locator('[data-testid="carrier-activity-empty"]');
  check("plain empty message shown (no empty element)", (await empty.count()) === 1);
  check("empty message names the carrier ('No recent Encompass filings…')",
    /No recent Encompass filings in your states/i.test((await empty.textContent()) ?? ""));
  check("no activity item rows in the empty case",
    (await ca2.locator('[data-testid="carrier-activity-item"]').count()) === 0);
  // With zero rows the empty message covers it; the per-state no-filings note
  // is suppressed (it complements a populated list, not the empty state).
  check("no-filings note suppressed in the all-empty case",
    (await ca2.locator('[data-testid="carrier-activity-nofilings"]').count()) === 0);

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
