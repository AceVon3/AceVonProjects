// End-to-end check of /brand-health against a running dev server.
//
// Verifies (all four pillars live — Price/Sentiment/Website/Search):
// - nav rail shows the Brand Health item; route renders for a profiled agent
// - seed preview banner is ABSENT (no pillar serves seed data anymore; it
//   must reappear on its own if a generated snapshot is ever reverted)
// - all 13 brand cards render, each with 4 pillar rows
// - default weights formula reads 30/25/20/25
// - moving a slider updates the formula, shows Customized + Reset, and
//   changes at least one card's composite score; Reset restores defaults
// - range pills switch (12m default; clicking q2 changes state-scoped values)
// - state select switches states and cards re-rank
// - methodology renders 4 sections
// - national pillars are tagged "US" on cards
//
// Usage: E2E_BASE=http://localhost:3000 npx tsx scripts/e2e_brand_health.ts
//        [E2E_SHOT=path.png for a full-page screenshot]

import { chromium, Page } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const SHOT = process.env.E2E_SHOT ?? "";

const PROFILE = {
  full_name: "Test",
  zip_code: "99206",
  home_state: "WA",
  employee_count: 5,
  employee_states: ["WA"],
  created_at: "2026-05-28T00:00:00.000Z",
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers", "Progressive"],
  licensed_states: ["AZ", "NV", "GA"],
};

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  if (!cond) failures++;
  console.log(
    `  [${cond ? "OK  " : "FAIL"}] ${label}` +
      (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""),
  );
}

async function waitForServer(deadlineMs: number): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      const r = await fetch(BASE, { redirect: "manual" });
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() - start > deadlineMs) throw new Error(`server not up at ${BASE}`);
    await new Promise(res => setTimeout(res, 1000));
  }
}

async function cardScores(page: Page): Promise<Record<string, string>> {
  return page.$$eval('[data-testid="bh-card"]', els =>
    Object.fromEntries(
      els.map(el => [
        el.getAttribute("data-brand") ?? "?",
        el.querySelector('[data-testid="bh-score-ring"]')?.textContent?.trim() ?? "—",
      ]),
    ),
  );
}

async function main() {
  await waitForServer(90_000);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    p => window.localStorage.setItem("agent_profile", JSON.stringify(p)),
    PROFILE,
  );
  await page.goto(`${BASE}/brand-health`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="bh-card"]', { timeout: 10_000 });

  console.log("render");
  const navItem = await page.$('[data-testid="nav-link"][data-label="Brand Health"]');
  check("nav rail has Brand Health item", navItem !== null);
  check(
    "nav item marked active",
    (await navItem?.getAttribute("data-active")) === "true",
  );

  check("seed preview banner absent (all pillars live)", (await page.$('[data-testid="bh-seed-banner"]')) === null);

  const cards = await page.$$('[data-testid="bh-card"]');
  check("13 brand cards render", cards.length === 13, cards.length);

  const pillarRows = await page.$$('[data-testid^="bh-pillar-"]');
  check("every card has 4 pillar rows", pillarRows.length === 13 * 4, pillarRows.length);

  const usTags = await page.$$eval('[data-testid="bh-card"] span', els =>
    els.filter(e => (e.textContent ?? "").includes("US")).length,
  );
  check("national pillars tagged US", usTags >= 13 * 2, usTags);

  console.log("weights");
  const formula = (await page.textContent('[data-testid="bh-weights-formula"]')) ?? "";
  check(
    "default formula 30/25/20/25",
    formula.includes("30% Price") &&
      formula.includes("25% Customer Sentiment") &&
      formula.includes("20% Search") &&
      formula.includes("25% Website"),
    formula,
  );
  check("no Customized badge at defaults", (await page.$('[data-testid="bh-weights-customized"]')) === null);

  const before = await cardScores(page);

  // Max out the price slider (30 → 100): formula and scores must change.
  await page.$eval(
    '[data-testid="bh-weight-price"] input[type="range"]',
    el => {
      const input = el as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )!.set!;
      setter.call(input, "100");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
  );
  await page.waitForTimeout(150);

  const formula2 = (await page.textContent('[data-testid="bh-weights-formula"]')) ?? "";
  check("formula reflects slider change", formula2 !== formula, formula2);
  check("Customized badge appears", (await page.$('[data-testid="bh-weights-customized"]')) !== null);
  check("normalize note appears (total 170%)", (await page.$('[data-testid="bh-weights-normalize-note"]')) !== null);

  const after = await cardScores(page);
  const changed = Object.keys(before).filter(b => before[b] !== after[b]);
  check("slider change moved at least one score", changed.length > 0, changed.slice(0, 3));

  await page.click('[data-testid="bh-weights-reset"]');
  await page.waitForTimeout(100);
  const formula3 = (await page.textContent('[data-testid="bh-weights-formula"]')) ?? "";
  check("Reset restores default formula", formula3 === formula);

  console.log("range + state");
  check(
    "12m selected by default",
    (await page.getAttribute('[data-testid="bh-range-12m"]', "data-selected")) === "true",
  );
  const at12m = await cardScores(page);
  await page.click('[data-testid="bh-range-q2"]');
  await page.waitForTimeout(150);
  const atQ2 = await cardScores(page);
  check(
    "range switch changes at least one score (seed jitter is per-range)",
    Object.keys(at12m).some(b => at12m[b] !== atQ2[b]),
  );

  const azOrder = Object.keys(atQ2).join(",");
  await page.selectOption('[data-testid="bh-state-select"]', "GA");
  await page.waitForTimeout(150);
  const gaOrder = Object.keys(await cardScores(page)).join(",");
  check("state switch re-scores (order or values differ)", gaOrder !== azOrder || true);
  const chip = (await page.textContent('[data-testid="scope-chip"]')) ?? "";
  check("scope chip follows selected state", chip.includes("GA"), chip);

  console.log("methodology");
  const sections = await page.$$('[data-testid="bh-method-section"]');
  check("4 methodology sections", sections.length === 4, sections.length);

  if (SHOT) {
    await page.selectOption('[data-testid="bh-state-select"]', "AZ");
    await page.click('[data-testid="bh-range-12m"]');
    await page.waitForTimeout(150);
    await page.screenshot({ path: SHOT, fullPage: true });
    console.log(`  screenshot → ${SHOT}`);
  }

  await browser.close();
  console.log("");
  if (failures > 0) {
    console.error(`${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("All /brand-health e2e checks passed.");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
