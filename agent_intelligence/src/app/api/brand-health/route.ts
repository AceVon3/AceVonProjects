import { NextRequest, NextResponse } from "next/server";

import {
  BH_RANGE_KEYS,
  type BrandNationalMetrics,
  type BrandStateMetrics,
  PILLAR_KEYS,
  type PillarKey,
} from "@/lib/brandHealth";
import { BRAND_HEALTH_SNAPSHOT } from "@/lib/brandHealthData";
import { computePriceMetrics } from "@/lib/brandHealthPrice";
import { SENTIMENT_SNAPSHOT } from "@/lib/brandHealthSentimentData";
import { WEBSITE_SNAPSHOT } from "@/lib/brandHealthWebsiteData";
import { BRANDS, COVERED_STATES, type Brand } from "@/lib/constants";
import { getDataAsOf } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/brand-health?state=AZ — one state's Brand Health payload:
// - price: REAL, computed from filings.db (filed rate momentum per range)
// - website: REAL once scripts/brand_health/refresh_website.ts has written a
//   generated snapshot (PageSpeed/CrUX + app rating); seed until then
// - sentiment/search: from the snapshot (still seed until their
//   refresh phases land)
// The client never receives the whole 45-state snapshot — one state slice
// per request keeps the bundle and payload small.
//
// seedPillars tells the UI which pillars are still placeholder so the
// preview banner can name them (and disappear on its own when the last
// seed pillar goes live).
export async function GET(req: NextRequest): Promise<NextResponse> {
  const state = req.nextUrl.searchParams.get("state") ?? "";
  if (!(COVERED_STATES as readonly string[]).includes(state)) {
    return NextResponse.json({ error: `unknown or uncovered state: ${state}` }, { status: 400 });
  }

  const snapshot = BRAND_HEALTH_SNAPSHOT;
  const price = computePriceMetrics(state);

  const brands = Object.fromEntries(
    BRANDS.map(brand => {
      const seeded = snapshot.states[state]?.[brand];
      const entry: BrandStateMetrics = {
        price: price[brand] ?? {},
        search: seeded?.search ?? {},
      };
      return [brand, entry];
    }),
  ) as Record<Brand, BrandStateMetrics>;

  // National pillars come from their generated snapshots when those exist
  // (brands a snapshot omitted honestly get null, not the seed value); a
  // pillar whose refresh has never run stays seed.
  const national = Object.fromEntries(
    BRANDS.map(brand => {
      const seeded = snapshot.national[brand];
      const entry: BrandNationalMetrics = {
        sentiment: SENTIMENT_SNAPSHOT
          ? (SENTIMENT_SNAPSHOT.brands[brand]?.metric ?? null)
          : seeded.sentiment,
        website: WEBSITE_SNAPSHOT
          ? (WEBSITE_SNAPSHOT.brands[brand]?.metric ?? null)
          : seeded.website,
      };
      return [brand, entry];
    }),
  ) as Record<Brand, BrandNationalMetrics>;

  // A pillar is "seed" if any metric in this payload carries tier "seed".
  const seedPillars: PillarKey[] = PILLAR_KEYS.filter(pillar => {
    if (pillar === "sentiment" || pillar === "website") {
      return BRANDS.some(b => national[b][pillar]?.sourceTier === "seed");
    }
    return BRANDS.some(b =>
      BH_RANGE_KEYS.some(r => brands[b][pillar][r]?.sourceTier === "seed"),
    );
  });

  return NextResponse.json({
    asOf: getDataAsOf(),
    dataYear: Number(getDataAsOf().slice(0, 4)),
    national,
    brands,
    seedPillars,
  });
}
