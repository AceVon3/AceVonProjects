// End-to-end check of the Overview (/) against a running dev server.
//
// Captive State Farm, AZ + NV:
//   - Prospect card count = 13 (matches /prospect)
//   - Defend card count   = 8  (matches /defend)
//   - Most Urgent card    = GEICO +50.9% in NV, pill "In effect 9w",
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
  check("Prospect card count = 13", prospectCount === "13", { prospectCount });

  const defendCount = (await page.locator('[data-testid="ov-defend-count"]').textContent())?.trim();
  check("Defend card count = 8", defendCount === "8", { defendCount });

  // Cross-check against /prospect and /defend table row counts so the
  // "counts reconcile" contract is exercised end-to-end.
  await page.goto(`${BASE}/prospect`, { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr", { timeout: 5000 });
  const prospectRows = await page.$$eval("table tbody tr", rs => rs.length);
  check("/prospect renders the same 13 rows", prospectRows === 13, { prospectRows });

  await page.goto(`${BASE}/defend`, { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr", { timeout: 5000 });
  const defendRows = await page.$$eval("table tbody tr", rs => rs.length);
  check("/defend renders the same 8 rows", defendRows === 8, { defendRows });

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
  check("Most Urgent pill = 'In effect 9w'", pillText === "In effect 9w", { pillText });
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
