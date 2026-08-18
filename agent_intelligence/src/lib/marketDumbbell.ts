// You-vs-market dumbbell rows — the data behind the Positioning page's
// headline chart (ported from the 2026-08 design handback). Pure derivation
// over the PositioningResult the page already fetched: per state, the agent
// side pools the agent's carrier filings and the market side pools EVERY
// comparable competitor's filings, both premium-weighted with the same
// aggregate.ts rule everything else uses — so the dumbbell reconciles with
// the comparison cards by construction.
//
// Sign convention (decided 2026-08-18): gap = you − market, signed. Negative
// means the agent's filed change ran further down than the market average;
// positive further up. It reads as a property of the agent's carrier and
// matches the quadrant view's parity-line geometry, should that ever ship.
//
// Honesty rules (behaviors, not copy — from the handback notes §4):
//   - thin = either side has fewer than 2 filings. A thin row gets NO gap
//     (null), draws no connector, and is excluded from headline counts. Same
//     ">= 2 makes a genuine average" line the engine's confidence tier draws.
//   - A state with no agent filing gets no row at all (it stays in the
//     result's unanchoredCells; the page names it — no zero is faked).

import { premiumWeightedAvg } from "./aggregate";
import type { Filing } from "./filings";
import type { Line, PositioningResult } from "./positioning";

export type DumbbellRow = {
  state: string;
  you: number;      // premium-weighted avg of the agent's filings in the cell
  youN: number;
  market: number;   // premium-weighted avg pooled across ALL competitors present
  marketN: number;
  brandsN: number;  // competitor brands behind the market average
  thin: boolean;
  gap: number | null; // you − market, null when thin
};

export type DumbbellData = {
  rows: DumbbellRow[];      // comparable first (|gap| desc), thin pinned last
  notPlotted: string[];     // states with no agent filing for this line
  comparableCount: number;
  belowCount: number;       // comparable rows with gap < 0
  headline: DumbbellRow | null; // comparable row with the largest |gap|
};

export function computeMarketDumbbell(
  result: PositioningResult,
  line: Line,
): DumbbellData {
  const rows: DumbbellRow[] = [];

  for (const cell of result.anchoredCells) {
    if (cell.line !== line) continue;
    // Pool the agent side across anchors: captives have exactly one; an
    // independent's carriers merge into one "your carriers" average under
    // the same premium-weighting rule (filings never repeat across anchors).
    const youFilings: Filing[] = cell.anchors.flatMap(a => a.agent.filings);
    // Competitor stats are identical across anchors (same underlying rows),
    // so pool the market side from anchors[0] only.
    const marketFilings: Filing[] =
      cell.anchors[0]?.comparisons.flatMap(c => c.competitor.filings) ?? [];
    if (youFilings.length === 0 || marketFilings.length === 0) continue;

    const you = premiumWeightedAvg(youFilings);
    const market = premiumWeightedAvg(marketFilings);
    const thin = youFilings.length < 2 || marketFilings.length < 2;
    rows.push({
      state: cell.state,
      you: you.avg,
      youN: youFilings.length,
      market: market.avg,
      marketN: marketFilings.length,
      brandsN: cell.anchors[0]?.comparisons.length ?? 0,
      thin,
      gap: thin ? null : you.avg - market.avg,
    });
  }

  rows.sort((a, b) => {
    if (a.thin !== b.thin) return a.thin ? 1 : -1; // thin pinned last
    return Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0)
      || a.state.localeCompare(b.state);
  });

  const comparable = rows.filter(r => !r.thin);
  return {
    rows,
    notPlotted: result.unanchoredCells
      .filter(c => c.line === line)
      .map(c => c.state)
      .sort(),
    comparableCount: comparable.length,
    belowCount: comparable.filter(r => (r.gap ?? 0) < 0).length,
    headline: comparable[0] ?? null,
  };
}
