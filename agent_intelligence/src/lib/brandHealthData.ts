// TEMPORARY SEED SNAPSHOT — Brand Health Phase 1.
//
// This file will be OVERWRITTEN by scripts/brand_health/refresh.ts (Phase 5)
// with a real generated snapshot. Until then it builds a deterministic seed
// snapshot at module load so the tab UI (Phase 2) can be developed against
// the exact production shape: all 13 brands, all covered states, per-range
// price/search, national sentiment/website.
//
// Every seed metric is sourceTier "seed", confidence "low", isEstimated —
// the UI's source badges will therefore look "worst case" during
// development, which is the right default to design against.

import { BRANDS, COVERED_STATES, type Brand } from "./constants";
import {
  BH_RANGE_KEYS,
  type BhRangeKey,
  type BrandHealthSnapshot,
  type BrandNationalMetrics,
  type BrandStateMetrics,
  type SourceBackedMetric,
} from "./brandHealth";

// Per-brand national baselines [price, sentiment, search, website], loosely
// following the example values in the dashboard_v2 build manual for the
// brands it covered; the manual didn't cover Safeco/Encompass/COUNTRY, those
// baselines are invented (it's seed data — realism only needs to be visual).
const SEED_BASELINES: Record<Brand, [number, number, number, number]> = {
  Allstate: [75, 68, 85, 80],
  "American Family": [79, 78, 65, 82],
  "COUNTRY Financial": [74, 76, 55, 70],
  Encompass: [62, 60, 50, 65],
  Farmers: [70, 65, 75, 75],
  GEICO: [88, 75, 90, 92],
  "Liberty Mutual": [65, 60, 70, 70],
  Nationwide: [77, 70, 70, 80],
  Progressive: [85, 72, 95, 90],
  Safeco: [68, 66, 60, 72],
  "State Farm": [82, 80, 90, 85],
  Travelers: [72, 70, 65, 78],
  USAA: [90, 85, 80, 88],
};

// Deterministic per-(brand,state,range) jitter so state-scoped pillars vary
// plausibly without Math.random (seed must be stable across renders/builds).
function jitter(key: string, spread: number): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % (spread * 2 + 1)) - spread; // integer in [-spread, +spread]
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}

const SEED_DATES = { dataAsOf: "2026-06-30", retrievedAt: "2026-07-01" };

function seedMetric(
  value: number,
  scope: "state" | "national",
  note: string,
): SourceBackedMetric {
  return {
    value: clamp(value),
    sourceTier: "seed",
    sourceName: "Seed data (Phase 1 placeholder)",
    confidence: "low",
    refreshCadence: "monthly",
    isEstimated: true,
    scope,
    note,
    ...SEED_DATES,
  };
}

function buildSnapshot(): BrandHealthSnapshot {
  const national = Object.fromEntries(
    BRANDS.map(brand => {
      const [, sentiment, , website] = SEED_BASELINES[brand];
      const entry: BrandNationalMetrics = {
        sentiment: seedMetric(sentiment, "national", "National measurement — same value in every state."),
        website: seedMetric(website, "national", "National measurement — same value in every state."),
      };
      return [brand, entry];
    }),
  ) as Record<Brand, BrandNationalMetrics>;

  const states: BrandHealthSnapshot["states"] = {};
  for (const state of COVERED_STATES) {
    states[state] = Object.fromEntries(
      BRANDS.map(brand => {
        const [price, , search] = SEED_BASELINES[brand];
        const entry: BrandStateMetrics = { price: {}, search: {} };
        for (const range of BH_RANGE_KEYS) {
          entry.price[range as BhRangeKey] = seedMetric(
            price + jitter(`${brand}|${state}|${range}|price`, 6),
            "state",
            "Placeholder — real value derives from filed rate momentum.",
          );
          entry.search[range as BhRangeKey] = seedMetric(
            search + jitter(`${brand}|${state}|${range}|search`, 6),
            "state",
            "Placeholder — real value derives from state search-interest data.",
          );
        }
        return [brand, entry];
      }),
    ) as Record<Brand, BrandStateMetrics>;
  }

  return {
    generatedAt: "2026-07-01T00:00:00Z",
    dataMonth: "2026-07",
    dataYear: 2026,
    national,
    states,
  };
}

export const BRAND_HEALTH_SNAPSHOT: BrandHealthSnapshot = buildSnapshot();
