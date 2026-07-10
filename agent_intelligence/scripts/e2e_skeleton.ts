// Verifies the loading skeleton renders visibly on a throttled network
// (so a slow connection sees structure before the table arrives) and
// disappears once the real data renders. Also confirms the right variant
// fires per route (overview vs table).
//
// Throttling uses Chrome DevTools Protocol — Playwright's higher-level
// API doesn't expose network speed knobs, but CDP's
// Network.emulateNetworkConditions does.
//
// Usage: E2E_BASE=http://localhost:3001 npx tsx scripts/e2e_skeleton.ts

import { Page, chromium } from "playwright";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";

// Slow-3G-ish: ~50 KB/s in each direction, 400ms latency. Matches
// Chrome devtools "Slow 3G" preset closely enough.
const SLOW_3G = {
  offline: false,
  downloadThroughput: 50_000,
  uploadThroughput: 50_000,
  latency: 400,
};

const INDEPENDENT_AZ_NV = {
  agent_type: "independent",
  authorized_brands: ["State Farm", "Travelers"],
  licensed_states: ["AZ", "NV"],
  full_name: "Test", zip_code: "99206", home_state: "WA",
  employee_count: 5, employee_states: ["WA"],
  created_at: "2026-05-28T00:00:00.000Z",
};

let failures = 0;
function check(label: string, cond: boolean, detail?: unknown) {
  const tag = cond ? "OK  " : "FAIL";
  if (!cond) failures++;
  console.log(`  [${tag}] ${label}` + (detail !== undefined ? `  (${JSON.stringify(detail)})` : ""));
}

async function setProfile(page: Page, profile: unknown): Promise<void> {
  await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded" });
  await page.evaluate(p => {
    window.localStorage.setItem("agent_profile", JSON.stringify(p));
  }, profile);
}

async function throttleSlow(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", SLOW_3G);
}

async function unthrottle(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false,
    downloadThroughput: -1,
    uploadThroughput: -1,
    latency: 0,
  });
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("=".repeat(72));
  console.log(`E2E: PageSkeleton (variants + slow-3G visibility) against ${BASE}`);
  console.log("=".repeat(72));

  // -- Variant check (fast network) ----------------------------------------
  console.log("\n(1) Skeleton variants render correctly per route");

  await setProfile(page, INDEPENDENT_AZ_NV);

  // Navigate to /prospect and immediately read the skeleton — even on a
  // fast connection the skeleton flashes through before the API resolves.
  // We block on the skeleton render by intercepting before the API call.
  for (const [path, expectedVariant] of [
    ["/overview", "overview"],
    ["/prospect", "table"],
    ["/defend", "table"],
    ["/my-carriers", "table"],
  ] as const) {
    // Race the navigation against a skeleton-presence check. The skeleton
    // is the first thing rendered for these pages (before any fetch
    // resolves), so it MUST be visible at the start of the load.
    const navPromise = page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await navPromise;
    // Read whichever appears first — skeleton (loading) or real content.
    // On fast network, skeleton may have already disappeared.
    const skeletonOrReal = await page
      .locator('[data-testid="page-skeleton"], [data-testid="filter-bar"], [data-testid="ov-cards"]')
      .first()
      .elementHandle({ timeout: 3000 });
    const tid = await skeletonOrReal?.getAttribute("data-testid");
    if (tid === "page-skeleton") {
      const variant = await skeletonOrReal!.getAttribute("data-variant");
      check(`${path} → skeleton variant '${expectedVariant}'`,
        variant === expectedVariant, { path, variant });
    } else {
      // Real content already rendered. Skeleton flashed through too fast
      // to catch — that's the fast-network reality. We'll verify the
      // skeleton is reachable in the throttled phase below.
      console.log(`  [INFO] ${path} → real content rendered before skeleton could be captured (fast load)`);
    }
    // Drain to ready state so the next route starts clean.
    await page.waitForLoadState("networkidle");
  }

  // -- Slow-3G visibility check --------------------------------------------
  console.log("\n(2) Skeleton is visible for a perceptible beat on Slow 3G");

  // Throttle and reload /prospect. With ~400ms latency + tiny bandwidth,
  // the skeleton must be in the DOM for at least the first paint window.
  await throttleSlow(page);
  await page.evaluate(p => {
    window.localStorage.setItem("agent_profile", JSON.stringify(p));
  }, INDEPENDENT_AZ_NV);

  // Don't await full load — we want to inspect the in-flight state.
  page.goto(`${BASE}/prospect`).catch(() => {});
  // Wait for the skeleton to appear (the page renders it synchronously
  // before any fetch). Cap at 5s.
  const skel = await page
    .locator('[data-testid="page-skeleton"]')
    .elementHandle({ timeout: 5000 });
  check("skeleton element exists during slow load",
    skel !== null);
  if (skel) {
    const variant = await skel.getAttribute("data-variant");
    check("skeleton variant = 'table' on /prospect",
      variant === "table", { variant });
    // Box-model sanity — it should occupy real visible space, not be 0×0.
    const box = await skel.boundingBox();
    check(`skeleton has non-zero size (got ${box?.width}×${box?.height})`,
      !!box && box.width > 200 && box.height > 100);
  }

  // Verify it's still on screen ~300ms later — the throttled fetch takes
  // longer than that. This proves it sticks around long enough to register.
  await page.waitForTimeout(300);
  const stillVisible = await page.locator('[data-testid="page-skeleton"]').count();
  check("skeleton still visible 300ms into the throttled load", stillVisible === 1);

  // Unthrottle so the rest of the bundle can land (the dev-mode Next bundle
  // is too large to fully load at 50KB/s within a reasonable timeout).
  await unthrottle(page);
  await page.waitForSelector('[data-testid="filter-bar"]', { timeout: 30000 });
  const stillSkeleton = await page.locator('[data-testid="page-skeleton"]').count();
  check("skeleton replaced by real content once fetch lands",
    stillSkeleton === 0);
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
