// Phase 4 verification for the Website Performance pillar.
// Run: npx tsx scripts/verify_brand_health_website.ts
//
// Two layers:
// 1. Pure math (always runs): scoreWebsite / cruxScore / appScore proven
//    against hand-computed cases, including the renormalization paths.
// 2. Generated snapshot (runs when brandHealthWebsiteData.ts is non-null):
//    every stored metric.value is recomputed HERE from the stored raw
//    components with independent arithmetic — a bug in scoreWebsite can't
//    verify itself — plus metadata-honesty invariants (tier digital, scope
//    national, never seed, confidence rules, bounds, coverage floor).
// While the snapshot is null (refresh script not yet run — needs the free
// Google API key) layer 2 reports SKIPPED and the script still exits by
// layer-1 results, so this can run in CI before the first refresh.

import {
  appScore,
  cruxScore,
  pathScore,
  quoteFlowScore,
  scoreWebsite,
  speedScore,
  WEBSITE_COMPONENT_WEIGHTS,
  BRAND_WEBSITES,
  BRAND_APPSTORE_IDS,
} from "../src/lib/brandHealthWebsite";
import { WEBSITE_SNAPSHOT } from "../src/lib/brandHealthWebsiteData";
import { BRANDS, type Brand } from "../src/lib/constants";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failures++;
    console.error(`  FAIL  ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

console.log("pure math — component scores");
{
  check("cruxScore averages good-shares to 0-100",
    Math.abs((cruxScore({ lcp: 0.9, inp: 0.8, cls: 0.7 }) ?? 0) - 80) < 1e-9);
  check("cruxScore averages only present vitals",
    Math.abs((cruxScore({ lcp: 0.9, inp: null, cls: 0.7 }) ?? 0) - 80) < 1e-9);
  check("cruxScore null when no vitals", cruxScore({ lcp: null, inp: null, cls: null }) === null);
  check("cruxScore null when no CrUX object", cruxScore(null) === null);
  check("appScore 4.8 -> 96", appScore(4.8) === 96);
  check("appScore null passthrough", appScore(null) === null);
}

console.log("pure math — quote-flow friction scoring");
{
  check("ZIP on homepage -> path 100", pathScore(true, 0) === 100);
  check("1 click -> path 70", pathScore(false, 1) === 70);
  check("2+ clicks -> path 40", pathScore(false, 2) === 40 && pathScore(false, 3) === 40);
  check("<=5s -> speed 100", speedScore(3_900) === 100 && speedScore(5_000) === 100);
  check(">=30s -> speed 0", speedScore(30_640) === 0);
  check("17.5s -> speed 50", speedScore(17_500) === 50);
  const qf = quoteFlowScore({ zipOnHomepage: true, clicksToQuote: 0, msToQuoteStart: 5_000 });
  check("frictionless case -> 100 (0.6*100 + 0.4*100)", qf === 100, qf);
  const qf2 = quoteFlowScore({ zipOnHomepage: false, clicksToQuote: 1, msToQuoteStart: 17_500 });
  check("1 click + 17.5s -> 62 (0.6*70 + 0.4*50)", qf2 === 62, qf2);
  check("failed probe -> null", quoteFlowScore(null) === null && quoteFlowScore(undefined) === null);
}

console.log("pure math — blend + renormalization (50/30/20, quote-flow dormant at 0)");
{
  const full = scoreWebsite({
    lighthouse: 80,
    cruxGoodShares: { lcp: 0.9, inp: 0.8, cls: 0.7 }, // crux = 80
    appRating: 4.5, // app = 90
    appRatingCount: 1000,
    quoteFlow: { zipOnHomepage: true, clicksToQuote: 0, msToQuoteStart: 5_000 }, // qf = 100, weight 0
  });
  // 0.5*80 + 0.3*80 + 0.2*90 = 82 — dormant quote-flow contributes NOTHING
  check("blend is 50/30/20; dormant quote-flow contributes 0", full?.score === 82, full);
  check("weights report 50/30/20/0",
    full?.usedWeights.lighthouse === 50 && full?.usedWeights.crux === 30 &&
    full?.usedWeights.app === 20 && full?.usedWeights.quoteFlow === 0);

  const noQf = scoreWebsite({
    lighthouse: 80,
    cruxGoodShares: { lcp: 0.9, inp: 0.8, cls: 0.7 },
    appRating: 4.5,
    appRatingCount: 1000,
    quoteFlow: null,
  });
  check("score identical with or without a probe measurement", noQf?.score === 82, noQf);
  check("weights sum to 100",
    noQf!.usedWeights.lighthouse + noQf!.usedWeights.crux +
    noQf!.usedWeights.app + noQf!.usedWeights.quoteFlow === 100,
    noQf?.usedWeights);
  check("pre-probe snapshots (field absent) score identically",
    scoreWebsite({ lighthouse: 80, cruxGoodShares: { lcp: 0.9, inp: 0.8, cls: 0.7 }, appRating: 4.5, appRatingCount: 1000 })?.score === 82);

  const appOnly = scoreWebsite({
    lighthouse: null,
    cruxGoodShares: null,
    appRating: 3.46,
    appRatingCount: 99,
    quoteFlow: null,
  });
  check("app-only blend = rating*20 rounded", appOnly?.score === Math.round(3.46 * 20), appOnly);

  const nothing = scoreWebsite({
    lighthouse: null,
    cruxGoodShares: null,
    appRating: null,
    appRatingCount: null,
    quoteFlow: null,
  });
  check("no components -> null (never a fabricated 0)", nothing === null);
}

console.log("measured-property maps");
{
  check("every brand has a website", BRANDS.every(b => BRAND_WEBSITES[b]?.startsWith("https://")));
  check("every brand has a pinned app id", BRANDS.every(b => Number.isInteger(BRAND_APPSTORE_IDS[b])));
  check("app ids are unique",
    new Set(Object.values(BRAND_APPSTORE_IDS)).size === BRANDS.length);
}

console.log("generated snapshot");
if (!WEBSITE_SNAPSHOT) {
  console.log("  SKIPPED — snapshot is null (refresh_website.ts not yet run; needs Google API key)");
} else {
  const entries = Object.entries(WEBSITE_SNAPSHOT.brands) as Array<
    [Brand, NonNullable<(typeof WEBSITE_SNAPSHOT.brands)[Brand]>]
  >;
  check("coverage floor: >= 10 of 13 brands", entries.length >= 10, entries.length);
  check("retrievedAt is an ISO date", /^\d{4}-\d{2}-\d{2}$/.test(WEBSITE_SNAPSHOT.retrievedAt));

  for (const [brand, { raw, metric }] of entries) {
    // Independent recomputation — deliberately NOT scoreWebsite().
    const comps: Array<[number, number]> = []; // [value, weight]
    if (raw.lighthouse !== null) comps.push([raw.lighthouse, WEBSITE_COMPONENT_WEIGHTS.lighthouse]);
    const shares = raw.cruxGoodShares
      ? ([raw.cruxGoodShares.lcp, raw.cruxGoodShares.inp, raw.cruxGoodShares.cls].filter(
          (v): v is number => v !== null,
        ))
      : [];
    if (shares.length > 0) {
      comps.push([
        (shares.reduce((a, b) => a + b, 0) / shares.length) * 100,
        WEBSITE_COMPONENT_WEIGHTS.crux,
      ]);
    }
    if (raw.appRating !== null) comps.push([raw.appRating * 20, WEBSITE_COMPONENT_WEIGHTS.app]);
    if (raw.quoteFlow) {
      const path = raw.quoteFlow.zipOnHomepage || raw.quoteFlow.clicksToQuote === 0
        ? 100 : raw.quoteFlow.clicksToQuote === 1 ? 70 : 40;
      const speed = Math.max(0, Math.min(100, (100 * (30_000 - raw.quoteFlow.msToQuoteStart)) / 25_000));
      comps.push([0.6 * path + 0.4 * speed, WEBSITE_COMPONENT_WEIGHTS.quoteFlow]);
    }

    const wTotal = comps.reduce((a, [, w]) => a + w, 0);
    const expected = Math.round(comps.reduce((a, [v, w]) => a + v * w, 0) / wTotal);
    check(`${brand}: stored score matches independent recomputation`, metric.value === expected, {
      stored: metric.value,
      expected,
    });
    check(`${brand}: score in [0,100]`, metric.value >= 0 && metric.value <= 100, metric.value);
    check(`${brand}: tier digital, scope national, never seed`,
      metric.sourceTier === "digital" && metric.scope === "national");
    // Confidence keys on the three measured-data components; a blocked
    // quote-flow probe is disclosed but doesn't downgrade confidence.
    const corePresent =
      raw.lighthouse !== null && shares.length > 0 && raw.appRating !== null;
    check(`${brand}: confidence honest (${metric.confidence})`,
      corePresent ? metric.confidence === "high" : metric.confidence !== "high");
    // Renormalization must be disclosed when an ACTIVE (weight > 0)
    // component is missing — dormant components don't count.
    const activeCount = Object.values(WEBSITE_COMPONENT_WEIGHTS).filter(w => w > 0).length;
    const activePresent = comps.filter(([, w]) => w > 0).length;
    if (activePresent < activeCount) {
      check(`${brand}: note discloses renormalization`, /renormalized/.test(metric.note ?? ""));
    }
    if (raw.quoteFlow && WEBSITE_COMPONENT_WEIGHTS.quoteFlow > 0) {
      check(`${brand}: note cites the quote-start measurement`, /Quote start:/.test(metric.note ?? ""));
    }
  }

  for (const brand of BRANDS) {
    if (!WEBSITE_SNAPSHOT.brands[brand]) {
      console.log(`  NOTE  ${brand} omitted from snapshot (no measurable components on refresh)`);
    }
  }
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
