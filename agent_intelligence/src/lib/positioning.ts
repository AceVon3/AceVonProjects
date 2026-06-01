// Feature 7 — Rate Positioning computation (server-side; reads filings.db).
//
// Per (line, state) where the agent's carrier(s) filed, compute each carrier's
// premium-weighted average rate CHANGE and compare it against each competitor
// individually. No new data path — same active/12-month/non-null-effective
// filter as Prospect/Defend, so the recon verification numbers reproduce
// (captive State Farm, all 8 states → 10 anchored / 41 comparable / 24 high).
//
// Confidence tiering (the honesty mechanic):
//   - higher-confidence: BOTH sides >= 2 filings → a genuine average; spread shown
//   - thin: either side has exactly 1 filing → a one-filing side is "1 filing: +X%"
//     (never "avg"), and NO pts-spread is computed (decided 2026-05-29).

import { premiumWeightedAvg } from "./aggregate";
import { ACTIVE_RATE_ACTIVITIES, Brand, BRANDS, DEFAULT_WINDOW, WINDOW_MODIFIERS, WindowKey } from "./constants";
import { getDataAsOf, getDb } from "./db";
import type { AgentProfile, Filing } from "./filings";

export type Line = "Personal Auto" | "Homeowners";
const LINES: readonly Line[] = ["Personal Auto", "Homeowners"];

export type ConfidenceTier = "high" | "thin";

// One brand's filings within a single (line, state) cell, rolled to an average.
export type BrandStat = {
  brand: Brand;
  count: number;
  avgChange: number;     // premium-weighted average of overall_rate_impact
  weighted: boolean;     // false = fell back to unweighted mean (all premiums null/0)
  filings: Filing[];     // underlying rows, for the audit panel
};

export type Comparison = {
  competitor: BrandStat;       // count >= 1 (comparable)
  tier: ConfidenceTier;
  // Signed pts difference competitorAvg - agentAvg, ONLY for higher-confidence
  // comparisons (both sides genuine averages). null for thin — a spread between
  // an average and a single filing over-implies certainty.
  spread: number | null;
};

export type AnchorBlock = {
  agent: BrandStat;            // an agent carrier present in the cell (count >= 1)
  comparisons: Comparison[];   // comparable competitors, sorted (high first)
  insufficient: Brand[];       // competitors with 0 filings in this cell
};

export type PositioningCell = {
  line: Line;
  state: string;
  anchors: AnchorBlock[];      // one per agent carrier present (captive: exactly 1)
  comparableCount: number;     // total comparisons in the cell
  higherConfidenceCount: number;
};

export type PositioningResult = {
  agentCarriers: Brand[];
  competitorBrands: Brand[];
  anchoredCells: PositioningCell[];
  unanchoredCells: { line: Line; state: string }[];
  totals: {
    anchoredCellCount: number;
    unanchoredCellCount: number;
    comparable: number;
    higherConfidence: number;
    thin: number;
    insufficient: number;
  };
};

export type PositioningOpts = { window?: WindowKey; asOf?: string };

function placeholders(n: number): string {
  return Array.from({ length: n }, () => "?").join(", ");
}

// Pull every active filing in the agent's licensed states within the window
// (all brands — competitors are the whole market, not gated by license).
function fetchCellFilings(states: string[], opts?: PositioningOpts): Filing[] {
  if (states.length === 0) return [];
  const mod = WINDOW_MODIFIERS[opts?.window ?? DEFAULT_WINDOW];
  const ref = opts?.asOf ?? getDataAsOf();
  const activities = [...ACTIVE_RATE_ACTIVITIES];
  const sql = `
    SELECT id, serff_tracking_number, state, brand, line_of_business,
           overall_rate_impact, rate_activity, effective_date, filing_date,
           entity_count, total_policyholders, total_written_premium,
           min_entity_impact, max_entity_impact, entity_names, disposition_status,
           sub_type
    FROM filings
    WHERE state IN (${placeholders(states.length)})
      AND rate_activity IN (${placeholders(activities.length)})
      AND effective_date IS NOT NULL
      AND effective_date >= date(?, ?)
  `;
  return getDb()
    .prepare(sql)
    .all(...states, ...activities, ref, mod) as Filing[];
}

export function getPositioning(
  profile: AgentProfile,
  opts?: PositioningOpts,
): PositioningResult {
  const states = [...profile.licensed_states];
  const agentSet = new Set<string>(profile.authorized_brands);
  const agentCarriers = BRANDS.filter(b => agentSet.has(b));
  const competitorBrands = BRANDS.filter(b => !agentSet.has(b));

  const rows = fetchCellFilings(states, opts);

  // Group filings → byCell[line][state][brand] = Filing[]
  const byCell = new Map<string, Map<string, Map<Brand, Filing[]>>>();
  const key = (line: string, state: string) => `${line}@@${state}`;
  for (const f of rows) {
    const line = f.line_of_business;
    const k = key(line, f.state);
    let states2 = byCell.get(k);
    if (!states2) { states2 = new Map(); byCell.set(k, states2); }
    let brands = states2.get(f.state);
    if (!brands) { brands = new Map(); states2.set(f.state, brands); }
    const arr = brands.get(f.brand) ?? [];
    arr.push(f);
    brands.set(f.brand, arr);
  }

  const stat = (brand: Brand, filings: Filing[]): BrandStat => {
    const { avg, weighted } = premiumWeightedAvg(filings);
    return { brand, count: filings.length, avgChange: avg, weighted, filings };
  };

  const anchoredCells: PositioningCell[] = [];
  const unanchoredCells: { line: Line; state: string }[] = [];
  let comparable = 0, higherConfidence = 0, thin = 0, insufficient = 0;

  for (const line of LINES) {
    for (const state of states) {
      const brands = byCell.get(key(line, state))?.get(state);
      const brandFilings = (b: Brand): Filing[] => brands?.get(b) ?? [];

      const ownersPresent = agentCarriers.filter(b => brandFilings(b).length > 0);
      if (ownersPresent.length === 0) {
        unanchoredCells.push({ line, state });
        continue;
      }

      const anchors: AnchorBlock[] = [];
      let cellComparable = 0, cellHigh = 0;

      for (const owner of ownersPresent) {
        const agentStat = stat(owner, brandFilings(owner));
        const comparisons: Comparison[] = [];
        const insuff: Brand[] = [];
        for (const c of competitorBrands) {
          const cf = brandFilings(c);
          if (cf.length === 0) { insuff.push(c); continue; }
          const competitor = stat(c, cf);
          const isHigh = agentStat.count >= 2 && competitor.count >= 2;
          comparisons.push({
            competitor,
            tier: isHigh ? "high" : "thin",
            spread: isHigh ? competitor.avgChange - agentStat.avgChange : null,
          });
          comparable++;
          cellComparable++;
          if (isHigh) { higherConfidence++; cellHigh++; } else { thin++; }
        }
        insufficient += insuff.length;
        // Sort: higher-confidence first, then by filing count desc, then name.
        comparisons.sort((a, b) =>
          (a.tier === b.tier ? 0 : a.tier === "high" ? -1 : 1)
          || b.competitor.count - a.competitor.count
          || a.competitor.brand.localeCompare(b.competitor.brand),
        );
        anchors.push({ agent: agentStat, comparisons, insufficient: insuff });
      }

      anchoredCells.push({
        line, state, anchors,
        comparableCount: cellComparable,
        higherConfidenceCount: cellHigh,
      });
    }
  }

  // Richest comparisons first: high-confidence count desc, comparable desc,
  // then line (Personal Auto before Homeowners), then state.
  const lineOrder = (l: Line) => (l === "Personal Auto" ? 0 : 1);
  anchoredCells.sort((a, b) =>
    b.higherConfidenceCount - a.higherConfidenceCount
    || b.comparableCount - a.comparableCount
    || lineOrder(a.line) - lineOrder(b.line)
    || a.state.localeCompare(b.state),
  );

  return {
    agentCarriers,
    competitorBrands,
    anchoredCells,
    unanchoredCells,
    totals: {
      anchoredCellCount: anchoredCells.length,
      unanchoredCellCount: unanchoredCells.length,
      comparable,
      higherConfidence,
      thin,
      insufficient,
    },
  };
}
