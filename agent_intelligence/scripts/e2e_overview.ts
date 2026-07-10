// End-to-end check of the Overview (/) against a running dev server.
//
// Captive State Farm, AZ + NV:
//   - Prospect card count = 12 (matches /prospect)
//   - Defend card count   = 7  (matches /defend)
//   - My Carrier card     = two own-carrier counts (retention risk /
//                           opportunity), both linking to /my-carriers; the
//                           retention count reconciles with the /my-carriers band
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

  await setProfileAndOpen(page, CAPTIVE_SF, "/overview");
  await page.waitForSelector('[data-testid="ov-cards"]', { timeout: 5000 });

  // Top-bar scope chips (replaced the page subtitle in the AgencyMan refresh)
  const chips = await page.$$eval('[data-testid="scope-chip"]',
    els => els.map(e => (e.textContent ?? "").trim()));
  check("scope chips show states 'AZ, NV' and brand 'State Farm'",
    chips.some(t => /AZ,\s*NV/.test(t)) && chips.some(t => t.includes("State Farm")),
    { chips });

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
  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="ov-cards"]', { timeout: 5000 });

  // -- My Carrier alert card (own-carrier, two directions) ------------------
  const mcCard = page.locator('[data-testid="ov-card-my-carrier"]');
  check("My Carrier card present", (await mcCard.count()) === 1);
  const retText = (await mcCard.locator('[data-testid="ov-retention-count"]').textContent())?.trim() ?? "";
  const oppText = (await mcCard.locator('[data-testid="ov-opportunity-count"]').textContent())?.trim() ?? "";
  check("retention count renders as a non-negative integer",
    /^\d+$/.test(retText), { retText });
  check("opportunity count renders as a non-negative integer (0 is fine/honest)",
    /^\d+$/.test(oppText), { oppText });
  check("card labels both directions", /retention risk alert/i.test(await mcCard.textContent() ?? "")
    && /opportunity alert/i.test(await mcCard.textContent() ?? ""));
  check("retention link → /my-carriers",
    (await mcCard.locator('[data-testid="ov-retention-link"]').getAttribute("href")) === "/my-carriers");
  check("opportunity link → /my-carriers",
    (await mcCard.locator('[data-testid="ov-opportunity-link"]').getAttribute("href")) === "/my-carriers");

  // Reconciliation: the dashboard retention count equals the /my-carriers band.
  await page.goto(`${BASE}/my-carriers`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="header-count"]', { timeout: 5000 });
  // The /my-carriers summary card renders the bare count (design 3c).
  const bandRet = (await page.locator('[data-testid="retention-count"]').textContent())?.trim() ?? "";
  check("dashboard retention count reconciles with /my-carriers card",
    bandRet === retText, { dashboard: retText, card: bandRet });
  await page.goto(`${BASE}/overview`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="ov-cards"]', { timeout: 5000 });

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
    !!firstFeed && /Travelers/.test(firstFeed) && /Defend/i.test(firstFeed),
    { firstFeed });

  // -- Opportunity-is-often-0 case (own-carrier decreases are rare) ----------
  // Captive Encompass in AZ has little/no own-carrier movement — confirms both
  // counts still render as clean integers (a 0 is honest, not broken).
  console.log("\nSparse case: captive Encompass in AZ (expect clean 0s)");
  await setProfileAndOpen(page, CAPTIVE_ENCOMPASS_AZ, "/overview");
  await page.waitForSelector('[data-testid="ov-cards"]', { timeout: 5000 });
  const mc2 = page.locator('[data-testid="ov-card-my-carrier"]');
  check("My Carrier card present in sparse case", (await mc2.count()) === 1);
  const ret2 = (await mc2.locator('[data-testid="ov-retention-count"]').textContent())?.trim() ?? "";
  const opp2 = (await mc2.locator('[data-testid="ov-opportunity-count"]').textContent())?.trim() ?? "";
  check("both counts are clean integers in the sparse case",
    /^\d+$/.test(ret2) && /^\d+$/.test(opp2), { ret2, opp2 });

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
