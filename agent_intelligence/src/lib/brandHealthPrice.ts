// Price Competitiveness pillar — computed live, server-side, from the
// committed filings.db (no external sources, no staleness beyond the DB's
// own monthly refresh).
//
// Definition (methodology "Price Competitiveness"): filed rate MOMENTUM.
// For a (state, window) we sum each brand's approved/pending Personal Auto
// overall_rate_impact over the window, then score brands RELATIVE to the
// peers that also filed there: lowest net increase → 90, highest → 30,
// linear in between. This measures rate movement, never price levels — the
// metric note says so on every value.
//
// Personal Auto only: the Brand Health feature is scoped to auto (per the
// dashboard_v2 manuals), matching /positioning's auto-only display.
//
// Windows anchor to data/last_updated.txt (getDataAsOf), NOT the wall
// clock — same determinism rule as every other query in this app.

import { ACTIVE_RATE_ACTIVITIES, BRANDS, type Brand } from "./constants";
import { getDataAsOf, getDb } from "./db";
import {
  BH_RANGE_KEYS,
  type BhRangeKey,
  type SourceBackedMetric,
} from "./brandHealth";

type WindowSpec = { start: string; end: string };

// asOf minus N calendar months, ISO. UTC arithmetic so the result never
// shifts with the server's timezone.
function monthsBack(asOf: string, months: number): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

// Resolve every range key to an effective-date window. Rolling windows end
// at asOf; quarters are calendar quarters of asOf's year (a quarter that
// hasn't started yet simply matches zero filings → null metrics → the UI's
// honest "No data" path).
export function rangeWindows(asOf: string): Record<BhRangeKey, WindowSpec> {
  const y = asOf.slice(0, 4);
  return {
    "3m": { start: monthsBack(asOf, 3), end: asOf },
    "6m": { start: monthsBack(asOf, 6), end: asOf },
    "12m": { start: monthsBack(asOf, 12), end: asOf },
    ytd: { start: `${y}-01-01`, end: asOf },
    q1: { start: `${y}-01-01`, end: `${y}-03-31` },
    q2: { start: `${y}-04-01`, end: `${y}-06-30` },
    q3: { start: `${y}-07-01`, end: `${y}-09-30` },
    q4: { start: `${y}-10-01`, end: `${y}-12-31` },
  };
}

type BrandNet = { brand: Brand; net: number; filings: number; hasScraped: boolean };

// One state+window: net rate movement per brand that filed there.
function queryNets(state: string, w: WindowSpec): BrandNet[] {
  const placeholders = ACTIVE_RATE_ACTIVITIES.map(() => "?").join(",");
  const rows = getDb()
    .prepare(
      `SELECT brand,
              SUM(overall_rate_impact) AS net,
              COUNT(*) AS filings,
              MAX(source = 'serff_scraped') AS hasScraped
         FROM filings
        WHERE state = ?
          AND line_of_business = 'Personal Auto'
          AND rate_activity IN (${placeholders})
          AND overall_rate_impact IS NOT NULL
          AND effective_date BETWEEN ? AND ?
        GROUP BY brand`,
    )
    .all(state, ...ACTIVE_RATE_ACTIVITIES, w.start, w.end) as Array<{
    brand: string;
    net: number;
    filings: number;
    hasScraped: 0 | 1;
  }>;
  const known = new Set<string>(BRANDS);
  return rows
    .filter(r => known.has(r.brand))
    .map(r => ({
      brand: r.brand as Brand,
      net: r.net,
      filings: r.filings,
      hasScraped: r.hasScraped === 1,
    }));
}

// Peer-relative score: lowest net movement in the window → 90, highest →
// 30, linear between. All-equal (or single-brand) windows score a neutral
// 60 — there's no peer spread to rank against, and confidence drops to low.
export function scoreNets(nets: number[], mine: number): number {
  const min = Math.min(...nets);
  const max = Math.max(...nets);
  if (max === min) return 60;
  return Math.round(90 - 60 * ((mine - min) / (max - min)));
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export type PricePillarByBrand = Partial<
  Record<Brand, Partial<Record<BhRangeKey, SourceBackedMetric>>>
>;

// Cache per state — the DB is read-only for the process lifetime, so the
// computation is idempotent until a redeploy ships a new filings.db.
const cache = new Map<string, PricePillarByBrand>();

export function computePriceMetrics(state: string): PricePillarByBrand {
  const hit = cache.get(state);
  if (hit) return hit;

  const asOf = getDataAsOf();
  const windows = rangeWindows(asOf);
  const result: PricePillarByBrand = {};

  for (const range of BH_RANGE_KEYS) {
    const nets = queryNets(state, windows[range]);
    if (nets.length === 0) continue;
    const netValues = nets.map(n => n.net);
    const peers = nets.length;

    for (const n of nets) {
      const metric: SourceBackedMetric = {
        value: scoreNets(netValues, n.net),
        sourceTier: n.hasScraped ? "official" : "licensed",
        sourceName: n.hasScraped
          ? "SERFF rate filings (Personal Auto)"
          : "AM Best industry rate data (Personal Auto)",
        dataAsOf: asOf,
        retrievedAt: asOf,
        confidence: peers >= 3 ? "medium" : "low",
        refreshCadence: "monthly",
        scope: "state",
        note:
          `Filed rate momentum: net ${fmtPct(n.net)} across ${n.filings} filing${n.filings === 1 ? "" : "s"} ` +
          `vs ${peers - 1} peer brand${peers - 1 === 1 ? "" : "s"} in this window. ` +
          `Lower filed increases than peers score higher. Rate movement, not price levels.`,
      };
      (result[n.brand] ??= {})[range] = metric;
    }
  }

  cache.set(state, result);
  return result;
}
