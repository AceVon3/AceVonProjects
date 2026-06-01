// Pure aggregation helpers shared by server (positioning) and client
// (overview) code. No DB / no client-only deps so both can import it.

import type { Filing } from "./filings";

// Premium-weighted average of overall_rate_impact over a set of filings,
// weighted by total_written_premium. Falls back to a simple mean only when
// every filing in the group lacks a usable (non-null, > 0) premium.
export function premiumWeightedAvg(
  filings: Filing[],
): { avg: number; weighted: boolean } {
  const withPrem = filings.filter(
    f => f.total_written_premium != null && f.total_written_premium > 0,
  );
  if (withPrem.length > 0) {
    let num = 0;
    let den = 0;
    for (const f of withPrem) {
      const p = f.total_written_premium as number;
      num += f.overall_rate_impact * p;
      den += p;
    }
    return { avg: num / den, weighted: true };
  }
  const mean = filings.reduce((s, f) => s + f.overall_rate_impact, 0) / filings.length;
  return { avg: mean, weighted: false };
}
