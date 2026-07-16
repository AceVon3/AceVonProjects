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
  scoreWebsite,
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

console.log("pure math — blend + renormalization");
{
  const full = scoreWebsite({
    lighthouse: 80,
    cruxGoodShares: { lcp: 0.9, inp: 0.8, cls: 0.7 }, // crux = 80
    appRating: 4.5, // app = 90
    appRatingCount: 1000,
  });
  // 0.5*80 + 0.3*80 + 0.2*90 = 40 + 24 + 18 = 82
  check("full blend 50/30/20", full?.score === 82, full);
  check("full blend reports weights 50/30/20",
    full?.usedWeights.lighthouse === 50 && full?.usedWeights.crux === 30 && full?.usedWeights.app === 20);

  const noApp = scoreWebsite({
    lighthouse: 80,
    cruxGoodShares: { lcp: 0.9, inp: 0.8, cls: 0.7 },
    appRating: null,
    appRatingCount: null,
  });
  // (80*50 + 80*30) / 80 = 80
  check("missing app renormalizes over lighthouse+crux", noApp?.score === 80, noApp);
  check("renormalized weights sum to 100",
    (noApp!.usedWeights.lighthouse + noApp!.usedWeights.crux + noApp!.usedWeights.app) === 100,
    noApp?.usedWeights);

  const appOnly = scoreWebsite({
    lighthouse: null,
    cruxGoodShares: null,
    appRating: 3.46,
    appRatingCount: 99,
  });
  check("app-only blend = rating*20 rounded", appOnly?.score === Math.round(3.46 * 20), appOnly);

  const nothing = scoreWebsite({
    lighthouse: null,
    cruxGoodShares: null,
    appRating: null,
    appRatingCount: null,
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

    const wTotal = comps.reduce((a, [, w]) => a + w, 0);
    const expected = Math.round(comps.reduce((a, [v, w]) => a + v * w, 0) / wTotal);
    check(`${brand}: stored score matches independent recomputation`, metric.value === expected, {
      stored: metric.value,
      expected,
    });
    check(`${brand}: score in [0,100]`, metric.value >= 0 && metric.value <= 100, metric.value);
    check(`${brand}: tier digital, scope national, never seed`,
      metric.sourceTier === "digital" && metric.scope === "national");
    const allPresent = comps.length === 3;
    check(`${brand}: confidence honest (${metric.confidence})`,
      allPresent ? metric.confidence === "high" : metric.confidence !== "high");
    if (!allPresent) {
      check(`${brand}: note discloses renormalization`, /renormalized/.test(metric.note ?? ""));
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
