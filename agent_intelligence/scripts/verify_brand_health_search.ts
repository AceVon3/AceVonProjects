// Verification for the Search Interest pillar.
// Run: npx tsx scripts/verify_brand_health_search.ts
//
// Layer 1 (always): pure math — rangeMonthIndexes window resolution against
// a synthetic month axis, scoreSearchVolumes log-scale ordering/bounds,
// keyword/state map integrity.
// Layer 2 (when brandHealthSearchData.ts is non-null): computeSearchMetrics
// output for sample states recomputed HERE with independent arithmetic from
// the stored raw series (own window slicing, own log scoring), plus
// metadata-honesty invariants.

import {
  BRAND_KEYWORDS,
  STATE_FULL_NAMES,
  computeSearchMetrics,
  rangeMonthIndexes,
  scoreSearchVolumes,
  trendDirection,
} from "../src/lib/brandHealthSearch";
import { SEARCH_SNAPSHOT } from "../src/lib/brandHealthSearchData";
import { BH_RANGE_KEYS, type BhRangeKey } from "../src/lib/brandHealth";
import { BRANDS, COVERED_STATES, type Brand } from "../src/lib/constants";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failures++;
    console.error(`  FAIL  ${name}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

console.log("pure math — rangeMonthIndexes");
{
  // Axis: Jul 2025 .. Jun 2026 (the shape a mid-July 2026 refresh produces).
  const months = [
    "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06",
  ];
  check("3m = last 3", rangeMonthIndexes(months, "3m").map(i => months[i]).join() === "2026-04,2026-05,2026-06");
  check("6m = last 6", rangeMonthIndexes(months, "6m").length === 6);
  check("12m = everything", rangeMonthIndexes(months, "12m").length === 12);
  check("ytd = latest year's months", rangeMonthIndexes(months, "ytd").map(i => months[i]).every(m => m.startsWith("2026-")) && rangeMonthIndexes(months, "ytd").length === 6);
  check("q1 = Jan-Mar of latest year", rangeMonthIndexes(months, "q1").map(i => months[i]).join() === "2026-01,2026-02,2026-03");
  check("q2 = Apr-Jun", rangeMonthIndexes(months, "q2").length === 3);
  check("q3 not yet measured -> empty", rangeMonthIndexes(months, "q3").length === 0);
  check("q4 not yet measured -> empty", rangeMonthIndexes(months, "q4").length === 0);
  check("2025 months never leak into ytd", !rangeMonthIndexes(months, "ytd").some(i => months[i].startsWith("2025-")));
  check("empty axis -> empty everywhere", BH_RANGE_KEYS.every(r => rangeMonthIndexes([], r).length === 0));
}

console.log("pure math — scoreSearchVolumes (log-scale peer rank)");
{
  const vols = [70, 1000, 18100];
  check("highest volume -> 90", scoreSearchVolumes(vols, 18100) === 90);
  check("lowest volume -> 30", scoreSearchVolumes(vols, 70) === 30);
  const mid = scoreSearchVolumes(vols, 1000);
  check("middle lands between on log scale", mid > 30 && mid < 90, mid);
  // log10(1001)≈3.0004; between log10(71)≈1.85 and log10(18101)≈4.26 → ~59
  check("log spacing (1000 vs 70/18100 ≈ 59)", Math.abs(mid - 59) <= 1, mid);
  check("monotonic", scoreSearchVolumes(vols, 1000) < scoreSearchVolumes(vols, 18100));
  check("all-equal -> neutral 60", scoreSearchVolumes([500, 500], 500) === 60);
  check("zero volume floors at 30 (with peers)", scoreSearchVolumes([0, 1000], 0) === 30);
}

console.log("pure math — trendDirection (display-only, ±10% band)");
{
  // 12-slot series; window = last 3 (indexes 9-11), prior period = 6-8.
  const flat = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];
  const t1 = trendDirection(flat, [9, 10, 11]);
  check("flat series -> stable via prior period",
    t1?.direction === "stable" && t1?.basis === "prior-period" && t1?.deltaPct === 0, t1);

  const surge = [...flat.slice(0, 9), 150, 150, 150];
  const t2 = trendDirection(surge, [9, 10, 11]);
  check("+50% vs prior 3 months -> growing", t2?.direction === "growing" && Math.abs(t2.deltaPct - 50) < 1e-9, t2);

  const drop = [...flat.slice(0, 9), 85, 85, 85];
  const t3 = trendDirection(drop, [9, 10, 11]);
  check("-15% -> declining", t3?.direction === "declining", t3);

  const inBand = [...flat.slice(0, 9), 109, 109, 109];
  check("+9% stays inside the stable band", trendDirection(inBand, [9, 10, 11])?.direction === "stable");

  // Full 12m window has no prior period -> intra-window halves.
  const ramp = [50, 50, 50, 50, 50, 50, 100, 100, 100, 100, 100, 100];
  const t4 = trendDirection(ramp, ramp.map((_, i) => i));
  check("12m window falls back to intra-window halves",
    t4?.basis === "intra-window" && t4?.direction === "growing" && Math.abs(t4.deltaPct - 100) < 1e-9, t4);

  check("all-null window -> null", trendDirection([null, null, null, null], [2, 3]) === null);
  const zeroPrior = [0, 0, 0, 0, 0, 0, 0, 0, 0, 40, 40, 40];
  check("zero prior + demand now -> growing", trendDirection(zeroPrior, [9, 10, 11])?.direction === "growing");
}

console.log("keyword + state maps");
{
  check("every brand has a keyword", BRANDS.every(b => BRAND_KEYWORDS[b]?.length > 3));
  check("keywords unique", new Set(Object.values(BRAND_KEYWORDS)).size === BRANDS.length);
  check("every covered state has a full name", COVERED_STATES.every(st => STATE_FULL_NAMES[st]));
}

console.log("generated snapshot");
if (!SEARCH_SNAPSHOT) {
  console.log("  SKIPPED — snapshot is null (refresh_search.ts not yet run)");
} else {
  const snap = SEARCH_SNAPSHOT;
  check("months axis ascending, <= 12", snap.months.length <= 12 && [...snap.months].sort().join() === snap.months.join());
  const stateCount = Object.keys(snap.states).length;
  check(`coverage floor: >= 35 states (${stateCount})`, stateCount >= 35);
  check("every stored series aligns to the month axis",
    Object.values(snap.states).every(sd =>
      Object.values(sd!).every(series => series!.length === snap.months.length)));

  // Independent recomputation for a sample of states across ranges.
  for (const state of ["AZ", "GA", "CA", "NY"].filter(s => snap.states[s])) {
    const computed = computeSearchMetrics(state);
    const stateData = snap.states[state]!;
    for (const range of ["3m", "12m", "ytd", "q1", "q3"] as BhRangeKey[]) {
      // Own window logic: month indexes by direct date arithmetic.
      const year = snap.months[snap.months.length - 1].slice(0, 4);
      let idxs: number[];
      if (range === "3m") idxs = snap.months.map((_, i) => i).slice(-3);
      else if (range === "12m") idxs = snap.months.map((_, i) => i);
      else if (range === "ytd") idxs = snap.months.map((_, i) => i).filter(i => snap.months[i] >= `${year}-01`);
      else {
        const q = Number(range[1]);
        idxs = snap.months
          .map((_, i) => i)
          .filter(i => snap.months[i].startsWith(year) && Math.floor((Number(snap.months[i].slice(5)) - 1) / 3) + 1 === q);
      }
      // Own sums + own log scoring.
      const sums: Array<[Brand, number]> = [];
      for (const brand of BRANDS) {
        const series = stateData[brand];
        if (!series) continue;
        const vals = idxs.map(i => series[i]).filter((v): v is number => v !== null);
        if (vals.length > 0) sums.push([brand, vals.reduce((a, b) => a + b, 0)]);
      }
      const windowEmpty = idxs.length === 0 || sums.length === 0 || sums.every(([, v]) => v === 0);
      if (windowEmpty) {
        check(`${state}/${range}: empty window -> no metrics`,
          BRANDS.every(b => computed[b]?.[range] === undefined));
        continue;
      }
      const logs = sums.map(([, v]) => Math.log10(v + 1));
      const lMin = Math.min(...logs);
      const lMax = Math.max(...logs);
      let allMatch = true;
      for (const [brand, vol] of sums) {
        const expected =
          lMax === lMin ? 60 : Math.round(30 + 60 * ((Math.log10(vol + 1) - lMin) / (lMax - lMin)));
        const stored = computed[brand]?.[range];
        if (!stored || stored.value !== expected) {
          allMatch = false;
          check(`${state}/${range}/${brand}: score mismatch`, false, {
            stored: stored?.value, expected,
          });
        }
      }
      if (allMatch) {
        check(`${state}/${range}: all ${sums.length} brand scores match independent recomputation`, true);
      }
      // Metadata honesty on one sample metric.
      const sample = computed[sums[0][0]]?.[range];
      check(`${state}/${range}: tier licensed, scope state, keyword cited`,
        sample?.sourceTier === "licensed" && sample?.scope === "state" &&
        /Branded search demand/.test(sample?.note ?? ""));
      // Trend: every metric with >= 2 window months should carry a direction
      // that matches an independent recomputation, disclosed in the note.
      if (idxs.length >= 2 && sample) {
        const series = stateData[sums[0][0]]!;
        const indep = trendDirection(series, idxs);
        check(`${state}/${range}: trend matches recomputation and is disclosed`,
          sample.trend === indep?.direction &&
          (indep === null || /Demand (growing|stable|declining)/.test(sample.note ?? "")),
          { stored: sample.trend, expected: indep?.direction });
      }
    }
  }
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
