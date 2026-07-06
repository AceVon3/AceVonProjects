// Plain-language copy for the Positioning page, generated from the agent's
// REAL positioning result — never hardcoded carrier pairs.
//
// Two pieces:
//   - dateRangeNote(asOf): states what the query actually covers (the rolling
//     12-month effective-date window, DEFAULT_WINDOW in constants.ts). If the
//     window ever changes, this wording must change with it — the label and
//     the query must never drift apart.
//   - buildExplainer(result): interprets one real comparison cell. Uses BOTH
//     averages plus the pts-spread (the honest differential — a carrier's own
//     average is not "X% more than" a competitor). Higher-confidence
//     comparisons only: thin comparisons deliberately have no spread, so with
//     zero high-confidence comparisons there is no explainer.
//
// Language rule: no determinations. Never "you are cheaper" / "switch" — the
// wording must pass the same determination blocklist verify_office_summary
// and verify_briefing_language enforce (e2e_positioning scans the rendered
// text).

import type { PositioningResult } from "./positioning";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

// "2026-06-11" → note describing the 12-month effective-date window the
// positioning query actually applies (date(asOf, '-12 months'), no upper
// bound — future-dated pending changes are included).
export function dateRangeNote(asOf: string): string {
  const [y, m, d] = asOf.split("-").map(Number);
  const since = `${MONTHS[m - 1]} ${y - 1}`;
  const asOfLabel = `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
  return (
    `Comparisons cover filings effective in the last 12 months (since ${since}), ` +
    `plus announced changes not yet effective. Data as of ${asOfLabel}.`
  );
}

// One sentence pair interpreting the agent's richest real comparison, or null
// when the view has no higher-confidence comparison to interpret.
export function buildExplainer(result: PositioningResult): string | null {
  // Cells are sorted richest-first; take the first cell holding any
  // higher-confidence comparison, then its largest |spread| across anchors.
  for (const cell of result.anchoredCells) {
    let best: { agentBrand: string; agentAvg: number; compBrand: string; compAvg: number; spread: number } | null = null;
    for (const anchor of cell.anchors) {
      for (const c of anchor.comparisons) {
        if (c.tier !== "high" || c.spread === null) continue;
        if (!best || Math.abs(c.spread) > Math.abs(best.spread)) {
          best = {
            agentBrand: anchor.agent.brand,
            agentAvg: anchor.agent.avgChange,
            compBrand: c.competitor.brand,
            compAvg: c.competitor.avgChange,
            spread: c.spread,
          };
        }
      }
    }
    if (!best) continue;

    const pct = (v: number) => Math.abs(v).toFixed(1);
    const moved = (v: number) => (v < 0 ? "fallen" : "risen");
    const verb = best.agentAvg < 0 ? "lowered" : "raised";
    // "more" when the agent out-moved the competitor in its own direction:
    // fell further below (spread > 0) or rose further above (spread < 0).
    const moreLess = (best.agentAvg < 0) === (best.spread > 0) ? "more" : "less";
    // The brand whose rates moved UP in relative terms carries the caveat.
    const riser = best.spread > 0 ? best.compBrand : best.agentBrand;
    const other = best.spread > 0 ? best.agentBrand : best.compBrand;

    return (
      `In ${cell.state} ${cell.line}, ${best.agentBrand}'s filed rates have ` +
      `${moved(best.agentAvg)} an average of ${pct(best.agentAvg)}% over the last 12 months, ` +
      `while ${best.compBrand}'s have ${moved(best.compAvg)} ${pct(best.compAvg)}% — ` +
      `${best.agentBrand} has ${verb} rates ${pct(best.spread)} points ${moreLess} than ${best.compBrand}. ` +
      `Note: ${riser} may still be cheaper in absolute terms — these figures are rate changes, ` +
      `not premium levels — but ${riser}'s rates have risen relative to ${other}'s over this period.`
    );
  }
  return null;
}
