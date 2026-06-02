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
  pay_type: "both",   // → both salary + hourly relevance pointers
  remote_count: 2,    // remote workers + OR/AZ uncovered → out-of-state flag fires
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

  // -- Feature 9: office briefing -----------------------------------------
  console.log("\nOffice briefing (home WA, employees WA+OR+AZ, N=5)");
  const briefing = page.locator('[data-testid="compliance-briefing"]');
  check("briefing present", (await briefing.count()) === 1);

  // Load-bearing band.
  const band = page.locator('[data-testid="briefing-disclaimer"]');
  check("load-bearing band present", (await band.count()) === 1);
  const bandText = (await band.textContent()) ?? "";
  check("band says 'Not legal or tax advice'", /not legal or tax advice/i.test(bandText));
  check("band says 'verify with a qualified professional'",
    /verify with a qualified professional/i.test(bandText));

  // Primary state first = WA (home_state), and it's the ready briefing.
  const stateBlocks = await page.$$eval('[data-testid="briefing-state"]', els =>
    els.map(e => ({ state: e.getAttribute("data-state"), ready: e.getAttribute("data-ready") })));
  check("primary state first is WA", stateBlocks[0]?.state === "WA", { order: stateBlocks.map(s => s.state) });
  check("WA briefing is ready (full)", stateBlocks.find(s => s.state === "WA")?.ready === "true");
  check("OR briefing is coming-soon", stateBlocks.find(s => s.state === "OR")?.ready === "false");
  check("AZ briefing is coming-soon", stateBlocks.find(s => s.state === "AZ")?.ready === "false");

  // WA has the 6 briefing sections, all grounded.
  const waBlock = page.locator('[data-testid="briefing-state"][data-state="WA"]');
  const sections = waBlock.locator('[data-testid="briefing-section"]');
  check("WA briefing has 6 sections", (await sections.count()) === 6, { n: await sections.count() });
  const grounded = await waBlock.locator('[data-testid="briefing-section"][data-grounded="true"]').count();
  check("all 6 WA sections are grounded", grounded === 6, { grounded });

  // -- Accordion: collapsed by default, keyboard-operable, caution pill ------
  console.log("\nBriefing accordion (collapsed by default; expand/collapse; caution pill)");
  const toggles = waBlock.locator('[data-testid="briefing-section-toggle"]');
  check("each section has a real toggle button", (await toggles.count()) === 6);
  const allCollapsed = await toggles.evaluateAll(
    els => els.every(e => e.getAttribute("aria-expanded") === "false"));
  check("all sections collapsed by default (aria-expanded=false)", allCollapsed);
  const anyContentVisible = await waBlock.locator('[data-testid="briefing-section-content"]').evaluateAll(
    els => els.some(e => (e as HTMLElement).offsetParent !== null));
  check("no section content is visible while collapsed", anyContentVisible === false);

  // Disclaimer band + out-of-state flag are NOT gated behind expansion.
  check("disclaimer band visible while everything is collapsed",
    await page.locator('[data-testid="briefing-disclaimer"]').isVisible());
  check("out-of-state remote flag visible while everything is collapsed",
    await page.locator('[data-testid="remote-out-of-state-flag"]').isVisible());

  // Salary caution pill shows ON THE COLLAPSED HEADER.
  const salaryToggle = waBlock.locator('[data-testid="briefing-section"][data-section="salary"] [data-testid="briefing-section-toggle"]');
  const cautionPill = salaryToggle.locator('[data-testid="salary-caution-pill"]');
  check("salary collapsed header shows the caution pill", await cautionPill.isVisible());
  check("caution pill reads 'affects exempt status'",
    /affects exempt status/i.test((await cautionPill.textContent()) ?? ""));
  const salaryContent = waBlock.locator('[data-testid="briefing-section"][data-section="salary"] [data-testid="briefing-section-content"]');
  check("salary full warning is hidden while collapsed",
    !(await salaryContent.isVisible()));

  // Keyboard-operable: focus + Enter expands; click collapses again.
  await salaryToggle.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(120);
  check("salary expands via keyboard (Enter) — aria-expanded=true",
    (await salaryToggle.getAttribute("aria-expanded")) === "true");
  check("salary content visible after expand", await salaryContent.isVisible());
  check("salary warning box visible once expanded",
    await salaryContent.locator('[data-testid="salary-warning"]').isVisible());
  await salaryToggle.click(); // collapse again
  await page.waitForTimeout(120);
  check("salary collapses again on click — aria-expanded=false",
    (await salaryToggle.getAttribute("aria-expanded")) === "false");

  // At-will section MUST carry the exceptions (the firm gate).
  const atwill = (await waBlock.locator('[data-testid="briefing-section"][data-section="atwill"]').textContent()) ?? "";
  check("at-will section states at-will", /at-will/i.test(atwill));
  check("at-will section carries exceptions (discrimination/retaliation/protected leave)",
    /discriminat/i.test(atwill) && /retaliat/i.test(atwill) && /protected leave/i.test(atwill),
    { sample: atwill.slice(0, 120) });

  // Salary section: now SHOWS the grounded formula figure (decision B), with a
  // strong figure-specific warning box and a derived annual that ties exactly.
  const salarySec = waBlock.locator('[data-testid="briefing-section"][data-section="salary"]');
  const salary = (await salarySec.textContent()) ?? "";
  check("salary section shows the formula (× and a weekly $ figure)",
    /×|x/i.test(salary) && /\$[\d,]+\.\d{2}\s*(per|a)\s*week/i.test(salary), { sample: salary.slice(0, 140) });
  check("salary summary keeps the 'tiers currently match' line",
    /tiers? currently match|currently match/i.test(salary), { sample: salary.slice(0, 160) });

  // Strong inline warning box (not the generic size-gate) + derived annual.
  const warnBox = salarySec.locator('[data-testid="salary-warning"]');
  check("salary has the strong warning box", (await warnBox.count()) === 1);
  const warnText = (await warnBox.textContent()) ?? "";
  check("warning says misclassified + back overtime + confirm with L&I",
    /misclassif/i.test(warnText) && /back overtime/i.test(warnText) && /L&I/i.test(warnText));
  check("salary section has NO generic size-gate box",
    (await salarySec.locator('[data-testid="size-gate"]').count()) === 0);

  // Derived annual TIES EXACTLY to the weekly × 52 (the user's firm condition).
  const annualEl = salarySec.locator('[data-testid="salary-annual"]');
  check("derived annual present", (await annualEl.count()) === 1);
  const weekly = await annualEl.getAttribute("data-weekly");
  const annual = await annualEl.getAttribute("data-annual");
  const w = parseFloat((weekly ?? "").replace(/[$,]/g, ""));
  const a = parseFloat((annual ?? "").replace(/[$,]/g, ""));
  check("annual === round(weekly × 52) — arithmetic ties exactly",
    Number.isFinite(w) && Number.isFinite(a) && a === Math.round(w * 52),
    { weekly, annual, expected: Math.round(w * 52) });

  // Business-tax section: insurance-commissions B&O rate, grounded + framed.
  const btax = (await waBlock.locator('[data-testid="briefing-section"][data-section="btax"]').textContent()) ?? "";
  check("B&O section shows the insurance-commissions rate 0.484%", /0\.484%/.test(btax), { sample: btax.slice(0, 160) });
  check("B&O section frames it for insurance agents/brokers", /insurance (agent|broker)/i.test(btax));
  check("B&O section keeps the classification-specific / confirm-with-DOR caveat",
    /classification-specific/i.test(btax) && /DOR|Department of Revenue/i.test(btax));

  // Per-section "as of {date}" present on the grounded sections.
  const asofCount = await waBlock.locator('[data-testid="section-asof"]').count();
  check("per-section 'as of' date shown on every grounded section", asofCount === 6, { asofCount });
  const asofText = (await waBlock.locator('[data-testid="section-asof"]').first().textContent()) ?? "";
  check("'as of' shows a YYYY-MM-DD date", /Figures as of \d{4}-\d{2}-\d{2}/.test(asofText), { asofText });

  // Top band now covers staleness.
  check("top band covers staleness ('as of … may be outdated')",
    /may be outdated/i.test(bandText) && /as of/i.test(bandText));

  // Size-gate framing: now ONLY PFML (salary swapped to the warning box).
  const gates = await waBlock.locator('[data-testid="size-gate"]').allTextContents();
  check("exactly one size-gated section (PFML)", gates.length === 1, { n: gates.length });
  check("PFML size-gate states N (you have 5) and defers ('verify')",
    gates.every(g => /you have 5/i.test(g) && /verify/i.test(g)),
    { gates });
  check("size-gate is never a determination ('you are exempt/subject')",
    gates.every(g => !/you are (exempt|subject|not required|required)/i.test(g)));

  // -- Office summary (top of /compliance) ---------------------------------
  console.log("\nOffice summary (home WA, N=5, remote 2, pay BOTH, emp WA+OR+AZ)");
  const summary = page.locator('[data-testid="office-summary"]');
  check("office summary present", (await summary.count()) === 1);
  check("office summary is the ready variant (profile complete)",
    (await summary.getAttribute("data-variant")) === "ready");

  // Layout order: office summary ABOVE the not-legal/tax band ABOVE the briefing.
  const yOf = async (sel: string) => {
    const b = await page.locator(sel).first().boundingBox();
    return b ? b.y : Number.POSITIVE_INFINITY;
  };
  const ySummary = await yOf('[data-testid="office-summary"]');
  const yBand = await yOf('[data-testid="briefing-disclaimer"]');
  const yBriefing = await yOf('[data-testid="briefing-state"]');
  check("layout order: summary → not-legal/tax band → briefing",
    ySummary < yBand && yBand < yBriefing, { ySummary, yBand, yBriefing });

  // Factual recap reads back their own inputs.
  const recap = (await summary.locator('[data-testid="office-summary-recap"]').textContent()) ?? "";
  check("recap shows office location (Washington)", /Washington/.test(recap));
  check("recap shows total employees (5)", /5 employees/.test(recap));
  check("recap shows remote (2 of 5)", /2 of 5/.test(recap));
  check("recap shows pay type (Both hourly and salaried)", /Both hourly and salaried/.test(recap));

  // Relevance-pointing: present, carries their number, NEVER a determination.
  const relevance = summary.locator('[data-testid="office-summary-relevance"]');
  const pointers = await relevance.locator('[data-testid="relevance-pointer"]').allTextContents();
  check("relevance: size pointer carries their number + the 50-line",
    pointers.some(p => /5 employees/.test(p) && /50-employee line/.test(p)), { pointers });
  check("relevance: salary pointer points at the exempt-salary threshold",
    pointers.some(p => /salaried staff/i.test(p) && /exempt.salary threshold/i.test(p)));
  check("relevance: hourly pointer points at minimum wage & overtime",
    pointers.some(p => /hourly staff/i.test(p) && /minimum wage and overtime/i.test(p)));
  const relevanceText = (await relevance.textContent()) ?? "";
  const DETERMINATION = [
    /\bapplies to you\b/i, /\bdoesn'?t apply to you\b/i, /\bdoes not apply to you\b/i,
    /\byou are (exempt|subject|required|liable|covered)\b/i, /\byou must\b/i, /\byou qualify\b/i,
  ];
  check("relevance NEVER uses determination language",
    !DETERMINATION.some(re => re.test(relevanceText)),
    { matched: DETERMINATION.filter(re => re.test(relevanceText)).map(String) });

  // The load-bearing out-of-state remote flag — present, lists OR + AZ, prominent.
  const oosFlag = summary.locator('[data-testid="remote-out-of-state-flag"]');
  check("out-of-state remote flag present", (await oosFlag.count()) === 1);
  const oosList = (await oosFlag.locator('[data-testid="remote-out-of-state-list"]').textContent()) ?? "";
  check("flag lists the uncovered remote states (Arizona + Oregon)",
    /Arizona/.test(oosList) && /Oregon/.test(oosList), { oosList });
  const oosText = (await oosFlag.textContent()) ?? "";
  check("flag says those workers may be subject to their own states' rules",
    /own states.{0,3} rules/i.test(oosText));
  check("flag names the briefing's coverage (Washington) as NOT covering them",
    /this briefing \(currently Washington\) does not cover/i.test(oosText));
  // Prominence: not fine print — visibly bordered amber callout (2px border).
  const oosBorderW = await oosFlag.evaluate(el => window.getComputedStyle(el as HTMLElement).borderTopWidth);
  check("flag is visually prominent (2px border, not fine print)", oosBorderW === "2px", { oosBorderW });

  // -- Relevance pointers as in-page links to briefing sections ------------
  console.log("\nRelevance links (WA briefing renders → size/salary/hourly link; remote does not)");
  const linkFor = (key: string) =>
    relevance.locator(`[data-testid="relevance-pointer"][data-key="${key}"] [data-testid="relevance-link"]`);
  // size → PFML, salary → salary, hourly → wage all render (WA is ready).
  for (const [key, target] of [["size", "briefing-WA-pfml"], ["salary", "briefing-WA-salary"], ["hourly", "briefing-WA-wage"]] as const) {
    const a = linkFor(key);
    check(`'${key}' pointer is a link to #${target}`,
      (await a.count()) === 1 && (await a.getAttribute("href")) === `#${target}`,
      { href: await a.getAttribute("href").catch(() => null) });
  }
  // remote pointer has NO briefing section → must NOT be a link (no dead link).
  check("'remote' pointer is NOT a link (no rendered target section)",
    (await relevance.locator('[data-testid="relevance-pointer"][data-key="remote"] [data-testid="relevance-link"]').count()) === 0
      && (await relevance.locator('[data-testid="relevance-pointer"][data-key="remote"]').getAttribute("data-linked")) === "false");
  // Every rendered link points at a section element that actually exists.
  const linkTargets = await relevance.locator('[data-testid="relevance-link"]').evaluateAll(
    els => els.map(e => (e as HTMLAnchorElement).getAttribute("href")?.slice(1) ?? ""));
  for (const id of linkTargets) {
    check(`link target #${id} resolves to a rendered section (not a dead link)`,
      (await page.locator(`#${id}[data-testid="briefing-section"]`).count()) === 1);
  }

  // CRITICAL: clicking a 'Worth reviewing' link must EXPAND its target section
  // AND scroll to it — never land on a collapsed, empty row. Start from
  // collapsed (the accordion test above re-collapsed salary), so this proves
  // the link did the expanding.
  console.log("\nClicking the salary relevance link EXPANDS the target + scrolls it into view");
  check("salary section is collapsed before the click",
    (await salaryToggle.getAttribute("aria-expanded")) === "false");
  await linkFor("salary").click();
  // Smooth-scroll settle: poll until scrollY stops changing.
  await page.waitForFunction(() => {
    const w = window as unknown as { __ly?: number; __stable?: number };
    const y = window.scrollY;
    if (w.__ly === y) { w.__stable = (w.__stable ?? 0) + 1; } else { w.__stable = 0; }
    w.__ly = y;
    return (w.__stable ?? 0) >= 3;
  }, { timeout: 4000, polling: 100 }).catch(() => {});
  check("clicking EXPANDED the target salary section (aria-expanded=true)",
    (await salaryToggle.getAttribute("aria-expanded")) === "true");
  check("expanded salary content is actually visible (not a collapsed row)",
    await salaryContent.isVisible());
  const landing = await page.evaluate(() => {
    const band = document.querySelector('[data-testid="briefing-disclaimer"]') as HTMLElement;
    const sec = document.getElementById("briefing-WA-salary") as HTMLElement;
    const bandRect = band.getBoundingClientRect();
    const secRect = sec.getBoundingClientRect();
    return {
      scrollY: Math.round(window.scrollY),
      secTop: Math.round(secRect.top),
      secBottom: Math.round(secRect.bottom),
      bandBottom: Math.round(bandRect.bottom),
      viewportH: window.innerHeight,
      path: location.pathname,
    };
  });
  check("in-page only — still on /compliance (not a navigation)", landing.path === "/compliance");
  check("page actually scrolled to the section", landing.scrollY > 0, { scrollY: landing.scrollY });
  check("target lands fully BELOW the sticky band (not tucked under it)",
    landing.secTop >= landing.bandBottom - 1, { secTop: landing.secTop, bandBottom: landing.bandBottom });
  check("target header is within the viewport after the jump",
    landing.secTop >= 0 && landing.secTop < landing.viewportH, { secTop: landing.secTop, viewportH: landing.viewportH });

  // -- No ready briefing state → relevance pointers are NOT links -----------
  // Employee states OR + AZ (neither briefing-ready) → no briefing sections
  // render, so the pointers must stay plain text rather than become dead links.
  console.log("\nNo ready briefing state (emp OR+AZ) → pointers render but are NOT links");
  await setProfileAndOpen(page, { ...PROFILE, home_state: "OR", employee_states: ["OR", "AZ"] });
  const summaryNoReady = page.locator('[data-testid="office-summary"]');
  check("office summary still renders (ready variant — profile complete)",
    (await summaryNoReady.getAttribute("data-variant")) === "ready");
  const noReadyRelevance = summaryNoReady.locator('[data-testid="office-summary-relevance"]');
  check("relevance pointers still present",
    (await noReadyRelevance.locator('[data-testid="relevance-pointer"]').count()) >= 1);
  check("NO relevance link rendered (no briefing section to jump to)",
    (await noReadyRelevance.locator('[data-testid="relevance-link"]').count()) === 0);
  check("every pointer marked data-linked='false' (no dead links)",
    (await noReadyRelevance.locator('[data-testid="relevance-pointer"][data-linked="true"]').count()) === 0);

  // -- Graceful upgrade path: old profile missing the new fields ------------
  console.log("\nUpgrade path: profile saved before pay_type/remote_count existed");
  const legacy: Record<string, unknown> = { ...PROFILE };
  delete legacy.pay_type;
  delete legacy.remote_count;
  await setProfileAndOpen(page, legacy);
  const upgradeSummary = page.locator('[data-testid="office-summary"]');
  check("office summary shows the upgrade variant (not an error/wipe)",
    (await upgradeSummary.getAttribute("data-variant")) === "upgrade");
  check("upgrade prompt links to /setup",
    (await upgradeSummary.locator('[data-testid="office-summary-upgrade-link"]').getAttribute("href")) === "/setup");
  // The briefing still renders for a legacy profile (it doesn't need the new fields).
  check("briefing still renders for a legacy profile (not blocked)",
    (await page.locator('[data-testid="compliance-briefing"]').count()) === 1);

  // -- Non-covered employee state is SURFACED as coming-soon (not dropped) --
  console.log("\nNon-covered employee state surfacing (employees WA + CA)");
  await setProfileAndOpen(page, { ...PROFILE, employee_states: ["WA", "CA"] });
  const caBlock = page.locator('[data-testid="briefing-state"][data-state="CA"]');
  check("CA (non-covered) is surfaced as a briefing block", (await caBlock.count()) === 1);
  check("CA briefing is coming-soon (not dropped)",
    (await caBlock.getAttribute("data-ready")) === "false");
  const caText = (await caBlock.textContent()) ?? "";
  check("CA block names the state and says coming soon",
    /California/i.test(caText) && /coming soon/i.test(caText), { sample: caText.slice(0, 100) });

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
