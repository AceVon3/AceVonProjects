// Overview-page composition helpers.
//
// `computeRecentChanges` works strictly over the result sets of the Prospect and
// Defend query builders — i.e. the exact same rows the table pages render — so
// the feed reconciles with /prospect and /defend by construction (spec §"Data
// note").
//
// (The former Most-Urgent and "Your carrier's activity" helpers were removed
// 2026-06-17 when the dashboard's single-alert card was replaced by the
// two-direction "My Carrier" alert card — see src/lib/retention.ts, which now
// owns both own-carrier signals: computeRetentionRisk + computeOpportunity.)

import type { Filing } from "./filings";

export type OverviewClassification = "prospect" | "defend";

// One day in ms, used so the math reads.
const DAY_MS = 86_400_000;

export type FeedRow = {
  filing: Filing;
  classification: OverviewClassification;
  ageWeeks: number; // absolute weeks from asOf; negative direction encoded in `future`
  future: boolean;
};

// Newest-first feed of threshold-crossing filings, capped at `max`.
// Rows without effective_date sink to the bottom.
export function computeRecentChanges(
  prospect: Filing[],
  defend: Filing[],
  asOf: string,
  max = 8,
): FeedRow[] {
  const asOfMs = Date.parse(`${asOf}T00:00:00Z`);
  const all: FeedRow[] = [];
  for (const f of prospect) all.push(toFeedRow(f, "prospect", asOfMs));
  for (const f of defend) all.push(toFeedRow(f, "defend", asOfMs));
  all.sort((a, b) => {
    // Sort by effective date desc, nulls last
    const ea = a.filing.effective_date
      ? Date.parse(`${a.filing.effective_date}T00:00:00Z`)
      : -Infinity;
    const eb = b.filing.effective_date
      ? Date.parse(`${b.filing.effective_date}T00:00:00Z`)
      : -Infinity;
    return eb - ea;
  });
  return all.slice(0, max);
}

function toFeedRow(
  f: Filing,
  classification: OverviewClassification,
  asOfMs: number,
): FeedRow {
  if (!f.effective_date) {
    return { filing: f, classification, ageWeeks: 0, future: false };
  }
  const ms = Date.parse(`${f.effective_date}T00:00:00Z`);
  const days = Math.round((ms - asOfMs) / DAY_MS);
  return {
    filing: f,
    classification,
    ageWeeks: Math.abs(Math.round(days / 7)),
    future: days > 0,
  };
}

// ---------------------------------------------------------------------------
// Biggest Mover (Overview quick-hitter, build spec Phase 1, 2026-08-19)
// ---------------------------------------------------------------------------
// Largest absolute filed change among the merged Prospect+Defend signal rows
// whose effective_date falls within ±30 days of asOf. The spec's window is
// "the last 30 days" but its display contract includes a future-dated branch
// ("Effective [date] …"), so the window runs 30 days each side — announced
// changes landing this month are movers too. effective_date is the ONLY
// window field (filing_date is null on most rows — recon 2026-08-19).
//
// The badge mode is CARRIED FROM THE SOURCE SET, never derived from the sign
// of the change (approved amendment): prospect and defend are threshold
// classifications that happen to be disjoint today, but the sign is not the
// classification.

export type BiggestMover = {
  filing: Filing;
  mode: OverviewClassification;
  future: boolean; // effective_date after asOf
};

export function computeBiggestMover(
  prospect: Filing[],
  defend: Filing[],
  asOf: string,
): BiggestMover | null {
  if (!asOf) return null;
  const asOfMs = Date.parse(`${asOf}T00:00:00Z`);
  const lo = new Date(asOfMs - 30 * DAY_MS).toISOString().slice(0, 10);
  const hi = new Date(asOfMs + 30 * DAY_MS).toISOString().slice(0, 10);

  const candidates: BiggestMover[] = [];
  const collect = (rows: Filing[], mode: OverviewClassification) => {
    for (const f of rows) {
      if (!f.effective_date || f.effective_date < lo || f.effective_date > hi) continue;
      candidates.push({ filing: f, mode, future: f.effective_date > asOf });
    }
  };
  collect(prospect, "prospect");
  collect(defend, "defend");
  if (candidates.length === 0) return null;

  // Max |change|; ties → most recent effective date, then alphabetical brand.
  candidates.sort((a, b) =>
    Math.abs(b.filing.overall_rate_impact) - Math.abs(a.filing.overall_rate_impact)
    || b.filing.effective_date!.localeCompare(a.filing.effective_date!)
    || a.filing.brand.localeCompare(b.filing.brand));
  return candidates[0];
}

// Spec line 654: red pill for defend rows or near-future prospect (≤2w out),
// gray otherwise.
export function feedRowPillColor(r: FeedRow): "red" | "gray" {
  if (r.classification === "defend") return "red";
  if (r.future && r.ageWeeks <= 2) return "red";
  return "gray";
}
