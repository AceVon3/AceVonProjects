// Headline signals — the plain-English synthesis layer over data the app
// already computes. Two producers for two surfaces (decided 2026-08-14):
//
//   - computePositioningSignals(result)  — Positioning page strip. Derived
//     ONLY from the PositioningResult the page already fetched, so the strip
//     summarizes exactly the grid below it (pass the same filtered view the
//     cards render, never the raw result).
//   - computeRecentSignals({...})        — Overview strip. Recency-driven:
//     reads the same Prospect/Defend/My-Carriers row sets the dashboard
//     already fetches, windowed to the last RECENT_WINDOW_MONTHS (plus
//     future-dated pending changes — those are the most actionable).
//
// Both are pure (no DB, no client-only deps), like aggregate.ts.
//
// Language rule: signals describe what the MARKET did, never a per-reader
// determination — the wording must pass the same blocklist e2e_positioning
// scans for ("you are cheaper", "switch to", …). Spread-based signals fire
// on higher-confidence comparisons only, matching the honesty tiering.

import { premiumWeightedAvg } from "./aggregate";
import { Brand, DEFEND_THRESHOLD, PROSPECT_THRESHOLD } from "./constants";
import type { Filing } from "./filings";
import { formatEffectiveDate, formatRateImpact } from "./format";
import type { BadgeColor } from "./format";
import type { PositioningResult } from "./positioning";

export type SignalKind =
  | "price-pressure"    // competitor raising — prospect angle
  | "defend-state"      // competitor cutting where you stand — risk
  | "trend"             // your own carrier's direction
  | "favorable-spread"  // high-confidence: competitor out-raised you
  | "market-wide";      // everyone in a state moved the same way

export type Signal = {
  kind: SignalKind;
  label: string;      // short chip text ("Price pressure on Allstate")
  detail: string;     // one-line supporting fact, with the numbers
  tone: BadgeColor;   // same palette the badges use (b-green / b-red / …)
  href: string;       // drill-in page that backs the signal up
  magnitude: number;  // ranking key (pct-points, absolute)
  state?: string;
  brand?: string;
};

// Signal-specific thresholds. Prospect/Defend magnitudes reuse the app-wide
// constants; these three are new judgment lines introduced with this feature.
export const TREND_MIN_ABS = 2;          // |own avg| >= 2% with >=2 filings = a trend
export const FAVORABLE_SPREAD_MIN = 3;   // competitor out-raised you by >= 3 pts
export const MARKET_WIDE_MIN_BRANDS = 3; // fewer brands isn't "market-wide"
export const MAX_SIGNALS = 6;            // strip cap — headline, not a feed
export const RECENT_WINDOW_MONTHS = 6;   // Overview recency window (matches retention.ts)

const pct = formatRateImpact;

// ---------------------------------------------------------------------------
// Positioning-derived signals (Positioning page strip)
// ---------------------------------------------------------------------------

export function computePositioningSignals(
  result: PositioningResult,
  max = MAX_SIGNALS,
): Signal[] {
  const signals: Signal[] = [];

  // Competitor stats are identical across anchors within a cell (same
  // underlying filings), so read them from anchors[0] once per cell.
  // Price-pressure pools a competitor's filings ACROSS cells; the same filing
  // never repeats across cells (one state each), so no id-dedup is needed.
  const pressureFilings = new Map<Brand, Filing[]>();
  const pressureStates = new Map<Brand, Set<string>>();

  // Per-state bests, so one loud state doesn't emit near-duplicate chips.
  const bestDefend = new Map<string, Signal>();
  const bestTrend = new Map<string, Signal>();
  const bestSpread = new Map<string, Signal>();

  for (const cell of result.anchoredCells) {
    const first = cell.anchors[0];
    if (!first) continue;

    for (const cmp of first.comparisons) {
      const c = cmp.competitor;
      // Pool for price pressure (threshold applied after pooling).
      const pool = pressureFilings.get(c.brand) ?? [];
      pool.push(...c.filings);
      pressureFilings.set(c.brand, pool);
      const st = pressureStates.get(c.brand) ?? new Set<string>();
      st.add(cell.state);
      pressureStates.set(c.brand, st);

      // Defend: a competitor cut in this cell. Sharpened when your carrier
      // is up in the same cell (their cut lands against your increase).
      if (c.avgChange <= DEFEND_THRESHOLD) {
        const upAnchor = cell.anchors.find(a => a.agent.avgChange > 0);
        const filedLabel = c.count === 1 ? "filed" : `avg across ${c.count} filings:`;
        const detail = upAnchor
          ? `${c.brand} ${filedLabel} ${pct(c.avgChange)} in ${cell.line} while ${upAnchor.agent.brand} is at ${pct(upAnchor.agent.avgChange)}.`
          : `${c.brand} ${filedLabel} ${pct(c.avgChange)} in ${cell.line}.`;
        const magnitude = Math.abs(c.avgChange) + (upAnchor ? upAnchor.agent.avgChange : 0);
        const prev = bestDefend.get(cell.state);
        if (!prev || magnitude > prev.magnitude) {
          bestDefend.set(cell.state, {
            kind: "defend-state",
            label: `Defend in ${cell.state}`,
            detail,
            tone: "red",
            href: "/defend",
            magnitude,
            state: cell.state,
            brand: c.brand,
          });
        }
      }

    }

    // Favorable spread: higher-confidence only (thin comparisons carry no
    // spread by design). spread = competitor − agent, so positive means the
    // competitor's filed rates rose more than yours did. Scans EVERY anchor —
    // an independent's carriers each have their own spread vs a competitor.
    for (const anchor of cell.anchors) {
      for (const cmp of anchor.comparisons) {
        if (cmp.tier !== "high" || cmp.spread === null || cmp.spread < FAVORABLE_SPREAD_MIN) continue;
        const c = cmp.competitor;
        const prev = bestSpread.get(cell.state);
        if (!prev || cmp.spread > prev.magnitude) {
          bestSpread.set(cell.state, {
            kind: "favorable-spread",
            label: `Favorable spread in ${cell.state} vs ${c.brand}`,
            detail:
              `${cell.line}: ${c.brand}'s filed rates rose ${cmp.spread.toFixed(1)} pts more than ` +
              `${anchor.agent.brand}'s over the window (${pct(c.avgChange)} vs ${pct(anchor.agent.avgChange)}).`,
            tone: "green",
            href: "/positioning",
            magnitude: cmp.spread,
            state: cell.state,
            brand: c.brand,
          });
        }
      }
    }

    // Trend: your own carrier's direction — genuine averages only (>=2
    // filings), so a single filing never reads as a "trend".
    for (const anchor of cell.anchors) {
      const a = anchor.agent;
      if (a.count < 2 || Math.abs(a.avgChange) < TREND_MIN_ABS) continue;
      const up = a.avgChange > 0;
      const magnitude = Math.abs(a.avgChange);
      const prev = bestTrend.get(cell.state);
      if (!prev || magnitude > prev.magnitude) {
        bestTrend.set(cell.state, {
          kind: "trend",
          label: `${a.brand} trending ${up ? "up" : "down"} in ${cell.state}`,
          detail: `${pct(a.avgChange)} avg across ${a.count} ${cell.line} filings.`,
          tone: up ? "amber" : "green",
          href: "/my-carriers",
          magnitude,
          state: cell.state,
          brand: a.brand,
        });
      }
    }

    // Market-wide: every brand with filings in the cell moved the same
    // direction, and enough brands are present for "market" to be honest.
    const avgs = [
      ...cell.anchors.map(a => a.agent.avgChange),
      ...first.comparisons.map(x => x.competitor.avgChange),
    ];
    const brandCount = cell.anchors.length + first.comparisons.length;
    if (brandCount >= MARKET_WIDE_MIN_BRANDS && avgs.every(v => v > 0)) {
      const lo = Math.min(...avgs), hi = Math.max(...avgs);
      signals.push({
        kind: "market-wide",
        label: `Rates rising market-wide in ${cell.state}`,
        detail: `All ${brandCount} carriers with ${cell.line} filings are up — from ${pct(lo)} to ${pct(hi)}.`,
        tone: "blue",
        href: "/positioning",
        magnitude: hi,
        state: cell.state,
      });
    } else if (brandCount >= MARKET_WIDE_MIN_BRANDS && avgs.every(v => v < 0)) {
      const lo = Math.min(...avgs), hi = Math.max(...avgs);
      signals.push({
        kind: "market-wide",
        label: `Rates falling market-wide in ${cell.state}`,
        detail: `All ${brandCount} carriers with ${cell.line} filings are down — from ${pct(hi)} to ${pct(lo)}.`,
        tone: "blue",
        href: "/positioning",
        magnitude: Math.abs(lo),
        state: cell.state,
      });
    }
  }

  // Price pressure: pooled premium-weighted average per competitor across
  // every cell they appear in; fires at the same +5% line Prospect uses, and
  // only on a genuine average (>=2 filings).
  pressureFilings.forEach((filings, brand) => {
    if (filings.length < 2) return;
    const { avg } = premiumWeightedAvg(filings);
    if (avg < PROSPECT_THRESHOLD) return;
    const states = Array.from(pressureStates.get(brand) ?? []).sort();
    const where = states.length === 1 ? states[0] : `${states.length} of your states`;
    signals.push({
      kind: "price-pressure",
      label: `Price pressure on ${brand}`,
      detail: `${pct(avg)} avg across ${filings.length} filings in ${where}.`,
      tone: "green",
      href: "/prospect",
      magnitude: avg,
      brand,
    });
  });

  bestDefend.forEach(s => signals.push(s));
  bestTrend.forEach(s => signals.push(s));
  bestSpread.forEach(s => signals.push(s));
  return rankAndCap(signals, max);
}

// ---------------------------------------------------------------------------
// Recency-driven signals (Overview strip)
// ---------------------------------------------------------------------------

export type RecentSignalInputs = {
  prospect: Filing[];    // the exact rows /prospect renders
  defend: Filing[];      // the exact rows /defend renders
  myCarriers: Filing[];  // the exact rows /my-carriers renders
  asOf: string;
  // The agent's own brands. Needed because the INDEPENDENT visibility model
  // puts own-carrier increases in the Prospect rows (an independent can write
  // against their own carrier's increase with another carrier) — but in the
  // strip that story is the "trending up" signal's job. Without this filter,
  // an own-brand increase would emit BOTH "Price pressure on X" and
  // "X trending up" — the same fact twice.
  authorizedBrands: string[];
};

// asOf − RECENT_WINDOW_MONTHS as ISO cutoff (same construction retention.ts
// uses, anchored to the data as-of date so it's reproducible).
function recentCutoff(asOf: string): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - RECENT_WINDOW_MONTHS);
  return d.toISOString().slice(0, 10);
}

// Days between effective_date and asOf, absolute — the recency key. Future-
// dated rows are included (upcoming changes are the most actionable) and
// score by how soon they land.
function daysFrom(asOf: string, effective: string): number {
  return Math.abs(
    Math.round((Date.parse(`${effective}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000),
  );
}

export function computeRecentSignals(
  inputs: RecentSignalInputs,
  max = MAX_SIGNALS,
): Signal[] {
  const { prospect, defend, myCarriers, asOf } = inputs;
  if (!asOf) return []; // pre-fetch render — no window to anchor on
  const own = new Set(inputs.authorizedBrands);
  const cutoff = recentCutoff(asOf);
  const inWindow = (f: Filing): boolean =>
    f.effective_date != null && f.effective_date >= cutoff;

  // recency (days from asOf) rides along for ranking, then is dropped.
  const scored: Array<Signal & { recency: number }> = [];

  // Price pressure on {brand}: recent Prospect rows grouped by brand. The
  // headline number is the LARGEST recent increase; the chip carries the count.
  const byBrand = new Map<string, Filing[]>();
  for (const f of prospect.filter(f => inWindow(f) && !own.has(f.brand))) {
    const arr = byBrand.get(f.brand) ?? [];
    arr.push(f);
    byBrand.set(f.brand, arr);
  }
  byBrand.forEach((rows, brand) => {
    const largest = rows.reduce((a, b) =>
      b.overall_rate_impact > a.overall_rate_impact ? b : a);
    const recency = Math.min(...rows.map(f => daysFrom(asOf, f.effective_date!)));
    const countLabel = rows.length === 1
      ? `${pct(largest.overall_rate_impact)} in ${largest.state} ${largest.line_of_business}`
      : `${rows.length} recent increases — largest ${pct(largest.overall_rate_impact)} (${largest.state} ${largest.line_of_business})`;
    scored.push({
      kind: "price-pressure",
      label: `Price pressure on ${brand}`,
      detail: `${countLabel}, effective ${formatEffectiveDate(largest.effective_date)}.`,
      tone: "green",
      href: "/prospect",
      magnitude: largest.overall_rate_impact,
      brand,
      recency,
    });
  });

  // Defend in {ST}: recent Defend rows grouped by state; headline = deepest cut.
  const byState = new Map<string, Filing[]>();
  for (const f of defend.filter(inWindow)) {
    const arr = byState.get(f.state) ?? [];
    arr.push(f);
    byState.set(f.state, arr);
  }
  byState.forEach((rows, state) => {
    const deepest = rows.reduce((a, b) =>
      b.overall_rate_impact < a.overall_rate_impact ? b : a);
    const recency = Math.min(...rows.map(f => daysFrom(asOf, f.effective_date!)));
    scored.push({
      kind: "defend-state",
      label: `Defend in ${state}`,
      detail:
        `${deepest.brand} filed ${pct(deepest.overall_rate_impact)} ${deepest.line_of_business}, ` +
        `effective ${formatEffectiveDate(deepest.effective_date)}` +
        (rows.length > 1 ? ` (+${rows.length - 1} more recent cut${rows.length > 2 ? "s" : ""})` : "") + ".",
      tone: "red",
      href: "/defend",
      magnitude: Math.abs(deepest.overall_rate_impact),
      state,
      recency,
    });
  });

  // Own-carrier trend: recent My-Carriers rows crossing either app-wide
  // threshold, grouped by brand+direction; headline = the biggest move.
  const ownMoves = myCarriers.filter(f =>
    inWindow(f) &&
    (f.overall_rate_impact >= PROSPECT_THRESHOLD || f.overall_rate_impact <= DEFEND_THRESHOLD));
  const byBrandDir = new Map<string, Filing[]>();
  for (const f of ownMoves) {
    const k = `${f.brand}@@${f.overall_rate_impact > 0 ? "up" : "down"}`;
    const arr = byBrandDir.get(k) ?? [];
    arr.push(f);
    byBrandDir.set(k, arr);
  }
  byBrandDir.forEach((rows, k) => {
    const up = k.endsWith("@@up");
    const biggest = rows.reduce((a, b) =>
      Math.abs(b.overall_rate_impact) > Math.abs(a.overall_rate_impact) ? b : a);
    const recency = Math.min(...rows.map(f => daysFrom(asOf, f.effective_date!)));
    scored.push({
      kind: "trend",
      label: `${biggest.brand} trending ${up ? "up" : "down"}`,
      detail:
        `${pct(biggest.overall_rate_impact)} in ${biggest.state} ${biggest.line_of_business}, ` +
        `effective ${formatEffectiveDate(biggest.effective_date)}` +
        (rows.length > 1 ? ` (${rows.length} recent ${up ? "increases" : "decreases"})` : "") + ".",
      tone: up ? "amber" : "green",
      href: "/my-carriers",
      magnitude: Math.abs(biggest.overall_rate_impact),
      brand: biggest.brand,
      recency,
    });
  });

  // Recency first (the Overview strip's whole premise), magnitude breaks ties.
  scored.sort((a, b) => a.recency - b.recency || b.magnitude - a.magnitude);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- rest-omit of the ranking key
  return scored.slice(0, max).map(({ recency, ...s }) => s);
}

// Magnitude-ranked, capped. Stable tie-break by label so renders don't shuffle.
function rankAndCap(signals: Signal[], max: number): Signal[] {
  return [...signals]
    .sort((a, b) => b.magnitude - a.magnitude || a.label.localeCompare(b.label))
    .slice(0, max);
}
