// Filter state and helpers shared by the three table pages.
//
// Filter state is per-page React state — NOT persisted. Refreshing or
// navigating away resets every filter to its default (spec §Filter state
// management). The default view always shows the agent's full 12-month
// picture so a return visit can't accidentally render an over-narrowed
// empty table the agent forgot they filtered.
//
// ARCHITECTURE — window narrowing is client-side. The table pages always
// fetch the broadest 12-month set once per profile load and let
// applyFilters() narrow in-memory for every filter, including window.
// Two consequences:
//   1. Every filter change (window, state, line, carrier, sort) is
//      instant — no refetch latency, no loading spinner between click
//      and result.
//   2. The raw `filings` array always carries the full 12-month set,
//      so "filtered to empty" is distinguishable from "no data".
// Both server-side date(asOf, ...) and client-side windowCutoff(asOf, ...)
// anchor to the SAME asOf (data/last_updated.txt, returned in the API
// response), so the two paths are deterministic and produce identical
// cutoffs.

import type { Filing } from "./filings";
import type { AgentProfile } from "./profile";

export type WindowChoice = "30d" | "90d" | "12m";

// Each sortable column (effective date, rate impact) supports both
// directions. The two "_desc" values are the original presets (newest /
// largest); the "_asc" values were added so a header click can toggle
// direction and the FilterBar dropdown can still reflect every state.
export type SortChoice =
  | "effective_desc"
  | "effective_asc"
  | "impact_desc"
  | "impact_asc";

export type LineChoice = "Personal Auto" | "Homeowners";

export type FilterState = {
  states: string[];                       // subset of licensed_states
  lines: LineChoice[];                    // subset of {Personal Auto, Homeowners}
  window: WindowChoice;
  sort: SortChoice;
  // carriers is only meaningful on /my-carriers (subset of
  // authorized_brands). undefined on /prospect and /defend.
  carriers?: string[];
};

export const ALL_LINES: readonly LineChoice[] = ["Personal Auto", "Homeowners"];

export const WINDOW_LABEL: Record<WindowChoice, string> = {
  "12m": "Last 12 months",
  "90d": "Last 90 days",
  "30d": "Last 30 days",
};

export const SORT_LABEL: Record<SortChoice, string> = {
  effective_desc: "Effective (newest)",
  effective_asc: "Effective (oldest)",
  impact_desc: "Rate impact (largest)",
  impact_asc: "Rate impact (smallest)",
};

// Default filter state for a freshly-mounted page. Spec defaults:
// state = all licensed; line = both; window = 12m; sort = newest;
// my-carriers carrier = all authorized.
export function defaultFilters(
  profile: AgentProfile,
  mode: "prospect" | "defend" | "my-carriers",
): FilterState {
  const base: FilterState = {
    states: [...profile.licensed_states],
    lines: [...ALL_LINES],
    window: "12m",
    sort: "effective_desc",
  };
  if (mode === "my-carriers") {
    base.carriers = [...profile.authorized_brands];
  }
  return base;
}

// Compute the windowed cutoff date for client-side filtering. Matches
// SQLite's date(asOf, '-N days' | '-12 months') semantics so the result
// equals what the SQL would return — 12m subtracts a calendar year,
// 30d/90d subtract literal days.
export function windowCutoff(asOf: string, window: WindowChoice): string {
  const [y, m, d] = asOf.split("-").map(Number);
  if (window === "12m") {
    return `${y - 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  const days = window === "30d" ? 30 : 90;
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

// Filter + sort already-fetched filings. The pages always fetch the
// broadest window (12m) and narrow client-side here — that makes window
// changes instant (no refetch) AND makes filteredToEmpty distinguishable
// from no-data (because the raw fetch always has the full set).
export function applyFilters(
  filings: Filing[],
  filters: FilterState,
  asOf: string,
): Filing[] {
  const stateSet = new Set(filters.states);
  const lineSet = new Set<string>(filters.lines);
  const carrierSet = filters.carriers ? new Set(filters.carriers) : null;
  const cutoff = windowCutoff(asOf, filters.window);

  const result = filings.filter(f => {
    if (!stateSet.has(f.state)) return false;
    if (!lineSet.has(f.line_of_business)) return false;
    if (carrierSet && !carrierSet.has(f.brand)) return false;
    // ISO YYYY-MM-DD strings compare lexicographically. Null dates
    // are excluded from windowed views (matches the SQL NULL >= ...
    // returning NULL → filtered out).
    if (!f.effective_date || f.effective_date < cutoff) return false;
    return true;
  });

  if (filters.sort === "impact_desc" || filters.sort === "impact_asc") {
    // Sort by absolute rate impact (magnitude of the move). _desc = largest
    // first, _asc = smallest first. (Within Prospect/Defend every row shares
    // a sign, so abs ordering equals signed magnitude.)
    const asc = filters.sort === "impact_asc";
    result.sort((a, b) => {
      const diff = Math.abs(b.overall_rate_impact) - Math.abs(a.overall_rate_impact);
      return asc ? -diff : diff;
    });
  } else {
    // effective_desc = newest first, effective_asc = oldest first. Null
    // dates always sink to the bottom regardless of direction. (In practice
    // the windowed filter above already drops null-effective rows, so this
    // only matters defensively.)
    const asc = filters.sort === "effective_asc";
    result.sort((a, b) => {
      const an = !a.effective_date;
      const bn = !b.effective_date;
      if (an && bn) return 0;
      if (an) return 1;
      if (bn) return -1;
      const ea = Date.parse(`${a.effective_date}T00:00:00Z`);
      const eb = Date.parse(`${b.effective_date}T00:00:00Z`);
      return asc ? ea - eb : eb - ea;
    });
  }

  return result;
}
