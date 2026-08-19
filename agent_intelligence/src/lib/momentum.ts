// Carrier Momentum (build spec Phase 3, 2026-08-19) — filed-rate-change
// streaks per competitor, derived from the PositioningResult the Overview
// fetches once from /api/positioning (approved amendment — no new endpoint).
//
// Definitions (spec):
//  - Per (carrier, state, line): order filings by effective date; a streak is
//    2+ CONSECUTIVE filings with the same direction (sign of the change).
//    Zero-change filings break a streak. Momentum = the TRAILING run — the
//    consecutive same-direction filings ending at the most recent one.
//  - Roll-up per carrier: every scored combo agrees → that direction with the
//    longest streak; combos disagree (or nothing scores despite 2+ filings)
//    → "Mixed · no trend"; exactly 1 filing in the window → not scored.
//  - Never an arrow for a single filing. Streaks count FILINGS, not months.
//
// Known coverage limit (flagged at the Phase 3 gate): the positioning result
// only carries competitor filings for cells where the agent's own carrier
// filed (anchored cells). A competitor active in a state-line the agent's
// carrier skipped is invisible here. Zero practical loss for current data;
// a dedicated endpoint would be the fix if that ever matters.

import type { Filing } from "./filings";
import type { PositioningResult } from "./positioning";

export type CarrierMomentum = {
  brand: string;
  kind: "trend" | "mixed" | "unscored";
  dir?: "up" | "down";  // trend only
  streak?: number;      // trend only — longest agreeing trailing streak
  filings: number;      // total in-window filings behind the row
};

// Trailing same-direction run. Returns {dir, len}; len < 2 means unscored.
function trailingStreak(filings: Filing[]): { dir: "up" | "down" | null; len: number } {
  const ordered = [...filings].sort((a, b) =>
    (a.effective_date ?? "").localeCompare(b.effective_date ?? "") || a.id - b.id);
  let dir: "up" | "down" | null = null;
  let len = 0;
  for (const f of ordered) {
    const d = f.overall_rate_impact > 0 ? "up" : f.overall_rate_impact < 0 ? "down" : null;
    if (d === null) { dir = null; len = 0; continue; } // zero breaks the run
    if (d === dir) len += 1;
    else { dir = d; len = 1; }
  }
  return { dir, len };
}

export function computeCarrierMomentum(
  result: PositioningResult,
  max = 5,
): CarrierMomentum[] {
  // Pool competitor filings per (brand, cell). Competitor stats are identical
  // across anchors within a cell, so read them from anchors[0] once.
  const byBrand = new Map<string, Filing[][]>(); // brand -> one filings[] per cell
  for (const cell of result.anchoredCells) {
    const first = cell.anchors[0];
    if (!first) continue;
    for (const c of first.comparisons) {
      const arr = byBrand.get(c.competitor.brand) ?? [];
      arr.push(c.competitor.filings);
      byBrand.set(c.competitor.brand, arr);
    }
  }

  const rows: CarrierMomentum[] = [];
  byBrand.forEach((cells, brand) => {
    const total = cells.reduce((s, fs) => s + fs.length, 0);
    if (total === 1) {
      rows.push({ brand, kind: "unscored", filings: total });
      return;
    }
    const scored = cells
      .map(trailingStreak)
      .filter(s => s.dir !== null && s.len >= 2) as { dir: "up" | "down"; len: number }[];
    if (scored.length === 0) {
      rows.push({ brand, kind: "mixed", filings: total });
      return;
    }
    const dirs = new Set(scored.map(s => s.dir));
    if (dirs.size > 1) {
      rows.push({ brand, kind: "mixed", filings: total });
      return;
    }
    rows.push({
      brand,
      kind: "trend",
      dir: scored[0].dir,
      streak: Math.max(...scored.map(s => s.len)),
      filings: total,
    });
  });

  // Rank: scored trends (longest streak first), then mixed, then unscored —
  // the cap therefore drops unscored rows before anything scored.
  const rank = (r: CarrierMomentum) => (r.kind === "trend" ? 0 : r.kind === "mixed" ? 1 : 2);
  rows.sort((a, b) =>
    rank(a) - rank(b)
    || (b.streak ?? 0) - (a.streak ?? 0)
    || b.filings - a.filings
    || a.brand.localeCompare(b.brand));
  return rows.slice(0, max);
}
