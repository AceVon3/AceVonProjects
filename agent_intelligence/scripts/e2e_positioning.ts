// End-to-end check of /positioning against a running dev server.
//
// Captive State Farm, all 8 states (the recon answer key):
//   10 anchored cells (cards), 10 anchor rows, 41 comparison rows
//   (23 higher-confidence with a spread, 18 thin without), 6 unanchored items.
// Independent {SF, Travelers, Progressive}, all 8:
//   64 comparison rows, 30 higher-confidence.
// Plus: the persistent rate-change framing band is present; spread appears
// only on higher-confidence rows; a row expands to its underlying filings.
//
// Usage: E2E_BASE=http://localhost:3000 npx tsx scripts/e2e_positioning.ts

import { Page, chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const ALL_8 = ["AZ", "CO", "ID", "MT", "NV", "OR", "UT", "WA"];
const PB = {
  full_name: "Test", zip_code: "99206", home_state: "WA",
  employee_count: 5, employee_states: ["WA"], created_at: "2026-05-28T00:00:00.000Z",
};
const CAPTIVE_SF = { ...PB, agent_type: "captive", authorized_brands: ["State Farm"], licensed_states: ALL_8 };
const INDEP = { ...PB, agent_type: "independent", authorized_brands: ["State Farm", "Travelers", "Progressive"], licensed_states: ALL_8 };

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (!cond) failures++;
  console.log(`  [${cond ? "OK  " : "FAIL"}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

async function open(page: Page, profile: unknown): Promise<void> {
  await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });
  await page.evaluate(p => window.localStorage.setItem("agent_profile", JSON.stringify(p)), profile);
  await page.goto(`${BASE}/positioning`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="positioning-cell"], [data-testid="positioning-empty"]', { timeout: 8000 });
}

async function tierCounts(page: Page): Promise<{ total: number; high: number; thin: number; spread: number }> {
  return page.$$eval('[data-testid="comparison-row"]', rows => ({
    total: rows.length,
    high: rows.filter(r => r.getAttribute("data-tier") === "high").length,
    thin: rows.filter(r => r.getAttribute("data-tier") === "thin").length,
    spread: rows.filter(r => r.getAttribute("data-spread") === "true").length,
  }));
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  console.log("=".repeat(72));
  console.log(`E2E: /positioning against ${BASE}`);
  console.log("=".repeat(72));

  // -- Captive State Farm, all 8 states ------------------------------------
  console.log("\nCaptive State Farm, all 8 states (recon answer key)");
  await open(page, CAPTIVE_SF);

  const cells = await page.locator('[data-testid="positioning-cell"]').count();
  check("10 anchored cells (cards)", cells === 10, { cells });
  const anchors = await page.locator('[data-testid="anchor-row"]').count();
  check("10 anchor rows (one per captive cell)", anchors === 10, { anchors });

  const t = await tierCounts(page);
  check("41 comparison rows", t.total === 41, { total: t.total });
  check("23 higher-confidence rows", t.high === 23, { high: t.high });
  check("18 thin rows", t.thin === 18, { thin: t.thin });
  check("spread shown on exactly the 23 high rows (none on thin)", t.spread === 23, { spread: t.spread });

  const unanchored = await page.locator('[data-testid="unanchored-item"]').count();
  check("6 unanchored (line·state) items", unanchored === 6, { unanchored });

  // Persistent framing band.
  const frame = page.locator('[data-testid="rate-change-frame"]');
  check("rate-change framing band present", (await frame.count()) === 1);
  const frameText = (await frame.textContent()) ?? "";
  check("framing says 'not prices'", /not prices/i.test(frameText));

  // At least one insufficient-data line is present (29 competitor absences).
  check("insufficient-data line(s) present", (await page.locator('[data-testid="insufficient-line"]').count()) >= 1);

  // Expand the first comparison row → underlying filings appear.
  const firstCmp = page.locator('[data-testid="comparison-row"] button').first();
  await firstCmp.click();
  await page.waitForTimeout(120);
  const auditText = await page.locator('[data-testid="comparison-row"]').first().textContent();
  check("expanding a comparison reveals the audit ('change filed, not price')",
    !!auditText && /change filed, not price/.test(auditText));

  // -- Independent {SF, Travelers, Progressive}, all 8 ---------------------
  console.log("\nIndependent {State Farm, Travelers, Progressive}, all 8 states");
  await open(page, INDEP);
  const ti = await tierCounts(page);
  check("64 comparison rows", ti.total === 64, { total: ti.total });
  check("30 higher-confidence rows", ti.high === 30, { high: ti.high });
  check("spread shown on exactly the 30 high rows", ti.spread === 30, { spread: ti.spread });

  await browser.close();
  console.log("\n" + "=".repeat(72));
  if (failures === 0) console.log("E2E ALL CHECKS PASSED");
  else { console.log(`E2E FAILURES: ${failures}`); process.exit(1); }
}

main().catch(err => { console.error(err); process.exit(1); });
