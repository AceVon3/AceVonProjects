// Mobile-layout verification at 375×800 (standard small-phone viewport).
//
// What this checks:
//   1. No horizontal body overflow on any page — i.e., document width is
//      not wider than viewport, which would force the user to side-scroll
//      the entire page.
//   2. Specific responsive expectations:
//        - Overview cards collapse from 4 across to a single column.
//        - Compliance grid collapses from 3 across to a single column.
//        - NavBar nav row scrolls horizontally rather than overflowing
//          the topbar (brand stays in place).
//        - FilingsTable scrolls horizontally inside its overflow-x-auto
//          wrapper (table keeps its 900px min-width).
//   3. Tap-target sizes for the main interactive controls. WCAG 2.5.8
//      and the Apple/Android guidelines call for ≥ 44×44 px (some
//      sources cite 40 or 48); below ~32 is hard for thumbs on a 375px
//      device. We REPORT measurements rather than enforce a hard
//      threshold — some sub-targets are intentional (filter chip glyphs
//      are tight by design) and need a human call.
//   4. Saves polish/mobile-{name}.png screenshots for visual review.
//
// Usage:
//   E2E_BASE=http://localhost:3000 npx tsx scripts/e2e_mobile.ts

import { mkdirSync } from "node:fs";
import path from "node:path";
import { Page, chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

const INDEPENDENT_AZ_NV = {
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers"],
  licensed_states: ["AZ", "NV"],
  full_name: "Ryan Christy", zip_code: "99206", home_state: "WA",
  employee_count: 20, employee_states: ["WA", "OR", "AZ"],
  created_at: "2026-05-28T00:00:00.000Z",
};

const ROUTES: Array<{ path: string; name: string; profile: unknown | null; settle?: string }> = [
  { path: "/",            name: "overview",    profile: INDEPENDENT_AZ_NV, settle: '[data-testid="ov-cards"]' },
  { path: "/prospect",    name: "prospect",    profile: INDEPENDENT_AZ_NV, settle: '[data-testid="filter-bar"]' },
  { path: "/defend",      name: "defend",      profile: INDEPENDENT_AZ_NV, settle: '[data-testid="filter-bar"]' },
  { path: "/my-carriers", name: "my-carriers", profile: INDEPENDENT_AZ_NV, settle: '[data-testid="filter-bar"]' },
  { path: "/compliance",  name: "compliance",  profile: INDEPENDENT_AZ_NV, settle: '[data-testid="compliance-grid"]' },
  { path: "/methodology", name: "methodology", profile: null,              settle: '[data-testid="section-validation"]' },
  { path: "/setup",       name: "setup",       profile: null,              settle: "h1" },
];

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

async function main(): Promise<void> {
  const outDir = path.resolve(process.cwd(), "polish");
  mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 800 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  console.log("=".repeat(72));
  console.log(`E2E: mobile layout (375×800) against ${BASE}`);
  console.log("=".repeat(72));

  // --- per-route layout checks --------------------------------------------
  for (const r of ROUTES) {
    console.log(`\n[${r.path}]`);
    await setProfile(page, r.profile);
    await page.goto(`${BASE}${r.path}`, { waitUntil: "networkidle" });
    if (r.settle) {
      await page.waitForSelector(r.settle, { timeout: 8000 }).catch(() => {});
    }
    await page.waitForTimeout(200);

    // Save screenshot.
    const out = path.join(outDir, `mobile-${r.name}.png`);
    await page.screenshot({ path: out, fullPage: true });

    // No horizontal body overflow. (The page itself shouldn't side-scroll;
    // individual elements like the nav row and the table CAN scroll inside
    // their own overflow-x-auto containers.)
    const docWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    check(`document scrollWidth ≤ viewport (375)`, docWidth <= 375, { docWidth });
  }

  // --- responsive grid expectations ---------------------------------------
  console.log(`\n[responsive grids]`);

  // Overview: 4 cards → stacked (1 col).
  await setProfile(page, INDEPENDENT_AZ_NV);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="ov-cards"]', { timeout: 5000 });
  const ovCols = await page.locator('[data-testid="ov-cards"]').evaluate(
    el => window.getComputedStyle(el).gridTemplateColumns.split(" ").length,
  );
  check("Overview cards: 1 column at 375px", ovCols === 1, { ovCols });

  // Compliance: 3-col grid → 1 col.
  await page.goto(`${BASE}/compliance`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="compliance-grid"]', { timeout: 5000 });
  const compCols = await page.locator('[data-testid="compliance-grid"]').evaluate(
    el => window.getComputedStyle(el).gridTemplateColumns.split(" ").length,
  );
  check("Compliance grid: 1 column at 375px", compCols === 1, { compCols });

  // --- NavBar: scrolls within its own row, brand visible ------------------
  console.log(`\n[navbar]`);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="navbar"]', { timeout: 5000 });
  // Brand should be fully on-screen.
  const brand = await page.locator('[data-testid="navbar"] a').first().boundingBox();
  check("brand mark visible (x ≥ 0 and right edge ≤ 375)",
    !!brand && brand.x >= 0 && brand.x + brand.width <= 375,
    brand);
  // Nav element should have scrollable overflow (scrollWidth > clientWidth).
  const navOverflow = await page.locator('[data-testid="navbar"] nav').evaluate(
    (el: HTMLElement) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowsHorizontally: el.scrollWidth > el.clientWidth,
    }),
  );
  check("nav row has horizontal scroll content (more items than fit)",
    navOverflow.overflowsHorizontally, navOverflow);

  // --- FilingsTable: scrolls within its overflow wrapper ------------------
  console.log(`\n[filings table]`);
  await page.goto(`${BASE}/prospect`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="filter-bar"]', { timeout: 5000 });
  const tableWrapperOverflow = await page.locator("table").evaluateAll(tables => {
    if (tables.length === 0) return null;
    const t = tables[0] as HTMLTableElement;
    const wrapper = t.parentElement!;
    return {
      tableScrollWidth: t.scrollWidth,
      wrapperClientWidth: wrapper.clientWidth,
      wrapperOverflowX: window.getComputedStyle(wrapper).overflowX,
      tableMinWidthHonored: t.scrollWidth >= 900,
    };
  });
  check("table is inside an overflow-x:auto wrapper",
    tableWrapperOverflow?.wrapperOverflowX === "auto", tableWrapperOverflow);
  check("table keeps its 900px min-width (scrollable, not squished)",
    !!tableWrapperOverflow?.tableMinWidthHonored, tableWrapperOverflow);

  // --- tap-target measurements (REPORT, don't fail) -----------------------
  console.log(`\n[tap-target measurements — REPORT ONLY]`);

  async function measure(label: string, selector: string, ctxPath?: string): Promise<void> {
    if (ctxPath) {
      await page.goto(`${BASE}${ctxPath}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);
    }
    const els = await page.locator(selector).all();
    if (els.length === 0) {
      console.log(`  [—] ${label}: no element found at "${selector}"`);
      return;
    }
    const box = await els[0].boundingBox();
    const w = Math.round(box?.width ?? 0);
    const h = Math.round(box?.height ?? 0);
    const minDim = Math.min(w, h);
    const warn = minDim < 32 ? "  ⚠ smallest dim < 32px (touch unfriendly)" : "";
    console.log(`  [${w}×${h}] ${label}${warn}`);
  }

  // Visit prospect first to set up state for filter measurements.
  await page.goto(`${BASE}/prospect`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="filter-bar"]', { timeout: 5000 });
  await measure("filter chip (States)", '[data-testid="chip-states"]');
  await measure("filter chip (Time)", '[data-testid="chip-time"]');

  // Open the State filter panel and measure an option.
  await page.locator('[data-testid="chip-states"]').click();
  await page.waitForSelector('[data-testid="opt-state-AZ"]', { timeout: 3000 });
  await measure("filter checkbox option (AZ)", '[data-testid="opt-state-AZ"]');
  // Close the panel before moving on.
  await page.locator('[data-testid="chip-states"]').click();

  // Setup page interactive controls.
  await setProfile(page, null);
  await page.goto(`${BASE}/setup`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await measure("setup: input (Full name)", 'input[placeholder="Ryan Christy"]');
  await measure("setup: agent-type card button (Independent)", 'button[aria-pressed]');
  await measure("setup: carrier select button (first)", 'button[role="checkbox"]');
  await measure("setup: state list row (first non-disabled)",
    'div.rounded-md.overflow-hidden button:not([disabled])');
  await measure("setup: 'Save changes' button", 'button[type="submit"]');

  await browser.close();

  console.log("\n" + "=".repeat(72));
  if (failures === 0) {
    console.log("MOBILE LAYOUT CHECKS PASSED");
    console.log("(tap-target sizes above are REPORT-ONLY — review for desktop-vs-touch trade-offs)");
  } else {
    console.log(`MOBILE LAYOUT FAILURES: ${failures}`);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
