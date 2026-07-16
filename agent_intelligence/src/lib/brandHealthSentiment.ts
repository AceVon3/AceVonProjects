// Customer Sentiment pillar — shared constants, types, and PURE scoring
// math for the Brand Health tab (Phase 5 of the pillar sequence).
//
// Formula (methodology "Customer Sentiment"):
//   45% normalized platform ratings + 35% inverted NAIC complaint index
//   + 20% review volume / recency confidence.
// A missing component drops out and the remaining weights renormalize —
// same honesty rule as the Website pillar.
//
// No I/O here. scripts/brand_health/refresh_sentiment.ts does the fetching:
// - Google Places API (New) Text Search, sampled across METRO_SAMPLE, for
//   review-count-weighted brand ratings (platform component + volume)
// - NAIC CIS complaint index via the public Tableau CSV endpoint
//   (tableau.naic.org), one stateless GET per company code
// and writes the generated snapshot to src/lib/brandHealthSentimentData.ts.

import { type Brand } from "./constants";
import { type SourceBackedMetric } from "./brandHealth";

// ---------------------------------------------------------------------------
// Measured entities per brand
// ---------------------------------------------------------------------------

// NAIC company code of each brand's flagship personal-auto writer.
// Selection rule (data-derived, 2026-07-16): the brand's largest Personal
// Auto entity by written premium in our own filings dataset, restricted to
// entities filing in >= 3 states (which excludes Texas-only county mutuals
// that top Farmers/Progressive on raw premium). Codes resolved + verified
// against NAIC CIS company search the same day.
export const BRAND_NAIC_COCODES: Record<Brand, { cocode: number; entity: string }> = {
  Allstate: { cocode: 29688, entity: "Allstate Fire and Casualty Insurance Company" },
  "American Family": { cocode: 10386, entity: "American Family Insurance Company" },
  "COUNTRY Financial": { cocode: 21008, entity: "COUNTRY Preferred Insurance Company" },
  Encompass: { cocode: 10358, entity: "Encompass Insurance Company" },
  Farmers: { cocode: 21652, entity: "Farmers Insurance Exchange" },
  GEICO: { cocode: 35882, entity: "GEICO General Insurance Company" },
  "Liberty Mutual": { cocode: 12484, entity: "Liberty Mutual Personal Insurance Company" },
  Nationwide: { cocode: 23787, entity: "Nationwide Mutual Insurance Company" },
  Progressive: { cocode: 16322, entity: "Progressive Direct Insurance Company" },
  Safeco: { cocode: 39012, entity: "Safeco Insurance Company of Illinois" },
  "State Farm": { cocode: 25178, entity: "State Farm Mutual Automobile Insurance Company" },
  Travelers: { cocode: 36161, entity: "Travelers Property Casualty Insurance Company" },
  USAA: { cocode: 25968, entity: "USAA Casualty Insurance Company" },
};

// Fixed metro sample for Places rating queries — a deterministic national
// spread (one per region tier) rather than wherever the runner's IP happens
// to be. lat/lng are metro centroids; radius 50km.
export const METRO_SAMPLE: Array<{ name: string; lat: number; lng: number }> = [
  { name: "New York", lat: 40.7128, lng: -74.006 },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
  { name: "Chicago", lat: 41.8781, lng: -87.6298 },
  { name: "Houston", lat: 29.7604, lng: -95.3698 },
  { name: "Phoenix", lat: 33.4484, lng: -112.074 },
  { name: "Philadelphia", lat: 39.9526, lng: -75.1652 },
  { name: "Atlanta", lat: 33.749, lng: -84.388 },
  { name: "Denver", lat: 39.7392, lng: -104.9903 },
  { name: "Seattle", lat: 47.6062, lng: -122.3321 },
  { name: "Columbus", lat: 39.9612, lng: -82.9988 },
];

// ---------------------------------------------------------------------------
// Raw components + generated snapshot shape
// ---------------------------------------------------------------------------

export type SentimentRawComponents = {
  // Review-count-weighted mean Google rating (0-5) across brand-matching
  // listings sampled in METRO_SAMPLE, and the total review count behind it.
  placesRating: number | null;
  placesReviewCount: number | null;
  placesListingCount: number | null;
  // App Store rating (0-5) + count for the brand's pinned consumer app —
  // the channel-neutral satisfaction surface (direct writers have few local
  // listings, but millions of app ratings).
  appRating: number | null;
  appRatingCount: number | null;
  // NAIC complaint index for the flagship entity (1.0 = industry average,
  // higher = more complaints relative to market share).
  complaintIndex: number | null;
};

export type SentimentBrandEntry = {
  raw: SentimentRawComponents;
  metric: SourceBackedMetric;
};

export type SentimentSnapshot = {
  retrievedAt: string;
  naicReportYear: number; // the CIS data year the complaint indexes describe
  brands: Partial<Record<Brand, SentimentBrandEntry>>;
};

// ---------------------------------------------------------------------------
// Pure scoring
// ---------------------------------------------------------------------------

export const SENTIMENT_COMPONENT_WEIGHTS = {
  ratings: 45,
  complaints: 35,
  volume: 20,
} as const;

// Blend the platform surfaces (Google listings, App Store) into one 0-5
// rating, each surface weighted by log10 of its review volume — influence
// proportional to evidence, so USAA's 2.3M app ratings outvote 1.5k reviews
// of its corporate offices ~2:1, while a 99-rating app barely nudges a brand
// with thousands of Google reviews. Returns the blended rating plus total
// volume (feeds volumeScore). Null when no surface has evidence.
export function platformRating(
  surfaces: Array<{ rating: number | null; count: number | null }>,
): { rating: number; volume: number } | null {
  const present = surfaces.filter(
    (s): s is { rating: number; count: number } =>
      s.rating !== null && s.count !== null && s.count > 0,
  );
  if (present.length === 0) return null;
  const totalWeight = present.reduce((a, s) => a + Math.log10(s.count + 1), 0);
  return {
    rating: present.reduce((a, s) => a + s.rating * Math.log10(s.count + 1), 0) / totalWeight,
    volume: present.reduce((a, s) => a + s.count, 0),
  };
}

// Platform ratings: consumer ratings live on a compressed effective scale —
// a 4.6 is genuinely strong, a 3.5 is bad. Map 3.0→30 and 4.8→90 linearly
// (clamped 0-100) rather than naive rating*20, which would put nearly every
// brand in the 80s and erase real differences.
export function ratingsScore(rating: number | null): number | null {
  if (rating === null) return null;
  const score = 30 + ((rating - 3.0) / 1.8) * 60;
  return Math.max(0, Math.min(100, score));
}

// Inverted complaint index, scored RELATIVE to the peer set (same
// philosophy as the price pillar): lowest complaint index in the cohort →
// 90, highest → 30, linear between. Peer-relative because flagship-entity
// indexes skew as a group — absolute calibration would grade the whole
// cohort, not differentiate it. All-equal cohorts get a neutral 60.
export function complaintScore(all: number[], mine: number): number {
  const min = Math.min(...all);
  const max = Math.max(...all);
  if (max === min) return 60;
  return Math.round(90 - 60 * ((mine - min) / (max - min)));
}

// Review volume: log-scale confidence in the ratings signal. 100 reviews →
// ~33, 10k reviews → ~67, 1M+ → 100 (cap). Zero/unknown volume → null (the
// component drops out rather than asserting "no confidence").
export function volumeScore(reviewCount: number | null): number | null {
  if (reviewCount === null || reviewCount <= 0) return null;
  return Math.min(100, (Math.log10(reviewCount) / 6) * 100);
}

export type SentimentScoreResult = {
  score: number;
  components: { ratings: number | null; complaints: number | null; volume: number | null };
  usedWeights: { ratings: number; complaints: number; volume: number };
};

// Blend available components at 45/35/20, renormalizing over what's present
// (integer display weights sum to 100, drift on the largest — same rule as
// the Website pillar). Returns null when nothing is scorable.
export function scoreSentiment(
  components: SentimentScoreResult["components"],
): SentimentScoreResult | null {
  const weights = {
    ratings: components.ratings === null ? 0 : SENTIMENT_COMPONENT_WEIGHTS.ratings,
    complaints: components.complaints === null ? 0 : SENTIMENT_COMPONENT_WEIGHTS.complaints,
    volume: components.volume === null ? 0 : SENTIMENT_COMPONENT_WEIGHTS.volume,
  };
  const total = weights.ratings + weights.complaints + weights.volume;
  if (total === 0) return null;

  const raw100 =
    ((components.ratings ?? 0) * weights.ratings +
      (components.complaints ?? 0) * weights.complaints +
      (components.volume ?? 0) * weights.volume) /
    total;

  const keys = ["ratings", "complaints", "volume"] as const;
  const rounded = keys.map(k => Math.round((weights[k] / total) * 100));
  const drift = 100 - rounded.reduce((a, b) => a + b, 0);
  if (drift !== 0) {
    let iMax = 0;
    for (let i = 1; i < rounded.length; i++) {
      if (rounded[i] > rounded[iMax]) iMax = i;
    }
    rounded[iMax] += drift;
  }

  return {
    score: Math.round(raw100),
    components,
    usedWeights: { ratings: rounded[0], complaints: rounded[1], volume: rounded[2] },
  };
}
