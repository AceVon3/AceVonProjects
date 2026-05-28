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

// Filter + sort already-fetched filings. Window narrowing happens server-
// side via the query builder (different SQL window → different rows). The
// other filters operate on the in-memory result set so they apply with no
// network round-trip.
export function applyFilters(
  filings: Filing[],
  filters: FilterState,
): Filing[] {
  const stateSet = new Set(filters.states);
  const lineSet = new Set<string>(filters.lines);
  const carrierSet = filters.carriers ? new Set(filters.carriers) : null;

  const result = filings.filter(f => {
    if (!stateSet.has(f.state)) return false;
    if (!lineSet.has(f.line_of_business)) return false;
    if (carrierSet && !carrierSet.has(f.brand)) return false;
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
