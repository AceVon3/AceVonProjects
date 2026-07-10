// Take full-page screenshots of every main route at a fixed viewport,
// for before/after comparison during the Tailwind token consolidation
// refactor. Saves under polish/{phase}-{name}.png.
//
// Usage:
//   E2E_BASE=http://localhost:3000 npx tsx scripts/screenshot_pages.ts before
//   E2E_BASE=http://localhost:3000 npx tsx scripts/screenshot_pages.ts after

import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

const INDEPENDENT_AZ_NV = {
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers"],
  licensed_states: ["AZ", "NV"],
  full_name: "Ryan Christy", zip_code: "99206", home_state: "WA",
  employee_count: 20, employee_states: ["WA", "OR", "AZ"],
  created_at: "2026-05-28T00:00:00.000Z",
};

const ROUTES: Array<{ path: string; name: string; profile: unknown | null }> = [
  { path: "/overview", name: "overview", profile: INDEPENDENT_AZ_NV },
  { path: "/prospect", name: "prospect", profile: INDEPENDENT_AZ_NV },
  { path: "/defend", name: "defend", profile: INDEPENDENT_AZ_NV },
  { path: "/my-carriers", name: "my-carriers", profile: INDEPENDENT_AZ_NV },
  { path: "/compliance", name: "compliance", profile: INDEPENDENT_AZ_NV },
  { path: "/methodology", name: "methodology", profile: null },
  { path: "/setup", name: "setup", profile: null },
];

async function main(): Promise<void> {
  const phase = process.argv[2];
  if (phase !== "before" && phase !== "after") {
    console.error('Usage: screenshot_pages.ts <before|after>');
    process.exit(2);
  }

  const outDir = path.resolve(process.cwd(), "polish");
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Seed localStorage on the origin once.
  await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });

  for (const r of ROUTES) {
    if (r.profile) {
      await page.evaluate(p => {
        window.localStorage.setItem("agent_profile", JSON.stringify(p));
      }, r.profile);
    } else {
      await page.evaluate(() => window.localStorage.clear());
    }

    await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle" });
    // Settle: wait for skeletons / fetches to resolve. The table pages
    // resolve once the filter-bar appears; the overview when ov-cards
    // mount; setup, compliance, methodology have static markers.
    const settleSelector = {
      overview: '[data-testid="ov-cards"]',
      prospect: '[data-testid="filter-bar"]',
      defend: '[data-testid="filter-bar"]',
      "my-carriers": '[data-testid="filter-bar"]',
      compliance: '[data-testid="compliance-grid"]',
      methodology: '[data-testid="section-validation"]',
      setup: '[data-testid="filter-bar"], h1, h2',  // setup has no testid; fall through
    }[r.name];
    if (settleSelector) {
      await page.waitForSelector(settleSelector, { timeout: 8000 }).catch(() => {});
    }
    // Final paint settle.
    await page.waitForTimeout(200);

    const out = path.join(outDir, `${phase}-${r.name}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log(`  wrote ${out}`);
  }

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
