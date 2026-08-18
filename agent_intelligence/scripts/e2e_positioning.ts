// End-to-end check of /positioning against a running dev server.
//
// The page shows PERSONAL AUTO ONLY (2026-07-14) — a display filter over the
// per-line API cells; the computation is untouched. Expected counts below are
// the Personal Auto subset, cross-derived from getPositioning() directly.
//
// Re-keyed 2026-08-18 for the 26h2 refresh + NC import (as_of 2026-08-10) —
// this file was missed in the 08-10 re-key, same as verify_positioning.ts
// (whose note carries the full attribution). Counts re-derived from
// getPositioning() and matched the rendered DOM exactly before pinning.
// Captive State Farm, all 8 states (the recon answer key, auto-only):
//   7 anchored cells (cards), 7 anchor rows, 52 comparison rows
//   (29 higher-confidence with a spread, 23 thin without), 1 unanchored item.
// Independent {SF, Travelers, Progressive}, all 8 (auto-only):
//   97 comparison rows, 44 higher-confidence.
// Plus: the persistent rate-change framing band is present; spread appears
// only on higher-confidence rows; a row expands to its underlying filings;
// the date-range note states the 12-month window; the dumbbell's generated
// text (headline/footnote/table) passes the determination blocklist. The
// explainer card was removed 2026-08-18 — the e2e asserts its absence.
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
  // The card grid is collapsed by default (2026-08-18) — wait on the dumbbell.
  await page.waitForSelector('[data-testid="positioning-dumbbell"], [data-testid="positioning-empty"]', { timeout: 8000 });
}

// The per-carrier cards live behind a collapsed-by-default disclosure
// (2026-08-18). Asserts the default state, then expands for the card checks.
async function expandDetail(page: Page): Promise<void> {
  const firstCell = page.locator('[data-testid="positioning-cell"]').first();
  check("comparison cards hidden until expanded", !(await firstCell.isVisible()));
  await page.locator('[data-testid="detailed-comparisons"] > summary').click();
  await page.waitForTimeout(120);
  check("comparison cards visible after expanding", await firstCell.isVisible());
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
  await expandDetail(page);

  const cells = await page.locator('[data-testid="positioning-cell"]').count();
  check("7 anchored cells (cards, auto-only)", cells === 7, { cells });
  const anchors = await page.locator('[data-testid="anchor-row"]').count();
  check("7 anchor rows (one per captive cell)", anchors === 7, { anchors });

  const t = await tierCounts(page);
  // re-keyed 2026-07-14: Personal Auto-only view (was 42/23/19 both-lines)
  check("52 comparison rows", t.total === 52, { total: t.total });
  check("29 higher-confidence rows", t.high === 29, { high: t.high });
  check("23 thin rows", t.thin === 23, { thin: t.thin });
  check("spread shown on exactly the 29 high rows (none on thin)", t.spread === 29, { spread: t.spread });

  const unanchored = await page.locator('[data-testid="unanchored-item"]').count();
  check("1 unanchored (line·state) item (auto-only)", unanchored === 1, { unanchored });

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

  // The explainer card was removed 2026-08-18 (the dumbbell headline tells
  // the story) — the language guard moves to the dumbbell's generated text:
  // headline sentence, footnote, and table all live inside its testid.
  const dumb = page.locator('[data-testid="positioning-dumbbell"]');
  check("dumbbell chart present", (await dumb.count()) === 1);
  const dumbText = (await dumb.textContent()) ?? "";
  check("dumbbell states the you-vs-market framing", /market average/i.test(dumbText), { head: dumbText.slice(0, 160) });
  const detHit = DETERMINATION.find(re => re.test(dumbText));
  check("dumbbell text passes the determination-language blocklist", !detHit,
    detHit ? { matched: String(detHit) } : undefined);
  check("explainer card is gone",
    (await page.locator('[data-testid="positioning-explainer"]').count()) === 0);

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
  await expandDetail(page);
  const ti = await tierCounts(page);
  // re-keyed 2026-07-14: Personal Auto-only view (was 66/30 both-lines);
  // re-keyed 2026-08-18: 26h2 refresh (see header note).
  check("97 comparison rows", ti.total === 97, { total: ti.total });
  check("44 higher-confidence rows", ti.high === 44, { high: ti.high });
  check("spread shown on exactly the 44 high rows", ti.spread === 44, { spread: ti.spread });

  // Dumbbell renders for the independent view too, and stays determination-free.
  const dumbInd = (await page.locator('[data-testid="positioning-dumbbell"]').textContent()) ?? "";
  check("independent dumbbell present + passes blocklist",
    dumbInd.length > 0 && !DETERMINATION.some(re => re.test(dumbInd)),
    { head: dumbInd.slice(0, 160) });

  await browser.close();
  console.log("\n" + "=".repeat(72));
  if (failures === 0) console.log("E2E ALL CHECKS PASSED");
  else { console.log(`E2E FAILURES: ${failures}`); process.exit(1); }
}

main().catch(err => { console.error(err); process.exit(1); });
