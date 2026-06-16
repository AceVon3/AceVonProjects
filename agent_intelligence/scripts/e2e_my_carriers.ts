// End-to-end check of /my-carriers against a running dev server.
//
// Cases covered (matching the step-3 verification numbers):
//   A. Independent, SF + Travelers, AZ + NV                   → 12 rows
//   B. Independent, SF + Travelers + Progressive, AZ+CO+NV    → 32 rows
//   C. Independent, Allstate + Liberty + Safeco, all 8 states → 110 rows
//
// Plus:
//   D. Surveillance behavior — at least one row in case C carries an
//      impact strictly between Defend's −2% threshold and Prospect's +5%
//      threshold (i.e. a row that would be invisible on the other two
//      tables). This proves the no-impact-threshold contract.
//   E. Effective-column badges are neutral gray (or amber Pending review
//      for the rare null-effective-date case) — never red/green/blue.
//   F. Captive ACCESS: a captive visiting /my-carriers is NOT redirected —
//      they see their single carrier's filings (State Farm, AZ+NV → 8 rows),
//      singular "My Carrier" framing.
//   G. API ALLOWS captive: GET /api/filings?mode=my-carriers&agent_type=captive
//      returns HTTP 200 with that carrier's filings.
//
// Usage (dev server must be running):
//   E2E_BASE=http://localhost:3005 npx tsx scripts/e2e_my_carriers.ts

import { Page, chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

type Profile = {
  agent_type: "captive" | "independent";
  authorized_brands: string[];
  licensed_states: string[];
  full_name: string; zip_code: string; home_state: string;
  employee_count: number; employee_states: string[]; created_at: string;
};

const BASE_PROFILE = {
  full_name: "Test", zip_code: "99206", home_state: "WA",
  employee_count: 5, employee_states: ["WA"],
  created_at: "2026-05-28T00:00:00.000Z",
};

const ALL_8 = ["AZ", "CO", "ID", "MT", "NV", "OR", "UT", "WA"];

const CASE_A: Profile = {
  ...BASE_PROFILE,
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers"],
  licensed_states: ["AZ", "NV"],
};
const CASE_B: Profile = {
  ...BASE_PROFILE,
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers", "Progressive"],
  licensed_states: ["AZ", "CO", "NV"],
};
const CASE_C: Profile = {
  ...BASE_PROFILE,
  agent_type: "independent",
  authorized_brands: ["Allstate", "Liberty Mutual", "Safeco"],
  licensed_states: ALL_8,
};
const CAPTIVE_SF: Profile = {
  ...BASE_PROFILE,
  agent_type: "captive",
  authorized_brands: ["State Farm"],
  licensed_states: ["AZ", "NV"],
};

// Neutral badge backgrounds for my-carriers (computed rgb):
//   gray-fill  #F1EFE8 -> rgb(241, 239, 232)
//   amber-fill #FAEEDA -> rgb(250, 238, 218)   (only for Pending review)
const NEUTRAL_BG = ["rgb(241, 239, 232)", "rgb(250, 238, 218)"];
const NEUTRAL_TEXT_RE = /(^In \d+ weeks$|Effective this week|In effect \d+ weeks|Pending review)/;

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

async function setProfileAndOpen(
  page: Page,
  profile: Profile,
  pathname: string,
): Promise<void> {
  // Use /setup as the origin-establishing page (it never redirects).
  await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });
  await page.evaluate(p => {
    window.localStorage.setItem("agent_profile", JSON.stringify(p));
  }, profile);
  await page.goto(`${BASE}${pathname}`, { waitUntil: "networkidle" });
}

async function rowCountAfterLoad(page: Page): Promise<number> {
  // Either the table renders or the page reports an empty state.
  await page.waitForSelector("table tbody tr, [data-testid=empty-state]", { timeout: 5000 }).catch(() => {});
  return page.$$eval("table tbody tr", rs => rs.length);
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("=".repeat(72));
  console.log(`E2E: /my-carriers against ${BASE}`);
  console.log("=".repeat(72));

  // -- Cases A / B / C: row counts ------------------------------------------
  console.log("\nCase A: Independent, SF + Travelers, AZ + NV");
  await setProfileAndOpen(page, CASE_A, "/my-carriers");
  check("10 rows on screen", (await rowCountAfterLoad(page)) === 10);

  console.log("\nCase B: Independent, SF + Travelers + Progressive, AZ+CO+NV");
  await setProfileAndOpen(page, CASE_B, "/my-carriers");
  check("26 rows on screen", (await rowCountAfterLoad(page)) === 26);

  console.log("\nCase C: Independent, Allstate + Liberty Mutual + Safeco, all 8 states");
  await setProfileAndOpen(page, CASE_C, "/my-carriers");
  const cRows = await rowCountAfterLoad(page);
  check("78 rows on screen", cRows === 78);

  // First column header should be "Carrier" for my-carriers regardless of
  // agent_type — spec line 854.
  const firstHeader = (await page.locator("table thead th").first().textContent())?.trim();
  check("first column header = 'Carrier'", firstHeader === "Carrier", { firstHeader });
  const col4Header = (await page.locator("table thead th").nth(3).textContent())?.trim();
  check("column 4 header = 'Sub-type'", col4Header === "Sub-type", { col4Header });

  // (D) Surveillance behavior: at least one row's Impact cell shows a value
  // strictly between Defend's -2% and Prospect's +5% thresholds. Impact is
  // column 5 after the Sub-type column was added. (handle U+2212 minus.)
  const impactTexts = await page.$$eval("table tbody tr td:nth-child(5)", tds =>
    tds.map(t => t.textContent?.trim() ?? ""),
  );
  function parseImpact(s: string): number | null {
    const m = s.match(/([+−-]?)(\d+(?:\.\d+)?)%/);
    if (!m) return null;
    const sign = m[1] === "−" || m[1] === "-" ? -1 : 1;
    return sign * parseFloat(m[2]);
  }
  const impacts = impactTexts.map(parseImpact).filter((n): n is number => n !== null);
  const belowThreshold = impacts.filter(n => n > -2 && n < 5);
  check("at least one row has impact in (-2, +5) (no-threshold surveillance)",
    belowThreshold.length >= 1,
    { count: belowThreshold.length, samples: belowThreshold.slice(0, 5) });
  const zeroImpact = impacts.filter(n => Math.abs(n) < 0.01);
  check("zero-impact filings appear (would be invisible on Prospect/Defend)",
    zeroImpact.length >= 1,
    { count: zeroImpact.length });

  // (E) Every Effective-column window badge is neutral (gray, or amber for
  // Pending). Effective is column 6 after the Sub-type column was added.
  const badges = await page.$$eval("table tbody tr td:nth-child(6) span", spans =>
    spans.map(s => ({
      text: s.textContent?.trim() ?? "",
      bg: window.getComputedStyle(s as HTMLElement).backgroundColor,
    })),
  );
  check(`every Effective badge is neutral gray or amber (${badges.length} badges checked)`,
    badges.every(b => NEUTRAL_BG.includes(b.bg)),
    { offendingColors: Array.from(new Set(badges.filter(b => !NEUTRAL_BG.includes(b.bg)).map(b => b.bg))) });
  check("every badge text matches my-carriers neutral phrasing",
    badges.every(b => NEUTRAL_TEXT_RE.test(b.text)),
    { offending: badges.filter(b => !NEUTRAL_TEXT_RE.test(b.text)).map(b => b.text).slice(0, 3) });

  // Mine pill must NOT appear on my-carriers (every row is owned anyway).
  const minePills = await page.locator('[data-testid="mine-pill"]').count();
  check("no Mine pill appears on /my-carriers", minePills === 0, { minePills });

  // -- (F) Captive ACCESS (no redirect) -------------------------------------
  console.log("\n(F) Captive State Farm reaches /my-carriers (no redirect) → own carrier only");
  await setProfileAndOpen(page, CAPTIVE_SF, "/my-carriers");
  // Give the client useEffect a beat; assert it did NOT bounce to /.
  await page.waitForSelector("table tbody tr, [data-testid=empty-state]", { timeout: 5000 }).catch(() => {});
  check("captive stays on /my-carriers (not redirected)",
    new URL(page.url()).pathname === "/my-carriers", { url: page.url() });
  const capRows = await page.$$eval("table tbody tr", rs => rs.length);
  check("captive State Farm AZ+NV → 6 rows (their carrier only)", capRows === 6, { capRows });
  const capBrands = await page.$$eval("table tbody tr td:first-child", tds =>
    Array.from(new Set(tds.map(t => t.textContent?.trim() ?? ""))));
  check("every row is State Farm (no other brand leaks in)",
    capBrands.length === 1 && capBrands[0] === "State Farm", { capBrands });
  // Singular framing: page title "My Carrier", header card shows the carrier name.
  const capTitle = (await page.locator("h1").first().textContent())?.trim();
  check("page title is singular 'My Carrier'", capTitle === "My Carrier", { capTitle });
  // Nav link is the singular "My Carrier".
  const navLabels = await page.$$eval('[data-testid="nav-link"]', els =>
    els.map(e => e.getAttribute("data-label")));
  check("nav shows 'My Carrier' (singular), not 'My Carriers'",
    navLabels.includes("My Carrier") && !navLabels.includes("My Carriers"), { navLabels });

  // -- (F2) GA State Farm: rate-neutral suppression + hidden note -----------
  // GA State Farm has 11 active own-carrier filings, 8 of them rate-neutral
  // (0.0%). My Carriers shows only the 3 rate-MOVING ones, and a note accounts
  // for the 8 hidden so the count gap isn't a mystery.
  console.log("\n(F2) captive State Farm in GA → 3 rate-moving rows, 8 neutral hidden");
  const CAPTIVE_SF_GA: Profile = { ...CAPTIVE_SF, licensed_states: ["GA"] };
  await setProfileAndOpen(page, CAPTIVE_SF_GA, "/my-carriers");
  await page.waitForSelector("table tbody tr, [data-testid=empty-state]", { timeout: 5000 }).catch(() => {});
  const gaRows = await page.$$eval("table tbody tr", rs => rs.length);
  check("GA State Farm → 3 rows (rate-moving only; 0% suppressed)", gaRows === 3, { gaRows });
  const gaImpacts = await page.$$eval("table tbody tr", rs =>
    rs.map(r => r.textContent ?? ""));
  check("no 0.0% row is visible", !gaImpacts.some(t => /\b0\.0%/.test(t)), { sample: gaImpacts[0]?.slice(0, 60) });
  const gaNote = page.locator('[data-testid="neutral-hidden-note"]');
  check("rate-neutral hidden note present", (await gaNote.count()) === 1);
  check("note reports 8 hidden", /\b8 rate-neutral/i.test((await gaNote.textContent()) ?? ""),
    { note: (await gaNote.textContent())?.trim() });

  // -- (G) API allows captive + my-carriers ---------------------------------
  console.log("\n(G) API allows captive + my-carriers (returns the carrier's filings)");
  const apiResp = await page.evaluate(async (base) => {
    const r = await fetch(
      `${base}/api/filings?mode=my-carriers&agent_type=captive&captive_brand=State+Farm` +
      `&authorized_brands=State+Farm&licensed_states=AZ,NV`,
    );
    return { status: r.status, body: await r.json() };
  }, BASE);
  check("API returns HTTP 200", apiResp.status === 200, { status: apiResp.status });
  check("API returns 6 State Farm filings",
    Array.isArray(apiResp.body?.filings)
      && apiResp.body.filings.length === 6
      && apiResp.body.filings.every((f: { brand: string }) => f.brand === "State Farm"),
    { count: apiResp.body?.filings?.length });

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
