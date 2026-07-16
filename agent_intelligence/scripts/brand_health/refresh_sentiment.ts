// Brand Health — Customer Sentiment pillar refresh.
//
// Per brand:
//   1. Google Places API (New) Text Search — "<brand> insurance" sampled in
//      each METRO_SAMPLE metro (50km bias), keeping results whose name
//      matches the brand. Produces a review-count-weighted mean rating and
//      total review volume. Needs PSI_API_KEY/GOOGLE_API_KEY with billing
//      enabled + "Places API (New)" enabled on the project. ~130 requests
//      per run — far inside the free monthly quota.
//   2. NAIC CIS complaint index — public Tableau CSV endpoint, one GET per
//      flagship-entity cocode (see BRAND_NAIC_COCODES for selection rule).
//      No key. Unknown cocodes return an empty body, treated as no-data.
// Then blends 45/35/20 (scoreSentiment) and writes the snapshot to
// src/lib/brandHealthSentimentData.ts.
//
// The complaint component is peer-relative, so it is computed AFTER all
// brands' indexes are fetched. Coverage floor: fewer than 10/13 brands with
// a metric aborts without overwriting (same rule as the website refresh).
//
// Run: npx tsx scripts/brand_health/refresh_sentiment.ts

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import { BRANDS, type Brand } from "../../src/lib/constants";
import { type SourceBackedMetric } from "../../src/lib/brandHealth";
import {
  BRAND_NAIC_COCODES,
  METRO_SAMPLE,
  complaintScore,
  ratingsScore,
  scoreSentiment,
  volumeScore,
  type SentimentBrandEntry,
  type SentimentRawComponents,
  type SentimentSnapshot,
} from "../../src/lib/brandHealthSentiment";

const ROOT = path.join(__dirname, "..", "..");
const OUT_FILE = path.join(ROOT, "src", "lib", "brandHealthSentimentData.ts");
// CIS publishes the complaint index for one report year at a time; bump when
// NAIC rolls (verify script cross-checks a live probe against this).
const NAIC_REPORT_YEAR = 2025;
// Brands with fewer matching listings than this are scored at medium (not
// high) confidence — see the direct-writer note in buildMetric.
const SPARSE_LISTING_FLOOR = 30;

function loadEnvLocal(): void {
  const envPath = path.join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

loadEnvLocal();
// Places needs its own key: the PSI key is API-restricted and can't call
// Places, so a separate unrestricted Maps key (PLACES_API_KEY) is preferred.
const API_KEY =
  process.env.PLACES_API_KEY ?? process.env.PSI_API_KEY ?? process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error("No PLACES_API_KEY / PSI_API_KEY / GOOGLE_API_KEY in .env.local or environment.");
  process.exit(1);
}

// --------------------------------------------------------------------------
// Google Places (New) Text Search
// --------------------------------------------------------------------------

type PlacesAggregate = {
  rating: number | null;
  reviewCount: number | null;
  listingCount: number | null;
};

// Brand-name matcher for listing display names: every significant word of
// the brand must appear (so "State Farm - Joe Smith" matches State Farm but
// "Farmers Insurance - Joe" doesn't, and vice versa).
function matchesBrand(displayName: string, brand: Brand): boolean {
  const words = brand.toLowerCase().split(/\s+/);
  const name = displayName.toLowerCase();
  return words.every(w => name.includes(w));
}

async function fetchPlacesForBrand(brand: Brand): Promise<PlacesAggregate> {
  let weighted = 0;
  let reviews = 0;
  let listings = 0;

  for (const metro of METRO_SAMPLE) {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY as string,
        "X-Goog-FieldMask": "places.displayName,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({
        textQuery: `${brand} insurance`,
        locationBias: {
          circle: { center: { latitude: metro.lat, longitude: metro.lng }, radius: 50000 },
        },
        pageSize: 20,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      throw new Error(`Places HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    const data = (await res.json()) as {
      places?: Array<{ displayName?: { text?: string }; rating?: number; userRatingCount?: number }>;
    };
    for (const p of data.places ?? []) {
      const name = p.displayName?.text ?? "";
      if (!matchesBrand(name, brand)) continue;
      if (typeof p.rating !== "number" || typeof p.userRatingCount !== "number") continue;
      if (p.userRatingCount < 3) continue; // 1-2 review listings are noise
      weighted += p.rating * p.userRatingCount;
      reviews += p.userRatingCount;
      listings += 1;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  if (reviews === 0) return { rating: null, reviewCount: null, listingCount: null };
  return { rating: weighted / reviews, reviewCount: reviews, listingCount: listings };
}

// --------------------------------------------------------------------------
// NAIC CIS complaint index (public Tableau CSV)
// --------------------------------------------------------------------------

async function fetchComplaintIndex(brand: Brand): Promise<number | null> {
  const { cocode } = BRAND_NAIC_COCODES[brand];
  const res = await fetch(
    `https://tableau.naic.org/views/CIS-WB-CompanyRatioTrendComplaints/RatioTrendDashboard.csv?COCODE=${cocode}`,
    {
      headers: { "User-Agent": "brand-health-refresh/1.0" },
      signal: AbortSignal.timeout(45_000),
    },
  );
  if (!res.ok) throw new Error(`NAIC HTTP ${res.status}`);
  const lines = (await res.text()).trim().split("\n");
  if (lines.length < 2) return null; // unknown cocode / no data → empty body
  const value = parseFloat(lines[1].split(",")[0]); // "Complaint Ratio Calculation" col
  return Number.isFinite(value) ? value : null;
}

// --------------------------------------------------------------------------
// Metric assembly
// --------------------------------------------------------------------------

function buildMetric(
  brand: Brand,
  raw: SentimentRawComponents,
  cohortIndexes: number[],
  retrievedAt: string,
): SourceBackedMetric | null {
  const components = {
    ratings: ratingsScore(raw.placesRating),
    complaints:
      raw.complaintIndex === null ? null : complaintScore(cohortIndexes, raw.complaintIndex),
    volume: volumeScore(raw.placesReviewCount),
  };
  const scored = scoreSentiment(components);
  if (!scored) return null;

  const parts: string[] = [];
  if (raw.placesRating !== null) {
    parts.push(
      `Google ${raw.placesRating.toFixed(2)}★ across ${raw.placesListingCount} listings ` +
        `(${((raw.placesReviewCount ?? 0) / 1000).toFixed(1)}k reviews, ${METRO_SAMPLE.length}-metro sample)`,
    );
  }
  if (raw.complaintIndex !== null) {
    parts.push(
      `NAIC complaint index ${raw.complaintIndex.toFixed(2)} (${NAIC_REPORT_YEAR}, ` +
        `${BRAND_NAIC_COCODES[brand].entity}; 1.0 = industry average, peer-ranked)`,
    );
  }
  const missing = (
    [
      [components.ratings, "platform ratings"],
      [components.complaints, "complaint index"],
      [components.volume, "review volume"],
    ] as const
  )
    .filter(([v]) => v === null)
    .map(([, name]) => name);
  const allPresent = missing.length === 0;

  // Direct writers (USAA, Travelers, Safeco...) have few local listings —
  // mostly corporate/claims offices that skew negative — while agent-network
  // brands field thousands of curated agent storefronts. A sparse sample
  // can't be compared at full confidence and the note must say why.
  const sparse =
    raw.placesRating !== null && (raw.placesListingCount ?? 0) < SPARSE_LISTING_FLOOR;

  return {
    value: scored.score,
    sourceTier: raw.complaintIndex !== null && raw.placesRating === null ? "official" : "platform",
    sourceName: "Google Places ratings + NAIC complaint index",
    sourceUrl: "https://content.naic.org/cis_consumer_information.htm",
    dataAsOf: retrievedAt,
    retrievedAt,
    confidence: !allPresent
      ? components.complaints !== null
        ? "medium"
        : "low"
      : sparse
        ? "medium"
        : "high",
    refreshCadence: "monthly",
    scope: "national",
    note:
      `${parts.join("; ")}. Blend ${scored.usedWeights.ratings}/${scored.usedWeights.complaints}/${scored.usedWeights.volume}` +
      ` (ratings/complaints/volume)` +
      (allPresent ? "" : `; ${missing.join(" + ")} unavailable, weights renormalized`) +
      (sparse
        ? `; sparse listing sample (${raw.placesListingCount} listings) — direct-writer brands` +
          ` have few local storefronts, so ratings skew toward corporate/claims offices`
        : "") +
      ". NAIC complaint data is annual; ratings are point-in-time.",
  };
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

async function main(): Promise<void> {
  const retrievedAt = new Date().toISOString().slice(0, 10);

  // Pass 1: fetch everything (complaint scoring needs the full cohort).
  const rawByBrand = {} as Record<Brand, SentimentRawComponents>;
  for (const brand of BRANDS) {
    let places: PlacesAggregate = { rating: null, reviewCount: null, listingCount: null };
    try {
      places = await fetchPlacesForBrand(brand);
    } catch (e) {
      console.error(`  Places FAILED for ${brand}: ${(e as Error).message.slice(0, 200)}`);
    }
    let complaintIndex: number | null = null;
    try {
      complaintIndex = await fetchComplaintIndex(brand);
    } catch (e) {
      console.error(`  NAIC FAILED for ${brand}: ${(e as Error).message.slice(0, 200)}`);
    }
    rawByBrand[brand] = {
      placesRating: places.rating,
      placesReviewCount: places.reviewCount,
      placesListingCount: places.listingCount,
      complaintIndex,
    };
    console.log(
      `${brand.padEnd(18)} fetched  (google=${places.rating?.toFixed(2) ?? "—"} ` +
        `reviews=${places.reviewCount ?? "—"} naic=${complaintIndex?.toFixed(2) ?? "—"})`,
    );
  }

  // Pass 2: score against the cohort and assemble metrics.
  const cohortIndexes = BRANDS.map(b => rawByBrand[b].complaintIndex).filter(
    (v): v is number => v !== null,
  );
  const brands: SentimentSnapshot["brands"] = {};
  for (const brand of BRANDS) {
    const metric = buildMetric(brand, rawByBrand[brand], cohortIndexes, retrievedAt);
    if (metric) {
      brands[brand] = { raw: rawByBrand[brand], metric } satisfies SentimentBrandEntry;
      console.log(`${brand.padEnd(18)} score ${String(metric.value).padStart(3)}  confidence=${metric.confidence}`);
    } else {
      console.error(`${brand.padEnd(18)} NO DATA — omitted from snapshot`);
    }
  }

  const produced = Object.keys(brands).length;
  if (produced < 10) {
    console.error(`Only ${produced}/13 brands produced a metric — NOT overwriting snapshot.`);
    process.exit(1);
  }

  const snapshot: SentimentSnapshot = { retrievedAt, naicReportYear: NAIC_REPORT_YEAR, brands };
  const body =
    `// GENERATED FILE — written by scripts/brand_health/refresh_sentiment.ts\n` +
    `// on ${retrievedAt}. Do not edit by hand; run the refresh script instead.\n\n` +
    `import { type SentimentSnapshot } from "./brandHealthSentiment";\n\n` +
    `export const SENTIMENT_SNAPSHOT: SentimentSnapshot | null =\n` +
    `  ${JSON.stringify(snapshot, null, 2).replace(/\n/g, "\n  ")};\n`;
  writeFileSync(OUT_FILE, body);
  console.log(`\nWrote ${produced}/13 brands to ${path.relative(ROOT, OUT_FILE)}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
