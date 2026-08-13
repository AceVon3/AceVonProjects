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
  // Scraped states (source='serff_scraped'). VA joined 2026-06-22 (interim AM
  // Best → real scrape; 277-row deliverable, AM Best-validated).
  "AZ", "CO", "GA", "ID", "MT", "NM", "NV", "OR", "UT", "VA", "WA",
  // Interim AM Best industry-data states (2026-06-16). Selectable + queryable
  // like scraped states; rows are source='ambest_sourced' (states.ts
  // source:"ambest"). Replaced in place when directly scraped.
  "IL", "OH",
  // 10-state AM Best batch (2026-06-17). CA is PERMANENT (non-SERFF); the rest
  // are interim. See AMBEST_PERMANENT_STATES below.
  "AK", "AR", "CA", "CT", "DE", "HI", "IA", "IN", "KS", "KY",
  // 22-state AM Best batch (2026-06-17): 20 interim + NY/TX permanent (non-SERFF).
  // NC excluded (structural NCRB Rate-Bureau gap — not fixable via AM Best).
  "ME", "MD", "MA", "MI", "MN", "MS", "MO", "NE", "NH", "NJ",
  "NY", "ND", "OK", "PA", "RI", "SC", "SD", "TN", "TX", "VT", "WV", "WI",
  // NC (2026-08-10, 48th covered state): the "structural NCRB gap" verdict was
  // half-right — the BUREAU owns base rates, but carriers file their
  // departures as SERFF filing type "Deviations", which carry real
  // per-carrier %/policyholder rows. 49-row deliverable from already-cached
  // filings (zero new collection). See states.ts NC entry.
  "NC",
  // AL + LA (2026-07-27 gap-batch, 43rd/44th scraped): imported and flagged
  // data_coverage:true in states.ts at the time, but never added here — the
  // homepage undercounted until this sync (2026-08-13). Coverage is now every
  // state except FL (OIR I-File, zero SERFF filings) and WY (no rows).
  "AL", "LA",
] as const;

export type CoveredState = (typeof COVERED_STATES)[number];

// The subset of COVERED_STATES whose data is AM Best industry data (not a SERFF
// scrape). Lets coverage-aware UI mark these honestly without re-deriving from
// states.ts. Must stay in sync with AMBEST_STATES in scripts/import_filings.py.
export const AMBEST_STATES = [  // VA..WI (06-22..07-13), PA/MI (07-15), IN (07-16), MO (07-21), MN+TN (07-22) removed — all now scraped (42). TX + NY (07-30) removed — scraped, 45th/46th (permanent-doctrine unwind). CA (08-03) removed — scraped, 47th state: CDI's own viewing-room page says P&C filings are public on SERFF Filing Access (mandatory e-filing since 2015); probed + fully collected same day (726 universe, 252/252 targets). "Permanent" was never real for any state. EMPTY from here — every covered state is a direct SERFF scrape.
] as const;

// PERMANENT is now an EMPTY class (2026-08-03, CA import — the full
// doctrine unwind). Every "permanent non-SERFF" tag (NY, TX, then CA) was
// regulatory-structure inference that a probe overturned. Kept as a typed
// empty list so the UI/e2e code that references it stays honest: nothing
// may ever be added here again without a probe FIRST. FL (probed: ZERO
// filings, true OIR I-File) and NC (NCRB bureau) are coverage GAPS, not
// AM Best states — they were never loaded from AM Best.
export const AMBEST_PERMANENT_STATES = [] as const;

// Window dropdown options → SQLite date('now', ...) modifier.
export const WINDOW_MODIFIERS = {
  "30d": "-30 days",
  "90d": "-90 days",
  "12m": "-12 months",
} as const;

export type WindowKey = keyof typeof WINDOW_MODIFIERS;
export const DEFAULT_WINDOW: WindowKey = "12m";
