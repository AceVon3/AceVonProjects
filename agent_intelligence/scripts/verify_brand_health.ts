// Phase 1 verification for the Brand Health calc layer + seed snapshot.
// Run: npx tsx scripts/verify_brand_health.ts
//
// Proves (rather than assumes):
// 1. normalizeWeights: totals exactly 100, clamps negatives, all-zero → defaults.
// 2. calculateBrandHealth matches hand-computed values (incl. the build
//    manual's GEICO example: 88/75/90/92 @ 30/25/20/25 → 86).
// 3. Missing pillars renormalize instead of poisoning the score.
// 4. classifyScore band edges.
// 5. Seed snapshot covers all 13 brands × all covered states × all range
//    keys, every metric is tier "seed" and in [0,100], national pillars are
//    scope "national".

import { BRANDS, COVERED_STATES } from "../src/lib/constants";
import {
  BH_RANGE_KEYS,
  DEFAULT_WEIGHTS,
  calculateBrandHealth,
  classifyScore,
  normalizeWeights,
  PILLAR_KEYS,
  resolvePillars,
} from "../src/lib/brandHealth";
import { BRAND_HEALTH_SNAPSHOT } from "../src/lib/brandHealthData";

let failures = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("normalizeWeights");
{
  const sum = (w: Record<string, number>) =>
    Object.values(w).reduce((a, b) => a + b, 0);

  const w1 = normalizeWeights({ price: 30, sentiment: 25, search: 20, website: 25 });
  check("identity input unchanged", JSON.stringify(w1) === JSON.stringify(DEFAULT_WEIGHTS));

  const w2 = normalizeWeights({ price: 60, sentiment: 60, search: 40, website: 40 });
  check("over-100 input rescales to total 100", sum(w2) === 100, `total=${sum(w2)}`);
  check("over-100 rescale keeps proportions", w2.price === 30 && w2.search === 20);

  const w3 = normalizeWeights({ price: -10, sentiment: 50, search: 25, website: 25 });
  check("negative clamps to 0", w3.price === 0 && sum(w3) === 100);

  const w4 = normalizeWeights({ price: 0, sentiment: 0, search: 0, website: 0 });
  check("all-zero falls back to defaults", JSON.stringify(w4) === JSON.stringify(DEFAULT_WEIGHTS));

  // Thirds don't divide 100 — rounding drift must be repaired.
  const w5 = normalizeWeights({ price: 1, sentiment: 1, search: 1, website: 0 });
  check("rounding drift repaired to exactly 100", sum(w5) === 100, `total=${sum(w5)}`);
}

console.log("calculateBrandHealth");
{
  // Manual's example carrier: price 88, sentiment 75, search 90, website 92
  // → 0.30*88 + 0.25*75 + 0.20*90 + 0.25*92 = 86.15 → 86
  const r1 = calculateBrandHealth(
    { price: 88, sentiment: 75, search: 90, website: 92 },
    DEFAULT_WEIGHTS,
  );
  check("manual GEICO example → 86", r1?.score === 86, `got ${r1?.score}`);
  check("all four pillars used", r1?.usedPillars.length === 4);

  // Drop price: (75*25 + 90*20 + 92*25) / 70 = 5975/70 = 85.36 → 85
  const r2 = calculateBrandHealth(
    { price: null, sentiment: 75, search: 90, website: 92 },
    DEFAULT_WEIGHTS,
  );
  check("missing price renormalizes → 85", r2?.score === 85, `got ${r2?.score}`);
  check("dropped pillar reported", r2?.droppedPillars.join() === "price");

  const r3 = calculateBrandHealth(
    { price: null, sentiment: null, search: null, website: null },
    DEFAULT_WEIGHTS,
  );
  check("no data → null (never a fabricated score)", r3 === null);

  // Zero-weighted pillar is excluded even when it has data.
  const r4 = calculateBrandHealth(
    { price: 10, sentiment: 80, search: 80, website: 80 },
    { price: 0, sentiment: 40, search: 30, website: 30 },
  );
  check("zero-weight pillar excluded", r4?.score === 80, `got ${r4?.score}`);
}

console.log("classifyScore");
{
  check("85 → excellent", classifyScore(85) === "excellent");
  check("84 → good", classifyScore(84) === "good");
  check("70 → good", classifyScore(70) === "good");
  check("69 → fair", classifyScore(69) === "fair");
  check("55 → fair", classifyScore(55) === "fair");
  check("54 → weak", classifyScore(54) === "weak");
}

console.log("seed snapshot completeness");
{
  const snap = BRAND_HEALTH_SNAPSHOT;
  const brandCount = Object.keys(snap.national).length;
  check(`national covers all ${BRANDS.length} brands`, brandCount === BRANDS.length, `got ${brandCount}`);

  const stateCount = Object.keys(snap.states).length;
  check(
    `states cover all ${COVERED_STATES.length} covered states`,
    stateCount === COVERED_STATES.length,
    `got ${stateCount}`,
  );

  let metricCount = 0;
  let badMetrics = 0;
  const inspect = (m: { value: number; sourceTier: string } | null | undefined) => {
    if (!m) return;
    metricCount++;
    if (m.sourceTier !== "seed" || m.value < 0 || m.value > 100) badMetrics++;
  };
  for (const brand of BRANDS) {
    inspect(snap.national[brand].sentiment);
    inspect(snap.national[brand].website);
    check(
      `${brand} national pillars are scope "national"`,
      snap.national[brand].sentiment?.scope === "national" &&
        snap.national[brand].website?.scope === "national",
    );
  }
  for (const state of Object.keys(snap.states)) {
    for (const brand of BRANDS) {
      for (const range of BH_RANGE_KEYS) {
        inspect(snap.states[state][brand].price[range]);
        inspect(snap.states[state][brand].search[range]);
      }
    }
  }
  check(
    "every seed metric is tier 'seed' with value in [0,100]",
    badMetrics === 0,
    `${badMetrics} bad of ${metricCount}`,
  );
  console.log(`  info  ${metricCount} seed metrics inspected`);

  // End-to-end resolve: every brand in AZ @ 12m must produce a full pillar
  // set and a computable Brand Health.
  for (const brand of BRANDS) {
    const { scores } = resolvePillars(snap.national[brand], snap.states["AZ"][brand], "12m");
    const full = PILLAR_KEYS.every(k => scores[k] !== null);
    const result = calculateBrandHealth(scores, DEFAULT_WEIGHTS);
    check(`AZ/12m/${brand} resolves + scores`, full && result !== null, JSON.stringify(scores));
  }

  // Unknown state → state pillars null, national still present, score still
  // computable from the remaining two (reduced-confidence path).
  const { scores: zz } = resolvePillars(snap.national["GEICO"], snap.states["ZZ"]?.["GEICO"], "12m");
  const zzResult = calculateBrandHealth(zz, DEFAULT_WEIGHTS);
  check(
    "uncovered state degrades to national-only pillars",
    zz.price === null && zz.search === null && zz.sentiment !== null && zzResult !== null,
  );
}

console.log("");
if (failures > 0) {
  console.error(`${failures} check(s) FAILED`);
  process.exit(1);
}
console.log("All Brand Health Phase 1 checks passed.");
