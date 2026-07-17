// Website Performance pillar — shared constants, types, and PURE scoring
// math for the Brand Health tab (Phase 4).
//
// Formula (methodology "Website Performance"):
//   50% PageSpeed/Lighthouse score + 30% CrUX real-user Core Web Vitals
//   + 20% mobile app rating proxy.
// A missing component drops out and the remaining weights renormalize —
// same honesty rule as the composite score (no fabricated components).
//
// This module does NO I/O. The fetching lives in
// scripts/brand_health/refresh_website.ts, which calls Google's PageSpeed
// Insights API (Lighthouse lab score + CrUX origin field data in one
// response) and Apple's iTunes Lookup API, then writes the generated
// snapshot to src/lib/brandHealthWebsiteData.ts. Keeping the math here,
// import-safe for the app, lets the verify script recompute every blend
// from the stored raw components.

import { type Brand } from "./constants";
import { type SourceBackedMetric } from "./brandHealth";

// ---------------------------------------------------------------------------
// Measured properties per brand
// ---------------------------------------------------------------------------

// Carrier homepages — national properties, one measurement per brand.
export const BRAND_WEBSITES: Record<Brand, string> = {
  Allstate: "https://www.allstate.com/",
  "American Family": "https://www.amfam.com/",
  "COUNTRY Financial": "https://www.countryfinancial.com/",
  Encompass: "https://www.encompassinsurance.com/",
  Farmers: "https://www.farmers.com/",
  GEICO: "https://www.geico.com/",
  "Liberty Mutual": "https://www.libertymutual.com/",
  Nationwide: "https://www.nationwide.com/",
  Progressive: "https://www.progressive.com/",
  Safeco: "https://www.safeco.com/",
  "State Farm": "https://www.statefarm.com/",
  Travelers: "https://www.travelers.com/",
  USAA: "https://www.usaa.com/",
};

// Primary consumer iOS app per brand (iTunes trackId), pinned 2026-07-16 by
// hand-matching iTunes Search results on trackName + sellerName so refresh
// runs are deterministic (a live search could drift to a different app).
// Encompass's app is published by National General (its parent) — correct app.
export const BRAND_APPSTORE_IDS: Record<Brand, number> = {
  Allstate: 364376344,          // Allstate® Mobile
  "American Family": 329763835, // American Family Insurance App
  "COUNTRY Financial": 1305375932, // COUNTRY Financial Mobile
  Encompass: 1580977172,        // Encompass Insurance (National General)
  Farmers: 373431224,           // Farmers Insurance Mobile
  GEICO: 331763096,             // GEICO Mobile - Car Insurance
  "Liberty Mutual": 397404511,  // Liberty Mutual Mobile
  Nationwide: 311627534,        // Nationwide Mobile
  Progressive: 349731802,       // Progressive
  Safeco: 1191491672,           // Safeco Mobile
  "State Farm": 318142137,      // State Farm®
  Travelers: 354604876,         // Travelers Mobile
  USAA: 312325565,              // USAA Mobile
};

// ---------------------------------------------------------------------------
// Quote-flow friction probe (raw measurements — see probe_quoteflow.ts)
// ---------------------------------------------------------------------------

export type QuoteFlowMeasurement =
  | {
      zipOnHomepage: boolean;
      clicksToQuote: number; // 0 = quote field on the homepage itself
      msToQuoteStart: number; // navigation start → first quote field visible
      finalUrl: string;
    }
  | { failed: string }; // bot wall / no CTA / timeout — component drops out

export type QuoteFlowSnapshot = {
  probedAt: string;
  brands: Partial<Record<Brand, QuoteFlowMeasurement>>;
};

// ---------------------------------------------------------------------------
// Raw components + generated snapshot shape
// ---------------------------------------------------------------------------

// Everything the refresh script measured for one brand, kept raw so the
// verify script can independently recompute the blended score and the UI
// note can cite real numbers. null = that component was unavailable.
export type WebsiteRawComponents = {
  // Lighthouse mobile performance score, 0-100 (PSI lab data).
  lighthouse: number | null;
  // Share of real-user visits with "good" LCP / INP / CLS, each 0-1
  // (PSI originLoadingExperience distributions, 28-day rolling CrUX).
  cruxGoodShares: { lcp: number | null; inp: number | null; cls: number | null } | null;
  // App Store average rating 0-5 and its rating count (iTunes Lookup).
  appRating: number | null;
  appRatingCount: number | null;
  // Quote-flow friction probe (optional — absent in pre-probe snapshots;
  // null when the probe was blocked/failed for this brand).
  quoteFlow?: {
    zipOnHomepage: boolean;
    clicksToQuote: number;
    msToQuoteStart: number;
  } | null;
};

export type WebsiteBrandEntry = {
  raw: WebsiteRawComponents;
  metric: SourceBackedMetric;
};

export type WebsiteSnapshot = {
  retrievedAt: string; // ISO date the refresh script ran
  brands: Partial<Record<Brand, WebsiteBrandEntry>>;
};

// ---------------------------------------------------------------------------
// Pure scoring
// ---------------------------------------------------------------------------

// Component weights from the methodology formula.
//
// quoteFlow is DORMANT (weight 0): the automated probe proved unstable —
// 4-7 of 13 brands measured per run, flapping run-to-run as carrier bot
// walls react to headless visits (2026-07-17; see FORMULA_GAP_V4.md
// addendum). Shipping it live would make the formula mean different
// things per brand. Activate by raising the weight to 20 (v4 rebalance:
// 35/25/20/20) once a reliable measurement source exists — a manual
// audit or a scheduled CI probe from a cleaner vantage point.
export const WEBSITE_COMPONENT_WEIGHTS = {
  lighthouse: 50,
  crux: 30,
  app: 20,
  quoteFlow: 0,
} as const;

// ---------------------------------------------------------------------------
// Quote-flow friction scoring (pure)
// ---------------------------------------------------------------------------

// Path friction: how many steps before a shopper is answering the first
// quote question. ZIP-on-homepage is the frictionless gold standard.
export function pathScore(zipOnHomepage: boolean, clicksToQuote: number): number {
  if (zipOnHomepage || clicksToQuote === 0) return 100;
  if (clicksToQuote === 1) return 70;
  return 40;
}

// Speed: elapsed ms from navigation start until the first quote field is
// interactable. <=5s scores 100, linear down to 0 at >=30s (band spans the
// observed probe range: Progressive ~3.9s ... Farmers ~30.6s).
export function speedScore(msToQuoteStart: number): number {
  return Math.max(0, Math.min(100, (100 * (30_000 - msToQuoteStart)) / 25_000));
}

// Friction heuristic = 60% path + 40% speed. Null when the probe failed —
// the component drops out and the remaining weights renormalize.
export function quoteFlowScore(
  qf: WebsiteRawComponents["quoteFlow"],
): number | null {
  if (!qf) return null;
  return 0.6 * pathScore(qf.zipOnHomepage, qf.clicksToQuote) + 0.4 * speedScore(qf.msToQuoteStart);
}

// CrUX component: mean share of real-user visits rated "good" across the
// Core Web Vitals that CrUX reported for the origin, as 0-100. An origin
// missing a single vital (e.g. not enough INP samples) averages over the
// vitals it has; an origin with no CrUX data at all returns null.
export function cruxScore(
  shares: WebsiteRawComponents["cruxGoodShares"],
): number | null {
  if (!shares) return null;
  const present = [shares.lcp, shares.inp, shares.cls].filter(
    (v): v is number => v !== null,
  );
  if (present.length === 0) return null;
  return (present.reduce((a, b) => a + b, 0) / present.length) * 100;
}

// App component: plain rating-to-percent proxy (4.8★ → 96). The methodology
// calls this a proxy and the metric note says so.
export function appScore(rating: number | null): number | null {
  return rating === null ? null : rating * 20;
}

export type WebsiteScoreResult = {
  score: number; // 0-100, rounded
  components: {
    lighthouse: number | null;
    crux: number | null;
    app: number | null;
    quoteFlow: number | null;
  };
  // renormalized integer display weights, sum 100 (all-0 if nothing scorable)
  usedWeights: { lighthouse: number; crux: number; app: number; quoteFlow: number };
};

// Blend the available components at 35/25/20/20, renormalizing over
// whatever is present. Returns null only when NO component is available —
// that brand simply has no website metric and the pillar drops out.
export function scoreWebsite(raw: WebsiteRawComponents): WebsiteScoreResult | null {
  const components = {
    lighthouse: raw.lighthouse,
    crux: cruxScore(raw.cruxGoodShares),
    app: appScore(raw.appRating),
    quoteFlow: quoteFlowScore(raw.quoteFlow),
  };
  const keys = ["lighthouse", "crux", "app", "quoteFlow"] as const;
  // A zero base weight (dormant component) contributes nothing whether or
  // not a measurement exists.
  const weights = Object.fromEntries(
    keys.map(k => [k, components[k] === null ? 0 : WEBSITE_COMPONENT_WEIGHTS[k]]),
  ) as Record<(typeof keys)[number], number>;
  const total = keys.reduce((a, k) => a + weights[k], 0);
  if (total === 0) return null;

  const raw100 =
    keys.reduce((a, k) => a + (components[k] ?? 0) * weights[k], 0) / total;

  // Integer display weights that always sum to 100: round each, then push
  // the rounding drift onto the largest (same rule as normalizeWeights).
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
    usedWeights: {
      lighthouse: rounded[0],
      crux: rounded[1],
      app: rounded[2],
      quoteFlow: rounded[3],
    },
  };
}
