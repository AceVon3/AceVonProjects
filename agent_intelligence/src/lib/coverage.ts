// Pure (client-safe) helpers for the brand × state coverage note. The coverage
// MAP itself is produced server-side by getBrandStateCoverage() in filings.ts
// (a DB read) and shipped to the client in the /api/filings response; these
// functions only interpret it — no DB import, so they're safe in components.
//
// Purpose: honestly tell "we don't collect <brand> in <state> yet" apart from
// "<brand> made no recent moves in <state>". The 5 brands added with the GA
// expansion are GA-only until existing-state backfill; without this, a WA agent
// who authorizes Farmers would see "your book is safe" — which reads like a bug.

import { stateName } from "./briefing";

export type Coverage = Record<string, string[]>; // brand -> covered state codes

// Authorized brands that have NO filing data in ANY of the agent's states.
export function uncoveredBrands(
  authorized: string[],
  states: string[],
  coverage: Coverage,
): string[] {
  return authorized.filter(b => {
    const covered = coverage[b] ?? [];
    return !states.some(s => covered.includes(s));
  });
}

// The honest coverage-gap note, or null when every authorized brand has data in
// at least one of the agent's states (so a normal "no recent moves" empty state
// is the right message instead). Names each gap brand, where it IS covered, and
// the agent's states it doesn't reach yet.
export function coverageGapNote(
  authorized: string[],
  states: string[],
  coverage: Coverage,
): string | null {
  const gaps = uncoveredBrands(authorized, states, coverage);
  if (gaps.length === 0) return null;

  const where = gaps
    .map(b => {
      const cov = (coverage[b] ?? []).map(stateName);
      return cov.length
        ? `${b} data currently covers ${cov.join(", ")}`
        : `${b} has no filing data yet`;
    })
    .join("; ");
  const here = states.map(stateName).join(", ");
  const brandList = gaps.join(", ");
  return `${where}. We don't have ${brandList} filings for ${here} yet — ${here} coverage is coming.`;
}
