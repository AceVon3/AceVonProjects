// End-to-end check of /compliance against a running dev server.
//
// Verifies (in priority order — the user's spec for step 9):
//
//   1. App reads ONLY the pre-generated complianceData.ts at view time.
//      Confirmed by recording every network request the page makes during
//      load and asserting NONE go to the mapped official .gov hosts.
//   2. Disclaimer banner is present with the exact required language.
//   3. Every (state, topic) cell renders a card. Cells with a stored
//      summary show the title, summary, source links as bare domains, and
//      a Last checked date. Cells without a stored summary show the
//      "Summary coming soon" fallback (still with topic tag + state badge
//      + any mapped source links).
//   4. WA (the seeded state) shows real summaries. AZ/CO/etc (stubbed in
//      resourceUrls.ts and absent from complianceData.ts) show the
//      coming-soon fallback for every topic.
//   5. Grid layout matches Screen 6 (3 columns).
//   6. The generator script's SYSTEM_PROMPT enforces strict grounding —
//      grep for the load-bearing language directly in the script source.
//
// Usage: E2E_BASE=http://localhost:3007 npx tsx scripts/e2e_compliance.ts

import { readFileSync } from "node:fs";
import path from "node:path";
import { Page, chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

// Profile: employee_states = WA + AZ + OR — gives us both a state with
// stored summaries (WA) and stubbed states (AZ, OR) to exercise the
// coming-soon fallback path.
const PROFILE = {
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers"],
  licensed_states: ["WA"],
  full_name: "Test Compliance",
  zip_code: "99206",
  home_state: "WA",
  employee_count: 5,
  employee_states: ["WA", "OR", "AZ"],
  created_at: "2026-05-28T00:00:00.000Z",
};

const TOPIC_KEYS = [
  "wage_hour", "leave", "payroll", "workers_comp",
  "termination", "nexus", "hiring", "remote",
];

// Hosts the page must NEVER contact at view time (per architecture rule:
// pre-generated and cached). Pulled from resourceUrls.ts WA mappings.
const OFFICIAL_HOSTS = [
  "lni.wa.gov", "paidleave.wa.gov", "esd.wa.gov",
  "dor.wa.gov", "insurance.wa.gov",
];

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

async function setProfileAndOpen(page: Page, profile: unknown): Promise<string[]> {
  await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });
  await page.evaluate(p => {
    window.localStorage.setItem("agent_profile", JSON.stringify(p));
  }, profile);

  // Record every network request fired during the /compliance load.
  const requestedUrls: string[] = [];
  page.on("request", req => requestedUrls.push(req.url()));

  await page.goto(`${BASE}/compliance`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="compliance-grid"], [data-testid="page-title"]', {
    timeout: 5000,
  });
  return requestedUrls;
}

async function main(): Promise<void> {
  console.log("=".repeat(72));
  console.log(`E2E: /compliance against ${BASE}`);
  console.log("=".repeat(72));

  // -- (6) Script source: grounding language is intact ----------------------
  // Done first because it doesn't need the browser/server — fails fast.
  console.log("\n(6) generator script enforces strict grounding (source check)");
  const scriptPath = path.resolve(process.cwd(), "scripts/generate_compliance.ts");
  const scriptSrc = readFileSync(scriptPath, "utf-8");
  const requiredPhrases = [
    "STRICT GROUNDING",
    "NO INFERENCE",
    "ONLY information present in the provided source pages",
    "Do NOT use prior knowledge",
    "If a fact is not in the source pages",
    "Do not infer or supply from prior knowledge",
  ];
  for (const phrase of requiredPhrases) {
    check(`SYSTEM_PROMPT contains "${phrase.slice(0, 40)}..."`,
      scriptSrc.includes(phrase));
  }
  // The script must NOT use prior-knowledge language anywhere.
  const forbidden = ["use your knowledge", "based on what you know"];
  for (const phrase of forbidden) {
    check(`SYSTEM_PROMPT does NOT contain "${phrase}"`,
      !scriptSrc.toLowerCase().includes(phrase.toLowerCase()));
  }

  // -- Browser-driven checks ------------------------------------------------
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("\n(1) page makes NO requests to official .gov hosts at view time");
  const requestedUrls = await setProfileAndOpen(page, PROFILE);
  const offending = requestedUrls.filter(u =>
    OFFICIAL_HOSTS.some(host => u.includes(host)),
  );
  check("no requests to lni.wa.gov / esd.wa.gov / dor.wa.gov / paidleave.wa.gov / insurance.wa.gov",
    offending.length === 0,
    { offending });

  console.log("\n(2) disclaimer banner present");
  const banner = page.locator('[data-testid="disclaimer-banner"]');
  check("disclaimer banner exists", (await banner.count()) === 1);
  const bannerText = (await banner.textContent())?.trim() ?? "";
  check("banner says 'AI-generated summaries'", bannerText.includes("AI-generated summaries"));
  check("banner says 'not legal advice'", /not legal advice/i.test(bannerText));
  check("banner says 'verify on the official site'",
    /verify on the official site/i.test(bannerText));

  console.log("\n(5) grid layout — 3 columns");
  const grid = page.locator('[data-testid="compliance-grid"]');
  check("grid container exists", (await grid.count()) === 1);
  const gridCols = await grid.evaluate(el =>
    window.getComputedStyle(el as HTMLElement).gridTemplateColumns,
  );
  // gridTemplateColumns serializes as e.g. "354px 354px 354px" (3 tracks).
  const colCount = gridCols.split(/\s+/).filter(Boolean).length;
  check("grid renders 3 columns", colCount === 3, { gridCols, colCount });

  console.log("\n(3) every (state, topic) cell renders a card");
  const cards = page.locator('[data-testid="compliance-card"]');
  const cardCount = await cards.count();
  // 3 employee states × 8 topics = 24 cards expected.
  check("24 cards rendered (3 states × 8 topics)", cardCount === 24, { cardCount });

  console.log("\n(4) WA cards show full summaries; AZ/OR cards show coming-soon fallback");
  const cardMeta = await page.$$eval('[data-testid="compliance-card"]', els =>
    els.map(el => ({
      state: el.getAttribute("data-state"),
      topic: el.getAttribute("data-topic"),
      variant: el.getAttribute("data-variant"),
    })),
  );
  // WA: 7 topics seeded (Remote Work intentionally absent from seed →
  // coming-soon). AZ + OR: 8 coming-soon each.
  const waFull = cardMeta.filter(c => c.state === "WA" && c.variant === "full");
  const waComingSoon = cardMeta.filter(c => c.state === "WA" && c.variant === "coming-soon");
  check("WA: 7 full-summary cards", waFull.length === 7, { waFull: waFull.length });
  // WA Remote Work: the L&I source page is a generic hub with no
  // remote-work-specific content, so the generator's refusal detector
  // stores null title/summary → ComplianceCard renders coming-soon.
  check("WA: 1 coming-soon card (Remote Work — model refused to ground)",
    waComingSoon.length === 1 && waComingSoon[0].topic === "remote",
    { waComingSoon });
  const azCards = cardMeta.filter(c => c.state === "AZ");
  const orCards = cardMeta.filter(c => c.state === "OR");
  check("AZ: 8 coming-soon cards (state stubbed in resourceUrls.ts)",
    azCards.length === 8 && azCards.every(c => c.variant === "coming-soon"));
  check("OR: 8 coming-soon cards (state stubbed in resourceUrls.ts)",
    orCards.length === 8 && orCards.every(c => c.variant === "coming-soon"));

  console.log("\n(3a) WA seeded cards: source links as bare domains + last_checked");
  // Spot-check the WA wage_hour card.
  const waWageCard = page.locator(
    '[data-testid="compliance-card"][data-state="WA"][data-topic="wage_hour"]',
  );
  check("WA wage_hour card present", (await waWageCard.count()) === 1);
  const waWageTitle = await waWageCard.locator("h3").textContent();
  check("WA wage_hour title is non-empty and not 'Summary coming soon'",
    !!waWageTitle && !/Summary coming soon/.test(waWageTitle),
    { title: waWageTitle });
  const waWageSources = await waWageCard
    .locator('[data-testid="source-link"]')
    .allTextContents();
  check("WA wage_hour shows source links as bare domains (no protocol, no path)",
    waWageSources.length > 0
      && waWageSources.every(s => /^↗\s*[a-z0-9.\-]+\.[a-z]{2,}$/i.test(s.trim())),
    { sources: waWageSources });
  const lastChecked = await waWageCard
    .locator('[data-testid="last-checked"]')
    .textContent();
  check("WA wage_hour shows Last checked: <YYYY-MM-DD>",
    !!lastChecked && /Last checked:\s+\d{4}-\d{2}-\d{2}/.test(lastChecked),
    { lastChecked });

  console.log("\n(3b) AZ coming-soon card: still renders topic tag + state badge");
  const azWageCard = page.locator(
    '[data-testid="compliance-card"][data-state="AZ"][data-topic="wage_hour"]',
  );
  check("AZ wage_hour exists as coming-soon", (await azWageCard.count()) === 1);
  const azBodyText = (await azWageCard.textContent()) ?? "";
  check("AZ coming-soon card shows topic tag 'Wage & Hour'",
    azBodyText.includes("Wage & Hour"));
  check("AZ coming-soon card shows state badge 'AZ'", azBodyText.includes("AZ"));
  check("AZ coming-soon card says 'Summary coming soon'",
    azBodyText.includes("Summary coming soon"));

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
