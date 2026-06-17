// Own-carrier alert signals — two directions, both about the agent's OWN
// carrier(s), so "My Carrier" is an honest umbrella label:
//
//   - Retention risk  — own-carrier rate INCREASES (>= +5%): your books are the
//     ones most likely to shop. The My-Carrier analog of Defend.
//   - Opportunity     — own-carrier rate DECREASES (<= -2%): your carrier got
//     cheaper → you're more competitive → good time to win new business.
//
// DISTINCT from the competitive Prospect/Defend signals (which are about
// COMPETITORS and stay unchanged). Both directions reuse the SAME own-carrier
// set (getMyCarriersFilings — brand IN authorized_brands already applied, so
// captives and independents both work) and the SAME 6-month window, so the
// /my-carriers page and the Overview "My Carrier" alert card reconcile by
// construction.

import { DEFEND_THRESHOLD, PROSPECT_THRESHOLD } from "./constants";
import type { Filing } from "./filings";

// Retention DELIBERATELY reuses PROSPECT_THRESHOLD (+5%) and Opportunity reuses
// DEFEND_THRESHOLD (-2%): the same "move big enough to matter" magnitudes as the
// competitive view, but interpreted own-book (your carrier moved) instead of
// competitor. Split into distinct constants here if these later prove too noisy.
export const RETENTION_THRESHOLD = PROSPECT_THRESHOLD;   // >= +5%  (increase)
export const OPPORTUNITY_THRESHOLD = DEFEND_THRESHOLD;   // <= -2%  (decrease)

// Both directions deliberately use a TIGHTER window than the app's 12-month
// active/competitive window (DEFAULT_WINDOW). Own-carrier alerts are more
// time-sensitive: a customer reacts right after a NEW bill lands, so a move from
// ~9 months ago is far less actionable than one from last month. This divergence
// from the 12-month view is INTENTIONAL, not an inconsistency. Windows on
// effective_date (the same column the rest of the app windows on), anchored to
// the data as-of date so it's reproducible, not wall-clock.
export const RETENTION_WINDOW_MONTHS = 6;

export type OwnCarrierSignal = {
  filings: Filing[];      // in-window own-carrier moves, EFFECTIVE-DATE DESC
  count: number;
  largest: Filing | null; // biggest-magnitude in-window move (for "largest …"
                          // labels), independent of the list order
};

// asOf − RETENTION_WINDOW_MONTHS as an ISO YYYY-MM-DD cutoff. setUTCMonth handles
// year underflow (e.g. June − 6 → previous December).
function windowCutoff(asOf: string): string {
  const d = new Date(`${asOf}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - RETENTION_WINDOW_MONTHS);
  return d.toISOString().slice(0, 10);
}

// Shared core for both directions. `pass` selects by impact; `moreExtreme` picks
// the "largest" (biggest increase for retention, biggest cut for opportunity).
function ownCarrierSignal(
  myCarrierFilings: Filing[],
  asOf: string,
  pass: (impact: number) => boolean,
  moreExtreme: (a: Filing, b: Filing) => Filing,
): OwnCarrierSignal {
  // No as-of yet (initial client render / prerender before the API resolves) →
  // no window to anchor on, so no set. Guards `new Date("")` (Invalid Date).
  if (!asOf) return { filings: [], count: 0, largest: null };
  const cutoff = windowCutoff(asOf);
  const filings = myCarrierFilings
    .filter(f =>
      pass(f.overall_rate_impact) &&
      f.effective_date != null &&
      f.effective_date >= cutoff)
    // Newest-first: the most recent move is where customers are reacting now.
    // Tie-break by larger magnitude.
    .sort((a, b) =>
      b.effective_date!.localeCompare(a.effective_date!)
      || Math.abs(b.overall_rate_impact) - Math.abs(a.overall_rate_impact));
  const largest = filings.length ? filings.reduce(moreExtreme) : null;
  return { filings, count: filings.length, largest };
}

// Own-carrier INCREASES >= +5% (retention risk). `largest` = biggest increase.
export function computeRetentionRisk(myCarrierFilings: Filing[], asOf: string): OwnCarrierSignal {
  return ownCarrierSignal(
    myCarrierFilings, asOf,
    impact => impact >= RETENTION_THRESHOLD,
    (a, b) => (b.overall_rate_impact > a.overall_rate_impact ? b : a),
  );
}

// Own-carrier DECREASES <= -2% (opportunity). `largest` = biggest cut (most
// negative). Often 0 — decreases are rare; a 0 count is honest ("no recent cuts").
export function computeOpportunity(myCarrierFilings: Filing[], asOf: string): OwnCarrierSignal {
  return ownCarrierSignal(
    myCarrierFilings, asOf,
    impact => impact <= OPPORTUNITY_THRESHOLD,
    (a, b) => (b.overall_rate_impact < a.overall_rate_impact ? b : a),
  );
}
