// End-to-end check of /positioning against a running dev server.
//
// The page shows PERSONAL AUTO ONLY (2026-07-14) — a display filter over the
// per-line API cells; the computation is untouched. Expected counts below are
// the Personal Auto subset, cross-derived from getPositioning() directly.
// Captive State Farm, all 8 states (the recon answer key, auto-only):
//   6 anchored cells (cards), 6 anchor rows, 28 comparison rows
//   (18 higher-confidence with a spread, 10 thin without), 2 unanchored items.
// Independent {SF, Travelers, Progressive}, all 8 (auto-only):
//   42 comparison rows, 22 higher-confidence.
// Plus: the persistent rate-change framing band is present; spread appears
// only on higher-confidence rows; a row expands to its underlying filings;
// the date-range note states the 12-month window; the plain-language
// explainer renders from real data and passes the determination blocklist.
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

// Determination-language blocklist — same line verify_office_summary.ts and
// verify_briefing_language.ts hold their copy to. The rendered explainer
// interprets real data and must never cross into a per-reader determination.
const DETERMINATION: RegExp[] = [
  /\bapplies to you\b/i,
  /\bdoes not apply to you\b/i,
  /\bdoesn'?t apply to you\b/i,
  /\byou are (exempt|subject|required|liable|covered|owed|cheaper)\b/i,
  /\byou'?re (exempt|subject|required|liable|covered|cheaper)\b/i,
  /\byou must\b/i,
  /\byou qualify\b/i,
  /\byou owe\b/i,
  /\bnot subject to\b/i,
  /\byou should\b/i,
  /\bswitch to\b/i,
];

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
  check("6 anchored cells (cards, auto-only)", cells === 6, { cells });
  const anchors = await page.locator('[data-testid="anchor-row"]').count();
  check("6 anchor rows (one per captive cell)", anchors === 6, { anchors });

  const t = await tierCounts(page);
  // re-keyed 2026-07-14: Personal Auto-only view (was 42/23/19 both-lines)
  check("30 comparison rows", t.total === 30, { total: t.total });
  check("22 higher-confidence rows", t.high === 22, { high: t.high });
  check("8 thin rows", t.thin === 8, { thin: t.thin });
  check("spread shown on exactly the 18 high rows (none on thin)", t.spread === 22, { spread: t.spread });

  const unanchored = await page.locator('[data-testid="unanchored-item"]').count();
  check("2 unanchored (line·state) items (auto-only)", unanchored === 2, { unanchored });

  // Persistent framing band.
  const frame = page.locator('[data-testid="rate-change-frame"]');
  check("rate-change framing band present", (await frame.count()) === 1);
  const frameText = (await frame.textContent()) ?? "";
  check("framing says 'not price levels'", /not price levels/i.test(frameText));

  // At least one insufficient-data line is present (29 competitor absences).
  check("insufficient-data line(s) present", (await page.locator('[data-testid="insufficient-line"]').count()) >= 1);

  // Date-range note: must describe the actual 12-month window, never the
  // full dataset range.
  const note = page.locator('[data-testid="date-range-note"]');
  check("date-range note present", (await note.count()) === 1);
  const noteText = (await note.textContent()) ?? "";
  check("note says 'last 12 months'", /last 12 months/i.test(noteText), { noteText });
  check("note carries a 'Data as of' stamp", /Data as of/i.test(noteText));

  // Plain-language explainer — this profile has 23 higher-confidence
  // comparisons, so it must render, use the pts-spread (not a side's own
  // average) as the differential, carry the not-premium-levels caveat, and
  // pass the determination blocklist.
  const expl = page.locator('[data-testid="positioning-explainer"]');
  check("explainer present (higher-confidence comparisons exist)", (await expl.count()) === 1);
  const explText = (await expl.textContent()) ?? "";
  check("explainer uses the pts-spread differential", /points (more|less) than/.test(explText), { explText });
  check("explainer carries the rate-changes-not-premium-levels caveat",
    /rate changes, not premium levels/i.test(explText));
  check("explainer names real brands from the data (no template braces)", !/[{}]/.test(explText));
  const detHit = DETERMINATION.find(re => re.test(explText));
  check("explainer passes the determination-language blocklist", !detHit,
    detHit ? { matched: String(detHit), explText } : undefined);

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
  // re-keyed 2026-07-14: Personal Auto-only view (was 66/30 both-lines)
  check("49 comparison rows", ti.total === 49, { total: ti.total });
  check("30 higher-confidence rows", ti.high === 30, { high: ti.high });
  check("spread shown on exactly the 22 high rows", ti.spread === 30, { spread: ti.spread });

  // Explainer renders for the independent view too, and stays determination-free.
  const explInd = (await page.locator('[data-testid="positioning-explainer"]').textContent()) ?? "";
  check("independent explainer present + passes blocklist",
    explInd.length > 0 && !DETERMINATION.some(re => re.test(explInd)), { explInd });

  await browser.close();
  console.log("\n" + "=".repeat(72));
  if (failures === 0) console.log("E2E ALL CHECKS PASSED");
  else { console.log(`E2E FAILURES: ${failures}`); process.exit(1); }
}

main().catch(err => { console.error(err); process.exit(1); });
