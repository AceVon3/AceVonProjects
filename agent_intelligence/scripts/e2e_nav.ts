// End-to-end check of NavBar + ScopeStrip across all routes.
//
// NavBar (per spec §Navigation):
//   - Captive:     Overview · Prospect · Defend · My Carrier  · Competitive Positioning · Compliance · Methodology · Profile
//   - Independent: Overview · Prospect · Defend · My Carriers · Competitive Positioning · Compliance · Methodology · Profile
//   - No profile:  Overview · Methodology only
//   - "Overview" is always first; My Carrier(s) shows for both agent types
//     (singular "My Carrier" for captives, plural "My Carriers" for independents).
//   - Active link matches current pathname.
//
// ScopeStrip (per spec §Navigation):
//   - Renders on /prospect, /defend, /my-carriers only.
//   - Captive: "Showing: {states} · vs competitors of {brand}".
//   - Independent: "Showing: {states}" (no carrier suffix).
//   - "Edit" link routes to /setup.
//
// Captive direct-URL guard for /my-carriers continues to redirect to /
// (the route guard from step 7).
//
// Usage: E2E_BASE=http://localhost:3008 npx tsx scripts/e2e_nav.ts

import { Page, chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

const PROFILE_BASE = {
  full_name: "Test", zip_code: "99206", home_state: "WA",
  employee_count: 5, employee_states: ["WA"],
  created_at: "2026-05-28T00:00:00.000Z",
};

const CAPTIVE_SF = {
  ...PROFILE_BASE,
  agent_type: "captive",
  authorized_brands: ["State Farm"],
  licensed_states: ["AZ", "NV"],
};

const INDEPENDENT_SF_TRV = {
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

async function setProfile(page: Page, profile: unknown | null): Promise<void> {
  await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });
  await page.evaluate(p => {
    if (p === null) window.localStorage.clear();
    else window.localStorage.setItem("agent_profile", JSON.stringify(p));
  }, profile);
}

async function navLabels(page: Page): Promise<string[]> {
  await page.waitForSelector('[data-testid="nav-link"]', { timeout: 5000 });
  return page.$$eval('[data-testid="nav-link"]', els =>
    els.map(e => e.getAttribute("data-label") ?? ""),
  );
}

async function activeLabel(page: Page): Promise<string | null> {
  const labels = await page.$$eval(
    '[data-testid="nav-link"][data-active="true"]',
    els => els.map(e => e.getAttribute("data-label") ?? ""),
  );
  return labels.length === 1 ? labels[0] : null;
}

async function gotoWithNav(page: Page, path: string): Promise<void> {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="navbar"]', { timeout: 5000 });
  // Give the client useEffect one tick to populate agent_type from localStorage
  // so the nav has expanded past the "no profile" minimal variant.
  await page.waitForFunction(
    () => document.querySelector('[data-testid="navbar"]')?.getAttribute("data-agent-type") !== "none",
    { timeout: 3000 },
  ).catch(() => { /* fall through — caller asserts whatever rendered */ });
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("=".repeat(72));
  console.log(`E2E: NavBar + ScopeStrip against ${BASE}`);
  console.log("=".repeat(72));

  // -- No profile -----------------------------------------------------------
  console.log("\n(A) No profile: nav shows Overview + Methodology only");
  await setProfile(page, null);
  await page.goto(`${BASE}/setup`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="navbar"]', { timeout: 5000 });
  const noProfileLabels = await navLabels(page);
  check("nav has exactly 2 links",
    noProfileLabels.length === 2, { noProfileLabels });
  check("nav = [Overview, Methodology] (Overview first)",
    JSON.stringify(noProfileLabels) === JSON.stringify(["Overview", "Methodology"]),
    { noProfileLabels });

  // -- Captive --------------------------------------------------------------
  console.log("\n(B) Captive State Farm: nav shows singular 'My Carrier' + Compliance");
  await setProfile(page, CAPTIVE_SF);
  await gotoWithNav(page, "/overview");
  const captiveLabels = await navLabels(page);
  check("nav = Overview, Prospect, Defend, My Carrier, Competitive Positioning, Compliance, Methodology, Profile (8 items)",
    JSON.stringify(captiveLabels) ===
      JSON.stringify(["Overview", "Prospect", "Defend", "My Carrier", "Competitive Positioning", "Compliance", "Methodology", "Profile"]),
    { captiveLabels });
  check("'Overview' is the first nav item", captiveLabels[0] === "Overview");
  check("captive nav uses singular 'My Carrier' (not plural 'My Carriers')",
    captiveLabels.includes("My Carrier") && !captiveLabels.includes("My Carriers"),
    { captiveLabels });
  check("'My Carrier' appears right after 'Defend'",
    captiveLabels.indexOf("My Carrier") === captiveLabels.indexOf("Defend") + 1);
  check("'Compliance' IS in the captive nav (per spec)",
    captiveLabels.includes("Compliance"));

  // Captive direct-URL access: /my-carriers now loads (no redirect).
  console.log("\n(B1) Captive direct URL /my-carriers loads (no redirect)");
  await page.goto(`${BASE}/my-carriers`, { waitUntil: "networkidle" });
  await page.waitForSelector("table tbody tr, [data-testid=empty-state]", { timeout: 5000 }).catch(() => {});
  check("URL stays /my-carriers for captive (no redirect)",
    new URL(page.url()).pathname === "/my-carriers", { url: page.url() });

  // -- Independent ----------------------------------------------------------
  console.log("\n(C) Independent: nav includes My Carriers in the right position");
  await setProfile(page, INDEPENDENT_SF_TRV);
  await gotoWithNav(page, "/overview");
  const indLabels = await navLabels(page);
  check("nav = Overview, Prospect, Defend, My Carriers, Competitive Positioning, Compliance, Methodology, Profile (8 items)",
    JSON.stringify(indLabels) ===
      JSON.stringify(["Overview", "Prospect", "Defend", "My Carriers", "Competitive Positioning", "Compliance", "Methodology", "Profile"]),
    { indLabels });
  check("'My Carriers' appears right after 'Defend'",
    indLabels.indexOf("My Carriers") === indLabels.indexOf("Defend") + 1);

  // -- Active state across routes ------------------------------------------
  console.log("\n(D) Active link tracks pathname (independent profile)");
  const routes: Array<[string, string]> = [
    ["/overview", "Overview"],
    ["/prospect", "Prospect"],
    ["/defend", "Defend"],
    ["/my-carriers", "My Carriers"],
    ["/positioning", "Competitive Positioning"],
    ["/compliance", "Compliance"],
    ["/setup", "Profile"],
  ];
  for (const [path, expectedActive] of routes) {
    await gotoWithNav(page, path);
    const active = await activeLabel(page);
    check(`pathname ${path} → active link = '${expectedActive}'`,
      active === expectedActive, { path, active });
  }

  // -- Top-bar scope chips (replaced ScopeStrip in the AgencyMan refresh) ----
  console.log("\n(E) Top-bar scope chips — captive on /prospect");
  await setProfile(page, CAPTIVE_SF);
  await gotoWithNav(page, "/prospect");
  const chipTexts = await page.$$eval('[data-testid="scope-chip"]',
    els => els.map(e => (e.textContent ?? "").trim()));
  check("states chip on /prospect shows 'AZ, NV'",
    chipTexts.some(t => /AZ,\s*NV/.test(t)), { chipTexts });
  const titleText = (await page.locator('[data-testid="page-title"]').textContent())?.trim();
  check("top-bar title = 'Prospect'", titleText === "Prospect", { titleText });

  console.log("\n(F) Top-bar chips — captive on /defend (same states chip)");
  await gotoWithNav(page, "/defend");
  const defendChips = await page.$$eval('[data-testid="scope-chip"]',
    els => els.map(e => (e.textContent ?? "").trim()));
  check("states chip on /defend shows 'AZ, NV'",
    defendChips.some(t => /AZ,\s*NV/.test(t)), { defendChips });

  console.log("\n(G) Top-bar chips — independent /my-carriers lists carriers");
  await setProfile(page, INDEPENDENT_SF_TRV);
  await gotoWithNav(page, "/my-carriers");
  const mcChips = await page.$$eval('[data-testid="scope-chip"]',
    els => els.map(e => (e.textContent ?? "").trim()));
  check("carriers chip lists the authorized brands",
    mcChips.some(t => t.includes("State Farm") && t.includes("Travelers")), { mcChips });

  console.log("\n(H) Top bar present on /overview, /setup, /compliance");
  for (const path of ["/overview", "/setup", "/compliance"]) {
    await gotoWithNav(page, path);
    const barCount = await page.locator('[data-testid="top-bar"]').count();
    check(`top bar on ${path}`, barCount === 1, { path, barCount });
  }

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
