// Brand Health (v2 feature — was explicitly out of scope in spec.md v1).
// Types + pure calculation layer. No I/O here: the tab reads a pre-generated
// snapshot (src/lib/brandHealthData.ts, written monthly by
// scripts/brand_health/refresh.ts) and this module turns pillar scores +
// user weights into a composite 0-100 Brand Health score.
//
// Design rules (from the dashboard_v2 manuals, adapted to this app):
// - Brand Health is NEVER stored — always computed from current weights.
// - Every metric value carries source metadata (SourceBackedMetric) so the
//   UI can honestly show "Data as of", "Retrieved", confidence, and scope.
// - Sentiment/Website are NATIONAL measurements applied across states;
//   Price/Search are state-scoped. `scope` makes that visible, we never
//   fake state variation.
// - A missing pillar (e.g. no filing data for a brand in a state) drops out
//   and the remaining weights renormalize — no fabricated scores.

import { type Brand } from "./constants";

// ---------------------------------------------------------------------------
// Source metadata envelope
// ---------------------------------------------------------------------------

// Tiers from the integration manual. "official" covers regulatory data —
// including our own SERFF-scraped filings (they ARE the official filings).
export type SourceTier =
  | "official"    // NAIC, state DOI, SERFF filings (incl. our scrape)
  | "licensed"    // paid feeds (Quadrant, RateWatch, J.D. Power) — none in v1
  | "platform"    // Google Places, Yelp, Trustpilot, app stores
  | "digital"     // CrUX, PageSpeed, synthetic tests
  | "web"         // public editorial context (NerdWallet etc.) — estimate only
  | "ai_derived"  // AI synthesis from stored records — none in v1
  | "seed";       // placeholder data, must never ship as real

export type Confidence = "high" | "medium" | "low";

export type SourceBackedMetric = {
  value: number;              // pillar scores are always 0-100
  sourceTier: SourceTier;
  sourceName: string;
  sourceUrl?: string;
  dataAsOf: string;           // ISO date the underlying data describes
  retrievedAt: string;        // ISO date we fetched/computed it
  confidence: Confidence;
  // How often the SOURCE meaningfully changes — not how often we refresh.
  // (We refresh monthly regardless; annual data stays labeled annual.)
  refreshCadence: "daily" | "weekly" | "monthly" | "quarterly" | "annual";
  isEstimated?: boolean;
  // National metrics (sentiment, website) are the same number in every
  // state and the UI must say so rather than imply state precision.
  scope: "state" | "national";
  note?: string;
};

// ---------------------------------------------------------------------------
// Date ranges
// ---------------------------------------------------------------------------

// Range keys for the tab's date filter. Price is computed per-range at
// refresh time from filing effective dates; Search is sliced from a stored
// monthly series. Sentiment/Website are point-in-time and ignore the range
// (their `scope`/`note` metadata says so). Quarters mean quarters of the
// snapshot's dataYear — the refresh script resolves actual date windows.
export const BH_RANGE_KEYS = ["3m", "6m", "12m", "ytd", "q1", "q2", "q3", "q4"] as const;
export type BhRangeKey = (typeof BH_RANGE_KEYS)[number];
export const DEFAULT_BH_RANGE: BhRangeKey = "12m";

export const BH_RANGE_LABELS: Record<BhRangeKey, string> = {
  "3m": "3M",
  "6m": "6M",
  "12m": "12M",
  ytd: "YTD",
  q1: "Q1",
  q2: "Q2",
  q3: "Q3",
  q4: "Q4",
};

// ---------------------------------------------------------------------------
// Pillars + weights
// ---------------------------------------------------------------------------

export const PILLAR_KEYS = ["price", "sentiment", "search", "website"] as const;
export type PillarKey = (typeof PILLAR_KEYS)[number];

export const PILLAR_LABELS: Record<PillarKey, string> = {
  price: "Price Competitiveness",
  sentiment: "Customer Sentiment",
  search: "Search Interest",
  website: "Website Performance",
};

// Weights are integer percents that sum to 100.
export type Weights = Record<PillarKey, number>;

// Default formula from the manuals:
// Brand Health = 30% Price + 25% Sentiment + 20% Search + 25% Website
export const DEFAULT_WEIGHTS: Weights = {
  price: 30,
  sentiment: 25,
  search: 20,
  website: 25,
};

// Clamp negatives to 0 and rescale so the total is exactly 100. All-zero
// input falls back to DEFAULT_WEIGHTS (a zeroed slider set is a reset, not
// a request for an unweightable formula). Integer output: round each, then
// push any rounding drift onto the largest weight so the total stays 100.
export function normalizeWeights(input: Weights): Weights {
  const clamped = PILLAR_KEYS.map(k => Math.max(0, input[k]));
  const total = clamped.reduce((a, b) => a + b, 0);
  if (total === 0) return { ...DEFAULT_WEIGHTS };

  const scaled = clamped.map(v => (v / total) * 100);
  const rounded = scaled.map(v => Math.round(v));
  const drift = 100 - rounded.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    // Give the drift (±1 or ±2 at worst) to the largest weight — least
    // visible distortion, and deterministic.
    let iMax = 0;
    for (let i = 1; i < rounded.length; i++) {
      if (rounded[i] > rounded[iMax]) iMax = i;
    }
    rounded[iMax] += drift;
  }
  return {
    price: rounded[0],
    sentiment: rounded[1],
    search: rounded[2],
    website: rounded[3],
  };
}

// ---------------------------------------------------------------------------
// Brand Health composite
// ---------------------------------------------------------------------------

export type PillarScores = Record<PillarKey, number | null>;

export type BrandHealthResult = {
  score: number;               // 0-100, rounded
  usedPillars: PillarKey[];    // pillars that contributed
  droppedPillars: PillarKey[]; // pillars missing data (weights renormalized)
};

// Weighted average over the AVAILABLE pillars. Missing pillars drop out and
// the remaining weights renormalize (12-month State Farm with no search data
// is scored on price+sentiment+website at 30/25/25 → renormalized to 100).
// Returns null when nothing is scorable — the UI shows "insufficient data",
// never a made-up number.
export function calculateBrandHealth(
  pillars: PillarScores,
  weights: Weights,
): BrandHealthResult | null {
  const used = PILLAR_KEYS.filter(k => pillars[k] !== null && weights[k] > 0);
  const effectiveTotal = used.reduce((sum, k) => sum + weights[k], 0);
  if (used.length === 0 || effectiveTotal === 0) return null;

  const raw =
    used.reduce((sum, k) => sum + (pillars[k] as number) * weights[k], 0) /
    effectiveTotal;

  return {
    score: Math.round(raw),
    usedPillars: used,
    droppedPillars: PILLAR_KEYS.filter(k => !used.includes(k)),
  };
}

// Badge classification (docs use Excellent/Good; we add the lower bands so
// weak brands get an honest label instead of no label).
export type ScoreClass = "excellent" | "good" | "fair" | "weak";

export function classifyScore(score: number): ScoreClass {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 55) return "fair";
  return "weak";
}

// ---------------------------------------------------------------------------
// Snapshot shape (what refresh.ts writes and the tab reads)
// ---------------------------------------------------------------------------

// National pillars are stored once per brand; state pillars per brand+state.
// Price/Search store one metric per range key (missing key = no data for
// that window). Records are keyed by Brand so TypeScript forces the snapshot
// to cover all 13 brands — a refresh that drops a brand fails to compile.
export type BrandNationalMetrics = {
  sentiment: SourceBackedMetric | null;
  website: SourceBackedMetric | null;
};

export type BrandStateMetrics = {
  price: Partial<Record<BhRangeKey, SourceBackedMetric>>;
  search: Partial<Record<BhRangeKey, SourceBackedMetric>>;
};

export type BrandHealthSnapshot = {
  generatedAt: string; // ISO timestamp of the refresh run
  dataMonth: string;   // "2026-07" — what the tab's "Data as of" band shows
  dataYear: number;    // year the q1-q4 range keys refer to
  national: Record<Brand, BrandNationalMetrics>;
  // state code → brand → metrics. States absent = no data (UI: not covered).
  states: Record<string, Record<Brand, BrandStateMetrics>>;
};

// Resolve the four pillar values for one brand/state/range out of a
// snapshot. This is the single place the "national pillars ignore the
// range" rule lives.
export function getPillarScores(
  snapshot: BrandHealthSnapshot,
  brand: Brand,
  state: string,
  range: BhRangeKey,
): { scores: PillarScores; metrics: Record<PillarKey, SourceBackedMetric | null> } {
  const stateMetrics = snapshot.states[state]?.[brand];
  const national = snapshot.national[brand];

  const metrics: Record<PillarKey, SourceBackedMetric | null> = {
    price: stateMetrics?.price[range] ?? null,
    search: stateMetrics?.search[range] ?? null,
    sentiment: national?.sentiment ?? null,
    website: national?.website ?? null,
  };

  return {
    metrics,
    scores: {
      price: metrics.price?.value ?? null,
      search: metrics.search?.value ?? null,
      sentiment: metrics.sentiment?.value ?? null,
      website: metrics.website?.value ?? null,
    },
  };
}
