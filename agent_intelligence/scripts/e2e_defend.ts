// End-to-end check of /defend against a running dev server.
//
// Phase A: Captive State Farm in AZ + NV
//   - 8 rows
//   - first column header = "Threat"
//   - no row's first cell contains "State Farm"
//   - every row uses defend-mode window framing (Risk window… or
//     Customers may already be shopping) — never the prospect text
//   - all defend badges live in the {red, amber} palette
//
// Phase B: Independent in AZ + NV with [State Farm, Travelers]
//   - 10 rows
//   - first column header = "Threat" (defend mode always uses Threat,
//     for both captive and independent — Screen 4 is the independent
//     reference and uses Threat)
//   - State Farm + Travelers rows show the Mine pill
//
// Usage (dev server must be running):
//   E2E_BASE=http://localhost:3004 npx tsx scripts/e2e_defend.ts

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

// Defend-mode badge text (the only mode that uses these strings). The
// already-in-effect rows now read "In effect N weeks" — the "your customers
// may shop" framing lives once in the page header, not on every row.
const DEFEND_BADGE_RE = /(Risk window opens in \d+ weeks|Risk window open now|In effect \d+ weeks|Pending review)/;
// Defend badges only use red (#FBEAEB fill) or amber (#FCF1E3 fill) — the
// AgencyMan refresh palette.
const DEFEND_BG_COLORS = ["rgb(251, 234, 235)", "rgb(252, 241, 227)"];

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

async function setProfileAndOpen(page: Page, profile: unknown): Promise<void> {
  await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });
  await page.evaluate(p => {
    window.localStorage.setItem("agent_profile", JSON.stringify(p));
  }, profile);
  await page.goto(`${BASE}/defend`, { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr", { timeout: 5000 });
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("=".repeat(72));
  console.log(`E2E: /defend against ${BASE}`);
  console.log("=".repeat(72));

  // -- Phase A: Captive State Farm, AZ + NV ---------------------------------
  console.log("\nPhase A: Captive State Farm, AZ + NV");
  await setProfileAndOpen(page, CAPTIVE_SF);

  const rowCount = await page.$$eval("table tbody tr", rs => rs.length);
  check("7 rows on screen", rowCount === 7, { rowCount });

  const firstHeader = (await page.locator("table thead th").first().textContent())?.trim();
  check("first column header = 'Threat'", firstHeader === "Threat", { firstHeader });
  // Line/State/Sub-type live inside the Threat cell (design 3b), so the
  // columns are Threat · Effective · Status · Impact · Action.
  const col2Header = (await page.locator("table thead th").nth(1).textContent())?.trim();
  check("column 2 header = 'Effective'", col2Header === "Effective", { col2Header });
  const col4Header = (await page.locator("table thead th").nth(3).textContent())?.trim();
  check("column 4 header = 'Impact'", col4Header === "Impact", { col4Header });
  const col5Header = (await page.locator("table thead th").nth(4).textContent())?.trim();
  check("column 5 header = 'Action'", col5Header === "Action", { col5Header });

  const brands = await page.$$eval('table tbody tr [data-testid="row-brand"]', cells =>
    cells.map(c => c.textContent?.trim() ?? ""),
  );
  check("no row's Threat carrier is 'State Farm'",
    brands.every(b => !b.includes("State Farm")), { brands });

  // Window badges (the <span> inside the Effective cell — the date is a
  // <div>). Effective is now column 2.
  const badges = await page.$$eval("table tbody tr td:nth-child(2) span", spans =>
    spans.map(s => ({
      text: s.textContent?.trim() ?? "",
      bg: window.getComputedStyle(s as HTMLElement).backgroundColor,
    })),
  );
  check("every window badge uses defend-mode framing",
    badges.every(b => DEFEND_BADGE_RE.test(b.text)),
    { offending: badges.filter(b => !DEFEND_BADGE_RE.test(b.text)) });
  check("every window badge color is red or amber (never green/blue/gray)",
    badges.every(b => DEFEND_BG_COLORS.includes(b.bg)),
    { offending: badges.filter(b => !DEFEND_BG_COLORS.includes(b.bg)) });

  // The data is all in the past relative to asOf, so the expected framing for
  // every row is the amber "In effect N weeks". Assert that so we know the
  // future-vs-past branch is wired correctly.
  const allPastFraming = badges.every(b => /^In effect \d+ weeks$/.test(b.text));
  check("all past-effective rows show 'In effect N weeks' (amber)",
    allPastFraming, { uniqueTexts: Array.from(new Set(badges.map(b => b.text))) });

  // SERFF tooltips still present per spec.
  const serffTitles = await page.$$eval("table tbody tr", rs =>
    rs.map(r => r.getAttribute("title") ?? ""),
  );
  check("every row carries title='Filing: <serff>'",
    serffTitles.every(t => /^Filing: [A-Z]+-[A-Z0-9]+$/.test(t)),
    { sample: serffTitles[0] });

  // -- Phase B: Independent (State Farm + Travelers), AZ + NV ---------------
  console.log("\nPhase B: Independent (SF + Travelers), AZ + NV");
  await setProfileAndOpen(page, INDEPENDENT_SF_TRV);

  const indRowCount = await page.$$eval("table tbody tr", rs => rs.length);
  check("9 rows on screen", indRowCount === 9, { indRowCount });

  const indFirstHeader = (await page.locator("table thead th").first().textContent())?.trim();
  check("first column header = 'Threat' (defend mode, independent)",
    indFirstHeader === "Threat", { indFirstHeader });

  // Mine pill behaviour stays consistent with /prospect: owned-brand rows
  // get the pill + warm tint, others do not.
  const rowMeta = await page.$$eval("table tbody tr", rs =>
    rs.map(r => ({
      brand: r.querySelector('[data-testid="row-brand"]')?.textContent?.trim() ?? "",
      hasMine: !!r.querySelector('[data-testid="mine-pill"]'),
      // Use computed style — the warm tint comes from a Tailwind class
      // (bg-mine-bg) after the token consolidation, not inline style.
      bg: window.getComputedStyle(r as HTMLElement).backgroundColor,
    })),
  );
  const owned = new Set(["State Farm", "Travelers"]);
  const ownedRows = rowMeta.filter(r => owned.has(r.brand));
  const otherRows = rowMeta.filter(r => !owned.has(r.brand));

  check(`owned-brand rows present (${ownedRows.length})`, ownedRows.length > 0);
  check("every owned-brand row shows the Mine pill",
    ownedRows.every(r => r.hasMine),
    { offending: ownedRows.filter(r => !r.hasMine).map(r => r.brand) });
  check("no other-brand row shows the Mine pill",
    otherRows.every(r => !r.hasMine),
    { offending: otherRows.filter(r => r.hasMine).map(r => r.brand) });
  check("owned rows carry the mine tint background",
    ownedRows.every(r => r.bg.includes("196, 33, 39")));

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
