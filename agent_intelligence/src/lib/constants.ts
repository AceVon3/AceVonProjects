// Single source of truth for thresholds, brands, and covered states.
// Never hardcode these in queries — import from here.

// 13 customer-facing brands. The original 8 + 5 added with the GA expansion
// (Farmers, COUNTRY Financial, American Family, Nationwide, USAA). Adding a
// brand here propagates everywhere brands flow from this const: the setup
// picker, profile/API validation, and the positioning classifier. The 5 new
// brands currently have GA-only filing data (existing-state backfill pending) —
// the empty-state coverage note distinguishes "not covered here yet" from
// "no recent moves" per (brand, state).
export const BRANDS = [
  "Allstate",
  "American Family",
  "COUNTRY Financial",
  "Encompass",
  "Farmers",
  "GEICO",
  "Liberty Mutual",
  "Nationwide",
  "Progressive",
  "Safeco",
  "State Farm",
  "Travelers",
  "USAA",
] as const;

export type Brand = (typeof BRANDS)[number];

export const PROSPECT_THRESHOLD = 5;   // overall_rate_impact >= +5%
export const DEFEND_THRESHOLD = -2;    // overall_rate_impact <= -2%

export const ACTIVE_RATE_ACTIVITIES = [
  "rate_change",
  "rate_change_pending",
] as const;

// 10 states with filing data ("data_coverage: true"). All 50 are shown in
// setup; only these are selectable. Expanding coverage = add to this list
// (and flip data_coverage in states.ts). GA + NM added with the 2026-06
// expansion. Must stay in sync with the data_coverage:true rows in states.ts.
export const COVERED_STATES = [
  "AZ", "CO", "GA", "ID", "MT", "NM", "NV", "OR", "UT", "WA",
  // Interim AM Best industry-data states (2026-06-16). Selectable + queryable
  // like scraped states; rows are source='ambest_sourced' (badge + states.ts
  // source:"ambest"). Replaced in place when directly scraped.
  "IL", "OH", "VA",
] as const;

export type CoveredState = (typeof COVERED_STATES)[number];

// The subset of COVERED_STATES whose data is interim AM Best (not scraped).
// Lets coverage-aware UI mark these honestly without re-deriving from states.ts.
export const AMBEST_STATES = ["IL", "OH", "VA"] as const;

// Window dropdown options → SQLite date('now', ...) modifier.
export const WINDOW_MODIFIERS = {
  "30d": "-30 days",
  "90d": "-90 days",
  "12m": "-12 months",
} as const;

export type WindowKey = keyof typeof WINDOW_MODIFIERS;
export const DEFAULT_WINDOW: WindowKey = "12m";
