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

// Spec line 654: red pill for defend rows or near-future prospect (≤2w out),
// gray otherwise.
export function feedRowPillColor(r: FeedRow): "red" | "gray" {
  if (r.classification === "defend") return "red";
  if (r.future && r.ageWeeks <= 2) return "red";
  return "gray";
}
