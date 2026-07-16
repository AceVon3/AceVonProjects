// Brand Health Phase 4 — Website Performance pillar refresh.
//
// For each of the 13 brands:
//   1. PageSpeed Insights API (mobile) → Lighthouse performance score (lab)
//      + CrUX origin field data (real-user Core Web Vitals, 28-day rolling).
//      One PSI call returns both, so no separate CrUX API call is needed.
//   2. iTunes Lookup API → App Store rating for the pinned consumer app.
// Then blends 50/30/20 (scoreWebsite) and writes the generated snapshot to
// src/lib/brandHealthWebsiteData.ts.
//
// Needs a free Google API key (PSI_API_KEY or GOOGLE_API_KEY, read from
// .env.local or the environment) — the keyless shared PSI quota is
// permanently exhausted. iTunes Lookup needs no key.
//
// Run: npx tsx scripts/brand_health/refresh_website.ts
//
// Failures are per-brand and per-component: a brand whose PSI call fails
// still gets an app-rating-only metric (at renormalized weight + low
// confidence), and a brand with nothing measurable is OMITTED from the
// snapshot — the UI's honest "no data" path handles it. The script exits
// non-zero if fewer than 10 of 13 brands produced a metric, so a bad run
// can't silently overwrite a good snapshot.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

import { BRANDS, type Brand } from "../../src/lib/constants";
import { type SourceBackedMetric } from "../../src/lib/brandHealth";
import {
  BRAND_APPSTORE_IDS,
  BRAND_WEBSITES,
  scoreWebsite,
  type WebsiteBrandEntry,
  type WebsiteRawComponents,
  type WebsiteSnapshot,
} from "../../src/lib/brandHealthWebsite";

const ROOT = path.join(__dirname, "..", "..");
const OUT_FILE = path.join(ROOT, "src", "lib", "brandHealthWebsiteData.ts");

// --------------------------------------------------------------------------
// Env + key
// --------------------------------------------------------------------------

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
const API_KEY = process.env.PSI_API_KEY ?? process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error(
    "No PSI_API_KEY / GOOGLE_API_KEY found (.env.local or environment).\n" +
      "Create a free key: https://console.cloud.google.com → enable " +
      '"PageSpeed Insights API" → Credentials → API key.',
  );
  process.exit(1);
}

// --------------------------------------------------------------------------
// Fetchers
// --------------------------------------------------------------------------

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

type PsiResult = {
  lighthouse: number | null;
  cruxGoodShares: WebsiteRawComponents["cruxGoodShares"];
};

// PSI metric keys → our vital names. GOOD is always distributions[0]
// (min 0 → first threshold) per the PSI/CrUX API contract.
const CRUX_METRIC_KEYS: Array<[string, "lcp" | "inp" | "cls"]> = [
  ["LARGEST_CONTENTFUL_PAINT_MS", "lcp"],
  ["INTERACTION_TO_NEXT_PAINT", "inp"],
  ["CUMULATIVE_LAYOUT_SHIFT_SCORE", "cls"],
];

async function fetchPsi(brand: Brand): Promise<PsiResult> {
  const url =
    "https://www.googleapis.com/pagespeedonline/v5/runPagespeed" +
    `?url=${encodeURIComponent(BRAND_WEBSITES[brand])}` +
    `&strategy=mobile&category=performance&key=${API_KEY}`;
  // Lighthouse runs take ~30-60s per site; PSI occasionally 500s under load,
  // so retry once before giving up on the brand's lab+field components.
  let data: unknown;
  try {
    data = await fetchJson(url, 120_000);
  } catch {
    await new Promise(r => setTimeout(r, 5_000));
    data = await fetchJson(url, 120_000);
  }
  const d = data as {
    lighthouseResult?: { categories?: { performance?: { score?: number } } };
    originLoadingExperience?: {
      metrics?: Record<string, { distributions?: Array<{ proportion?: number }> }>;
    };
  };

  const perf = d.lighthouseResult?.categories?.performance?.score;
  const lighthouse = typeof perf === "number" ? Math.round(perf * 100) : null;

  const metrics = d.originLoadingExperience?.metrics;
  let cruxGoodShares: PsiResult["cruxGoodShares"] = null;
  if (metrics) {
    const shares = { lcp: null, inp: null, cls: null } as NonNullable<
      PsiResult["cruxGoodShares"]
    >;
    let any = false;
    for (const [psiKey, ours] of CRUX_METRIC_KEYS) {
      const good = metrics[psiKey]?.distributions?.[0]?.proportion;
      if (typeof good === "number") {
        shares[ours] = good;
        any = true;
      }
    }
    if (any) cruxGoodShares = shares;
  }

  return { lighthouse, cruxGoodShares };
}

async function fetchAppRating(
  brand: Brand,
): Promise<{ rating: number | null; count: number | null }> {
  const d = (await fetchJson(
    `https://itunes.apple.com/lookup?id=${BRAND_APPSTORE_IDS[brand]}&country=us`,
    30_000,
  )) as { results?: Array<{ averageUserRating?: number; userRatingCount?: number }> };
  const app = d.results?.[0];
  return {
    rating: typeof app?.averageUserRating === "number" ? app.averageUserRating : null,
    count: typeof app?.userRatingCount === "number" ? app.userRatingCount : null,
  };
}

// --------------------------------------------------------------------------
// Metric assembly
// --------------------------------------------------------------------------

function buildMetric(
  raw: WebsiteRawComponents,
  retrievedAt: string,
): SourceBackedMetric | null {
  const scored = scoreWebsite(raw);
  if (!scored) return null;

  const parts: string[] = [];
  if (scored.components.lighthouse !== null) {
    parts.push(`Lighthouse mobile ${Math.round(scored.components.lighthouse)}/100`);
  }
  if (scored.components.crux !== null) {
    parts.push(
      `${Math.round(scored.components.crux)}% of real-user visits pass Core Web Vitals (CrUX, 28-day)`,
    );
  }
  if (scored.components.app !== null && raw.appRating !== null) {
    parts.push(
      `App Store ${raw.appRating.toFixed(2)}★` +
        (raw.appRatingCount ? ` (${Math.round(raw.appRatingCount / 1000)}k ratings)` : ""),
    );
  }
  const missing = (
    [
      [scored.components.lighthouse, "Lighthouse"],
      [scored.components.crux, "CrUX"],
      [scored.components.app, "app rating"],
    ] as const
  )
    .filter(([v]) => v === null)
    .map(([, name]) => name);

  const allPresent = missing.length === 0;
  return {
    value: scored.score,
    sourceTier: "digital",
    sourceName: "Google PageSpeed/CrUX + App Store",
    sourceUrl: "https://pagespeed.web.dev/",
    dataAsOf: retrievedAt,
    retrievedAt,
    confidence: allPresent ? "high" : scored.components.lighthouse !== null ? "medium" : "low",
    refreshCadence: "monthly",
    scope: "national",
    note:
      `${parts.join("; ")}. Blend ${scored.usedWeights.lighthouse}/${scored.usedWeights.crux}/${scored.usedWeights.app}` +
      ` (Lighthouse/CrUX/app-rating proxy)` +
      (allPresent ? "" : `; ${missing.join(" + ")} unavailable, weights renormalized`) +
      ". CrUX is a 28-day rolling real-user window.",
  };
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

async function main(): Promise<void> {
  const retrievedAt = new Date().toISOString().slice(0, 10);
  const brands: WebsiteSnapshot["brands"] = {};

  // Serial on purpose: PSI runs a full Lighthouse audit per call, and serial
  // spacing keeps us far from the per-minute quota. ~13 brands ≈ 5-10 min.
  for (const brand of BRANDS) {
    let psi: PsiResult = { lighthouse: null, cruxGoodShares: null };
    try {
      psi = await fetchPsi(brand);
    } catch (e) {
      console.error(`  PSI FAILED for ${brand}: ${(e as Error).message.slice(0, 200)}`);
    }
    let app: { rating: number | null; count: number | null } = { rating: null, count: null };
    try {
      app = await fetchAppRating(brand);
    } catch (e) {
      console.error(`  iTunes FAILED for ${brand}: ${(e as Error).message.slice(0, 200)}`);
    }

    const raw: WebsiteRawComponents = {
      lighthouse: psi.lighthouse,
      cruxGoodShares: psi.cruxGoodShares,
      appRating: app.rating,
      appRatingCount: app.count,
    };
    const metric = buildMetric(raw, retrievedAt);
    if (metric) {
      brands[brand] = { raw, metric } satisfies WebsiteBrandEntry;
      console.log(
        `${brand.padEnd(18)} score ${String(metric.value).padStart(3)}  ` +
          `(lh=${raw.lighthouse ?? "—"} crux=${
            psi.cruxGoodShares ? "yes" : "—"
          } app=${raw.appRating?.toFixed(2) ?? "—"})  confidence=${metric.confidence}`,
      );
    } else {
      console.error(`${brand.padEnd(18)} NO DATA — omitted from snapshot`);
    }
  }

  const produced = Object.keys(brands).length;
  if (produced < 10) {
    console.error(`Only ${produced}/13 brands produced a metric — NOT overwriting snapshot.`);
    process.exit(1);
  }

  const snapshot: WebsiteSnapshot = { retrievedAt, brands };
  const body =
    `// GENERATED FILE — written by scripts/brand_health/refresh_website.ts\n` +
    `// on ${retrievedAt}. Do not edit by hand; run the refresh script instead.\n\n` +
    `import { type WebsiteSnapshot } from "./brandHealthWebsite";\n\n` +
    `export const WEBSITE_SNAPSHOT: WebsiteSnapshot | null =\n` +
    `  ${JSON.stringify(snapshot, null, 2).replace(/\n/g, "\n  ")};\n`;
  writeFileSync(OUT_FILE, body);
  console.log(`\nWrote ${produced}/13 brands to ${path.relative(ROOT, OUT_FILE)}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
