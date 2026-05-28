// Filter state and helpers shared by the three table pages.
//
// Filter state is per-page React state — NOT persisted. Refreshing or
// navigating away resets every filter to its default (spec §Filter state
// management). The default view always shows the agent's full 12-month
// picture so a return visit can't accidentally render an over-narrowed
// empty table the agent forgot they filtered.

import type { Filing } from "./filings";
import type { AgentProfile } from "./profile";

export type WindowChoice = "30d" | "90d" | "12m";

export type SortChoice = "effective_desc" | "impact_desc";

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
  effective_desc: "Effective date (newest)",
  impact_desc: "Rate impact (largest)",
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

  if (filters.sort === "impact_desc") {
    result.sort(
      (a, b) =>
        Math.abs(b.overall_rate_impact) - Math.abs(a.overall_rate_impact),
    );
  } else {
    // effective_desc — newest first, nulls sink to the bottom.
    result.sort((a, b) => {
      const ea = a.effective_date
        ? Date.parse(`${a.effective_date}T00:00:00Z`)
        : -Infinity;
      const eb = b.effective_date
        ? Date.parse(`${b.effective_date}T00:00:00Z`)
        : -Infinity;
      return eb - ea;
    });
  }

  return result;
}
