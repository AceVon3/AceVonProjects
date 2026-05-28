// Overview-page composition helpers.
//
// Both `computeMostUrgent` and `computeRecentChanges` work strictly over
// the result sets of the Prospect and Defend query builders — i.e. the
// exact same rows the table pages render. Card counts on the Overview are
// just the .length of those arrays, so by construction they reconcile with
// what /prospect and /defend show (spec §"Data note").

import type { Filing } from "./filings";

export type OverviewClassification = "prospect" | "defend";

// One day in ms, used so the math reads.
const DAY_MS = 86_400_000;

export type MostUrgent = {
  filing: Filing;
  classification: OverviewClassification;
  pillText: string;
  tier: 1 | 2;
};

// Tier model (collapsed from the spec's original 3 fallback tiers):
//   1. soonest upcoming filing with a future effective_date
//   2. largest |impact| across the whole 12-month window
//
// Why the collapse: Tier 1 is the real urgency signal — "act before this
// hits." When nothing is in the future, recency stops being a useful
// proxy for urgency; magnitude does. The spec's original Tier 2 (largest
// |impact| within last 8 weeks) and Tier 3 (largest |impact| in window)
// were trying to favor recent moves, but in datasets where the only
// recent move is small (e.g. a single −5% defend filing) it would
// surface that as Most Urgent over a much larger move 9 weeks back —
// which is the opposite of useful. The pill text still reflects recency,
// so the agent can tell at a glance whether the headline move is fresh
// or older. Returns null only when both arrays are empty.
export function computeMostUrgent(
  prospect: Filing[],
  defend: Filing[],
  asOf: string,
): MostUrgent | null {
  type WithClass = Filing & { _cls: OverviewClassification };
  const all: WithClass[] = [
    ...prospect.map(f => ({ ...f, _cls: "prospect" as const })),
    ...defend.map(f => ({ ...f, _cls: "defend" as const })),
  ];
  if (all.length === 0) return null;

  const asOfMs = Date.parse(`${asOf}T00:00:00Z`);

  // Tier 1 — future, soonest first; ties broken by larger |impact|.
  const future = all.filter(f => {
    if (!f.effective_date) return false;
    return Date.parse(`${f.effective_date}T00:00:00Z`) > asOfMs;
  });
  if (future.length > 0) {
    future.sort((a, b) => {
      const da = Date.parse(`${a.effective_date!}T00:00:00Z`);
      const db = Date.parse(`${b.effective_date!}T00:00:00Z`);
      if (da !== db) return da - db;
      return Math.abs(b.overall_rate_impact) - Math.abs(a.overall_rate_impact);
    });
    const f = future[0];
    const days = Math.round((Date.parse(`${f.effective_date!}T00:00:00Z`) - asOfMs) / DAY_MS);
    const weeks = Math.round(days / 7);
    const pillText =
      days <= 6 ? "Effective this week" : `${weeks} week${weeks === 1 ? "" : "s"} left`;
    return { filing: f, classification: f._cls, pillText, tier: 1 };
  }

  // Tier 2 — largest |impact| anywhere in the 12-month window. Ties
  // broken by recency (newer first) so the displayed pill is the
  // freshest among equal-magnitude moves.
  const sorted = [...all].sort((a, b) => {
    const diff = Math.abs(b.overall_rate_impact) - Math.abs(a.overall_rate_impact);
    if (diff !== 0) return diff;
    const da = a.effective_date ? Date.parse(`${a.effective_date}T00:00:00Z`) : -Infinity;
    const db = b.effective_date ? Date.parse(`${b.effective_date}T00:00:00Z`) : -Infinity;
    return db - da;
  });
  const f = sorted[0];
  let pillText = "Pending review";
  if (f.effective_date) {
    const days = Math.round((asOfMs - Date.parse(`${f.effective_date}T00:00:00Z`)) / DAY_MS);
    const weeks = Math.abs(Math.round(days / 7));
    pillText = `In effect ${weeks}w`;
  }
  return { filing: f, classification: f._cls, pillText, tier: 2 };
}

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
