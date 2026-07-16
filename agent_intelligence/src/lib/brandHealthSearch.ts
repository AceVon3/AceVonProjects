// Search Interest pillar — shared constants, types, and PURE scoring math
// for the Brand Health tab (the last live pillar; Search was the final seed).
//
// Formula (methodology "Search Interest"): normalized brand search-interest
// by state and period, from a stored monthly series sliced to the selected
// window. Source: DataForSEO Google Ads search volume (licensed feed) — one
// branded keyword per brand, state-scoped, 12 months of history per refresh.
//
// Scoring is peer-relative on LOG volume (share-of-search spans three orders
// of magnitude — Progressive ~18k/mo vs Encompass ~70/mo in AZ — so linear
// ranking would pin everyone but the leader to the floor): most-searched
// brand in the state+window → 90, least → 30, linear in log space. Same
// philosophy as the Price pillar's peer ranking.
//
// No I/O here. scripts/brand_health/refresh_search.ts fetches and writes
// src/lib/brandHealthSearchData.ts; computeSearchMetrics() slices that
// snapshot per range at request time (server-side, like the price pillar).

import { BRANDS, type Brand } from "./constants";
import {
  BH_RANGE_KEYS,
  type BhRangeKey,
  type SourceBackedMetric,
} from "./brandHealth";
import { SEARCH_SNAPSHOT } from "./brandHealthSearchData";

// ---------------------------------------------------------------------------
// Branded keywords + state names
// ---------------------------------------------------------------------------

// One branded insurance-intent keyword per brand. Default construction is
// "<brand> insurance" (bare brand names like "progressive"/"travelers"/
// "farmers" are generic words); COUNTRY Financial keeps its full brand name —
// "country financial insurance" is not a query people type.
export const BRAND_KEYWORDS: Record<Brand, string> = {
  Allstate: "allstate insurance",
  "American Family": "american family insurance",
  "COUNTRY Financial": "country financial",
  Encompass: "encompass insurance",
  Farmers: "farmers insurance",
  GEICO: "geico insurance",
  "Liberty Mutual": "liberty mutual insurance",
  Nationwide: "nationwide insurance",
  Progressive: "progressive insurance",
  Safeco: "safeco insurance",
  "State Farm": "state farm insurance",
  Travelers: "travelers insurance",
  USAA: "usaa insurance",
};

// Abbreviation → full name, as DataForSEO's location registry spells them
// ("Arizona,United States"). Covers every state that can appear in
// COVERED_STATES; the refresh script resolves codes by exact name match.
export const STATE_FULL_NAMES: Record<string, string> = {
  AK: "Alaska", AL: "Alabama", AR: "Arkansas", AZ: "Arizona",
  CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", IA: "Iowa", ID: "Idaho",
  IL: "Illinois", IN: "Indiana", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", MA: "Massachusetts", MD: "Maryland", ME: "Maine",
  MI: "Michigan", MN: "Minnesota", MO: "Missouri", MS: "Mississippi",
  MT: "Montana", NC: "North Carolina", ND: "North Dakota", NE: "Nebraska",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NV: "Nevada",
  NY: "New York", OH: "Ohio", OK: "Oklahoma", OR: "Oregon",
  PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VA: "Virginia", VT: "Vermont", WA: "Washington", WI: "Wisconsin",
  WV: "West Virginia", WY: "Wyoming",
};

// ---------------------------------------------------------------------------
// Generated snapshot shape
// ---------------------------------------------------------------------------

// Compact storage: the month axis is stored ONCE (sorted ascending,
// "YYYY-MM"), and each (state, brand) holds a volume array aligned to it.
// null in a volume slot = the API returned no data for that month.
export type SearchSnapshot = {
  retrievedAt: string;
  months: string[]; // e.g. ["2025-07", ..., "2026-06"], ascending
  states: Partial<Record<string, Partial<Record<Brand, Array<number | null>>>>>;
};

// ---------------------------------------------------------------------------
// Range → month-set resolution
// ---------------------------------------------------------------------------

// Slices the month axis for a range key, anchored to the LATEST month in the
// series (Google Ads data lags the calendar by ~1 month; anchoring to the
// series keeps windows aligned with what was actually measured). Quarters are
// calendar quarters of the latest month's year; a quarter with no measured
// months yet resolves to [] → no metrics → the UI's honest no-data path.
export function rangeMonthIndexes(months: string[], range: BhRangeKey): number[] {
  if (months.length === 0) return [];
  const all = months.map((_, i) => i);
  const year = months[months.length - 1].slice(0, 4);
  switch (range) {
    case "3m": return all.slice(-3);
    case "6m": return all.slice(-6);
    case "12m": return all.slice(-12);
    case "ytd": return all.filter(i => months[i].startsWith(`${year}-`));
    case "q1": case "q2": case "q3": case "q4": {
      const q = Number(range[1]);
      const inQuarter = (m: string) =>
        m.startsWith(`${year}-`) && Math.ceil(Number(m.slice(5, 7)) / 3) === q;
      return all.filter(i => inQuarter(months[i]));
    }
  }
}

// ---------------------------------------------------------------------------
// Pure scoring
// ---------------------------------------------------------------------------

// Peer-relative on log10(volume + 1): highest branded demand → 90, lowest →
// 30, linear in log space. All-equal (or single-brand) → neutral 60.
export function scoreSearchVolumes(volumes: number[], mine: number): number {
  const logs = volumes.map(v => Math.log10(v + 1));
  const min = Math.min(...logs);
  const max = Math.max(...logs);
  if (max === min) return 60;
  return Math.round(30 + 60 * ((Math.log10(mine + 1) - min) / (max - min)));
}

export type SearchPillarByBrand = Partial<
  Record<Brand, Partial<Record<BhRangeKey, SourceBackedMetric>>>
>;

const cache = new Map<string, SearchPillarByBrand>();

// One state's Search pillar, every range, from the generated snapshot.
// Returns {} when the snapshot hasn't been generated yet (route falls back
// to seed) or the state isn't in it.
export function computeSearchMetrics(state: string): SearchPillarByBrand {
  const hit = cache.get(state);
  if (hit) return hit;

  const snapshot = SEARCH_SNAPSHOT;
  const stateData = snapshot?.states[state];
  if (!snapshot || !stateData) return {};

  const latestMonth = snapshot.months[snapshot.months.length - 1];
  const result: SearchPillarByBrand = {};

  for (const range of BH_RANGE_KEYS) {
    const idxs = rangeMonthIndexes(snapshot.months, range);
    if (idxs.length === 0) continue;

    // Sum each brand's volume over the window; brands with no series (or all
    // null months) drop out rather than scoring a fabricated zero.
    const sums: Array<{ brand: Brand; volume: number }> = [];
    for (const brand of BRANDS) {
      const series = stateData[brand];
      if (!series) continue;
      const measured = idxs.map(i => series[i]).filter((v): v is number => v !== null);
      if (measured.length === 0) continue;
      sums.push({ brand, volume: measured.reduce((a, b) => a + b, 0) });
    }
    if (sums.length === 0 || sums.every(s => s.volume === 0)) continue;

    const volumes = sums.map(s => s.volume);
    const total = volumes.reduce((a, b) => a + b, 0);
    const peers = sums.length;
    const monthsSpanned = idxs.length;

    for (const s of sums) {
      const share = total === 0 ? 0 : (s.volume / total) * 100;
      const perMonth = Math.round(s.volume / monthsSpanned);
      const metric: SourceBackedMetric = {
        value: scoreSearchVolumes(volumes, s.volume),
        sourceTier: "licensed",
        sourceName: "DataForSEO (Google Ads search volume)",
        sourceUrl: "https://dataforseo.com/",
        dataAsOf: `${latestMonth}-01`,
        retrievedAt: snapshot.retrievedAt,
        confidence: peers >= 3 ? "medium" : "low",
        refreshCadence: "monthly",
        scope: "state",
        note:
          `Branded search demand: ~${perMonth.toLocaleString("en-US")}/mo ` +
          `("${BRAND_KEYWORDS[s.brand]}") — ${share.toFixed(1)}% of ${peers}-brand demand ` +
          `in this window, ranked log-scale vs peers. ` +
          `Series through ${latestMonth} (Google Ads data lags ~1 month).`,
      };
      (result[s.brand] ??= {})[range] = metric;
    }
  }

  cache.set(state, result);
  return result;
}
