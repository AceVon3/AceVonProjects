// Single source of truth for thresholds, brands, and covered states.
// Never hardcode these in queries — import from here.

export const BRANDS = [
  "Allstate",
  "Encompass",
  "GEICO",
  "Liberty Mutual",
  "Progressive",
  "Safeco",
  "State Farm",
  "Travelers",
] as const;

export type Brand = (typeof BRANDS)[number];

export const PROSPECT_THRESHOLD = 5;   // overall_rate_impact >= +5%
export const DEFEND_THRESHOLD = -2;    // overall_rate_impact <= -2%

export const ACTIVE_RATE_ACTIVITIES = [
  "rate_change",
  "rate_change_pending",
] as const;

// 8 states with filing data ("data_coverage: true"). All 50 are shown in
// setup; only these 8 are selectable. Expanding coverage = add to this list.
export const COVERED_STATES = [
  "AZ", "CO", "ID", "MT", "NV", "OR", "UT", "WA",
] as const;

export type CoveredState = (typeof COVERED_STATES)[number];

// Window dropdown options → SQLite date('now', ...) modifier.
export const WINDOW_MODIFIERS = {
  "30d": "-30 days",
  "90d": "-90 days",
  "12m": "-12 months",
} as const;

export type WindowKey = keyof typeof WINDOW_MODIFIERS;
export const DEFAULT_WINDOW: WindowKey = "12m";
