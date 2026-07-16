// Verification for the Customer Sentiment pillar.
// Run: npx tsx scripts/verify_brand_health_sentiment.ts
//
// Layer 1 (always): pure math — ratingsScore mapping, complaintScore
// peer-relative ordering/bounds, volumeScore log curve, blend +
// renormalization, cocode map integrity.
// Layer 2 (when brandHealthSentimentData.ts is non-null): every stored
// metric.value recomputed here with independent arithmetic from the stored
// raw components (including re-deriving the peer cohort from the snapshot
// itself), plus metadata-honesty invariants.

import {
  BRAND_NAIC_COCODES,
  METRO_SAMPLE,
  SENTIMENT_COMPONENT_WEIGHTS,
  complaintScore,
  ratingsScore,
  scoreSentiment,
  volumeScore,
} from "../src/lib/brandHealthSentiment";
import { SENTIMENT_SNAPSHOT } from "../src/lib/brandHealthSentimentData";
import { BRANDS, type Brand } from "../src/lib/constants";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failures++;
    console.error(`  FAIL  ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}
const near = (a: number | null, b: number, eps = 1e-9) => a !== null && Math.abs(a - b) < eps;

console.log("pure math — ratingsScore (3.0->30, 4.8->90 linear, clamped)");
{
  check("3.0 -> 30", near(ratingsScore(3.0), 30));
  check("4.8 -> 90", near(ratingsScore(4.8), 90));
  check("3.9 -> 60 (midpoint)", near(ratingsScore(3.9), 60));
  check("5.0 -> 96.67 (not clamped yet)", near(ratingsScore(5.0), 30 + (2 / 1.8) * 60));
  check("1.0 clamps to 0", ratingsScore(1.0) === 0);
  check("null passthrough", ratingsScore(null) === null);
}

console.log("pure math — complaintScore (peer-relative, lower index is better)");
{
  const cohort = [0.5, 1.0, 2.0, 3.5];
  check("lowest index -> 90", complaintScore(cohort, 0.5) === 90);
  check("highest index -> 30", complaintScore(cohort, 3.5) === 30);
  check("linear between", complaintScore(cohort, 2.0) === 60);
  check("monotonic: fewer complaints never scores lower",
    complaintScore(cohort, 1.0) > complaintScore(cohort, 2.0));
  check("all-equal cohort -> neutral 60", complaintScore([1.5, 1.5], 1.5) === 60);
}

console.log("pure math — volumeScore (log10 scale, 1M cap)");
{
  check("100 reviews -> 33.3", near(volumeScore(100), (2 / 6) * 100));
  check("1M reviews -> 100", near(volumeScore(1_000_000), 100));
  check("100M caps at 100", volumeScore(100_000_000) === 100);
  check("0 -> null (drops out, not zero-confidence)", volumeScore(0) === null);
  check("null passthrough", volumeScore(null) === null);
}

console.log("pure math — blend + renormalization");
{
  const full = scoreSentiment({ ratings: 80, complaints: 60, volume: 50 });
  // 0.45*80 + 0.35*60 + 0.2*50 = 36 + 21 + 10 = 67
  check("full blend 45/35/20", full?.score === 67, full);
  const noRatings = scoreSentiment({ ratings: null, complaints: 60, volume: null });
  check("complaints-only blend = complaints score", noRatings?.score === 60, noRatings);
  check("complaints-only weights 0/100/0",
    noRatings?.usedWeights.ratings === 0 && noRatings?.usedWeights.complaints === 100);
  const noComplaints = scoreSentiment({ ratings: 90, complaints: null, volume: 45 });
  // (90*45 + 45*20) / 65 = (4050 + 900) / 65 = 76.15 -> 76
  check("ratings+volume renormalized", noComplaints?.score === 76, noComplaints);
  check("renormalized weights sum to 100",
    noComplaints!.usedWeights.ratings + noComplaints!.usedWeights.complaints + noComplaints!.usedWeights.volume === 100);
  check("nothing scorable -> null", scoreSentiment({ ratings: null, complaints: null, volume: null }) === null);
}

console.log("measured-entity maps");
{
  check("every brand has a cocode", BRANDS.every(b => Number.isInteger(BRAND_NAIC_COCODES[b]?.cocode)));
  check("cocodes are unique",
    new Set(BRANDS.map(b => BRAND_NAIC_COCODES[b].cocode)).size === BRANDS.length);
  check("every brand names its entity", BRANDS.every(b => BRAND_NAIC_COCODES[b].entity.length > 5));
  check("metro sample has 10 metros", METRO_SAMPLE.length === 10);
}

console.log("generated snapshot");
if (!SENTIMENT_SNAPSHOT) {
  console.log("  SKIPPED — snapshot is null (refresh_sentiment.ts not yet run; needs Places billing)");
} else {
  const entries = Object.entries(SENTIMENT_SNAPSHOT.brands) as Array<
    [Brand, NonNullable<(typeof SENTIMENT_SNAPSHOT.brands)[Brand]>]
  >;
  check("coverage floor: >= 10 of 13 brands", entries.length >= 10, entries.length);
  check("retrievedAt is an ISO date", /^\d{4}-\d{2}-\d{2}$/.test(SENTIMENT_SNAPSHOT.retrievedAt));

  // Re-derive the peer cohort exactly as the refresh script did.
  const cohort = entries
    .map(([, e]) => e.raw.complaintIndex)
    .filter((v): v is number => v !== null);
  const cMin = Math.min(...cohort);
  const cMax = Math.max(...cohort);

  for (const [brand, { raw, metric }] of entries) {
    // Independent recomputation — deliberately NOT the lib functions.
    const comps: Array<[number, number]> = [];
    if (raw.placesRating !== null) {
      comps.push([
        Math.max(0, Math.min(100, 30 + ((raw.placesRating - 3.0) / 1.8) * 60)),
        SENTIMENT_COMPONENT_WEIGHTS.ratings,
      ]);
    }
    if (raw.complaintIndex !== null) {
      const c =
        cMax === cMin ? 60 : Math.round(90 - 60 * ((raw.complaintIndex - cMin) / (cMax - cMin)));
      comps.push([c, SENTIMENT_COMPONENT_WEIGHTS.complaints]);
    }
    if (raw.placesReviewCount !== null && raw.placesReviewCount > 0) {
      comps.push([
        Math.min(100, (Math.log10(raw.placesReviewCount) / 6) * 100),
        SENTIMENT_COMPONENT_WEIGHTS.volume,
      ]);
    }
    const wTotal = comps.reduce((a, [, w]) => a + w, 0);
    const expected = Math.round(comps.reduce((a, [v, w]) => a + v * w, 0) / wTotal);
    check(`${brand}: stored score matches independent recomputation`, metric.value === expected, {
      stored: metric.value,
      expected,
    });
    check(`${brand}: score in [0,100]`, metric.value >= 0 && metric.value <= 100, metric.value);
    check(`${brand}: scope national, never seed`,
      metric.scope === "national" && metric.sourceTier !== "seed");
    const allPresent = comps.length === 3;
    const sparse = raw.placesRating !== null && (raw.placesListingCount ?? 0) < 30;
    check(`${brand}: confidence honest (${metric.confidence})`,
      allPresent && !sparse ? metric.confidence === "high" : metric.confidence !== "high");
    if (!allPresent) {
      check(`${brand}: note discloses renormalization`, /renormalized/.test(metric.note ?? ""));
    }
    if (sparse) {
      check(`${brand}: note discloses sparse listing sample`, /sparse listing sample/.test(metric.note ?? ""));
    }
    if (raw.complaintIndex !== null) {
      check(`${brand}: note cites the NAIC entity`,
        (metric.note ?? "").includes(BRAND_NAIC_COCODES[brand].entity));
    }
  }

  for (const brand of BRANDS) {
    if (!SENTIMENT_SNAPSHOT.brands[brand]) {
      console.log(`  NOTE  ${brand} omitted from snapshot (no measurable components on refresh)`);
    }
  }
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
