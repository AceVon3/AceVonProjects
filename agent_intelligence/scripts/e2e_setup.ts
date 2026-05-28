// End-to-end click-through of /setup against a running dev server.
//
// What it verifies:
//   1. Visiting / with an empty profile redirects to /setup.
//   2. Filling the form with all required fields and clicking Save
//      writes the expected payload to localStorage and routes to /.
//   3. Reloading / with the profile present stays on / (no redirect).
//   4. Clearing localStorage and reloading / sends the user back to /setup.
//
// Usage (dev server must already be running on :3000):
//   npx tsx scripts/e2e_setup.ts

import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  // Fresh context = fresh localStorage. Important: each phase clears state.
  let context = await browser.newContext();
  let page = await context.newPage();

  console.log("=".repeat(72));
  console.log(`E2E: Agency Profile round-trip against ${BASE}`);
  console.log("=".repeat(72));

  // -- (1) Redirect when no profile -----------------------------------------
  console.log("\n(1) empty localStorage -> visiting / should redirect to /setup");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForURL("**/setup", { timeout: 5000 }).catch(() => {});
  check("URL is /setup after visiting /",
    new URL(page.url()).pathname === "/setup",
    { url: page.url() });
  check("page heading is 'Agency Profile'",
    (await page.locator("h1").first().textContent())?.trim() === "Agency Profile");

  // -- (2) Fill form, save, route to / --------------------------------------
  console.log("\n(2) fill the form, click Save, expect routing to /");
  await page.fill('input[placeholder="Ryan Christy"]', "Ryan Christy");
  await page.fill('input[placeholder="99206"]', "99206");
  await page.selectOption("select", "WA"); // Home state
  await page.fill('input[placeholder="20"]', "20");

  // Agent type: choose Independent (the default-looking option in the ref).
  await page.getByRole("button", { name: /Independent/ }).click();

  // Carriers: pick State Farm + Travelers (multi-select since Independent).
  await page.getByRole("checkbox", { name: /State Farm/ }).click();
  await page.getByRole("checkbox", { name: /Travelers/ }).click();

  // Licensed states (only data_coverage ones are clickable). Pick WA, OR, ID.
  // The state list buttons live in the first state-list panel.
  const licensedPanel = page.locator("text=Licensed / doing business states").locator("..");
  for (const code of ["WA", "OR", "ID"]) {
    await licensedPanel.getByRole("checkbox", { name: new RegExp(code) }).first().click();
  }

  // Employee states (any of 50). Pick WA, OR, AZ from the second panel.
  const empPanel = page.locator("text=Employee work / live states").locator("..");
  for (const code of ["WA", "OR", "AZ"]) {
    await empPanel.getByRole("checkbox", { name: new RegExp(code) }).first().click();
  }

  // Tamper check: a non-data_coverage state in the LICENSED list should be
  // disabled. Try California — should not become selectable.
  const caBtn = licensedPanel.getByRole("checkbox", { name: /California/ }).first();
  const caDisabled = await caBtn.isDisabled();
  check("licensed list: California (non-covered) is disabled", caDisabled);

  await page.getByRole("button", { name: "Save changes" }).click();

  await page.waitForURL(BASE + "/", { timeout: 5000 }).catch(() => {});
  check("URL is / after Save",
    new URL(page.url()).pathname === "/",
    { url: page.url() });

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("agent_profile") ?? "null"));
  check("localStorage.agent_profile is populated",      stored !== null);
  check("  agent_type === 'independent'",                stored?.agent_type === "independent");
  check("  authorized_brands = [State Farm, Travelers]", JSON.stringify(stored?.authorized_brands) === '["State Farm","Travelers"]');
  check("  licensed_states = [WA, OR, ID]",              JSON.stringify(stored?.licensed_states) === '["WA","OR","ID"]');
  check("  employee_states = [WA, OR, AZ]",              JSON.stringify(stored?.employee_states) === '["WA","OR","AZ"]');
  check("  full_name = 'Ryan Christy'",                  stored?.full_name === "Ryan Christy");
  check("  zip_code = '99206'",                          stored?.zip_code === "99206");
  check("  home_state = 'WA'",                           stored?.home_state === "WA");
  check("  employee_count = 20",                         stored?.employee_count === 20);
  check("  created_at is ISO timestamp",                 /^\d{4}-\d{2}-\d{2}T/.test(stored?.created_at ?? ""));

  // -- (3) Reload, expect to stay on / --------------------------------------
  console.log("\n(3) reload / with profile present, expect to stay on /");
  await page.reload({ waitUntil: "networkidle" });
  // Give the useEffect a chance to fire — if it redirected, URL would change.
  await page.waitForTimeout(500);
  check("URL is still / after reload",
    new URL(page.url()).pathname === "/",
    { url: page.url() });
  // The real Overview (shipped in step 8) renders the four OverviewCards
  // instead of the original step-4 placeholder; assert against the actual
  // landed page so this stays green as later steps build on /.
  await page.waitForSelector('[data-testid="ov-cards"]', { timeout: 5000 });
  const overviewHeading = (await page.locator('[data-testid="page-title"]').textContent())?.trim();
  check("Overview heading present", overviewHeading === "Overview", { overviewHeading });
  const cardCount = await page.locator(
    '[data-testid="ov-card-prospect"], [data-testid="ov-card-defend"], [data-testid="ov-card-most-urgent"], [data-testid="ov-card-most-urgent-empty"], [data-testid="ov-card-compliance"]',
  ).count();
  check("Overview renders all four cards", cardCount === 4, { cardCount });

  // -- (4) Clear profile, reload, expect bounce back to /setup --------------
  console.log("\n(4) clear localStorage and reload, expect redirect back to /setup");
  await page.evaluate(() => window.localStorage.clear());
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForURL("**/setup", { timeout: 5000 }).catch(() => {});
  check("URL is /setup after clearing profile",
    new URL(page.url()).pathname === "/setup",
    { url: page.url() });

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
