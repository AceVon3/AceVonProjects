// All 50 US states. `data_coverage: true` is the ONLY flag that makes a
// state selectable in the Licensed-states grid; expanding coverage = flip
// the flag (no other code changes). `validated` reflects AM Best cross-check
// and is only meaningful where data_coverage is true.

export type StateRecord = {
  readonly code: string;
  readonly name: string;
  readonly data_coverage: boolean;
  readonly validated?: { readonly auto: boolean; readonly home: boolean };
  // Provenance of a covered state's data. Absent/"scraped" = SERFF scrape;
  // "ambest" = interim AM Best industry data (not yet directly scraped).
  readonly source?: "scraped" | "ambest";
};

export const STATES: readonly StateRecord[] = [
  { code: "AL", name: "Alabama",        data_coverage: false },
  { code: "AK", name: "Alaska",         data_coverage: true,  source: "ambest" },
  { code: "AZ", name: "Arizona",        data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "AR", name: "Arkansas",       data_coverage: true,  source: "ambest" },
  { code: "CA", name: "California",     data_coverage: true,  source: "ambest" }, // PERMANENT (non-SERFF) — see AMBEST_PERMANENT_STATES
  { code: "CO", name: "Colorado",       data_coverage: true,  validated: { auto: false, home: false } },
  { code: "CT", name: "Connecticut",    data_coverage: true,  source: "ambest" },
  { code: "DE", name: "Delaware",       data_coverage: true,  source: "ambest" },
  { code: "FL", name: "Florida",        data_coverage: false },
  { code: "GA", name: "Georgia",        data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "HI", name: "Hawaii",         data_coverage: true,  source: "ambest" },
  { code: "ID", name: "Idaho",          data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "IL", name: "Illinois",       data_coverage: true,  source: "ambest" },
  { code: "IN", name: "Indiana",        data_coverage: true,  source: "ambest" },
  { code: "IA", name: "Iowa",           data_coverage: true,  source: "ambest" },
  { code: "KS", name: "Kansas",         data_coverage: true,  source: "ambest" },
  { code: "KY", name: "Kentucky",       data_coverage: true,  source: "ambest" },
  { code: "LA", name: "Louisiana",      data_coverage: false },
  { code: "ME", name: "Maine",          data_coverage: true,  source: "ambest" },
  { code: "MD", name: "Maryland",       data_coverage: true,  source: "ambest" },
  { code: "MA", name: "Massachusetts",  data_coverage: true,  source: "ambest" },
  { code: "MI", name: "Michigan",       data_coverage: true,  source: "ambest" },
  { code: "MN", name: "Minnesota",      data_coverage: true,  source: "ambest" },
  { code: "MS", name: "Mississippi",    data_coverage: true,  source: "ambest" },
  { code: "MO", name: "Missouri",       data_coverage: true,  source: "ambest" },
  { code: "MT", name: "Montana",        data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "NE", name: "Nebraska",       data_coverage: true,  source: "ambest" },
  { code: "NV", name: "Nevada",         data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "NH", name: "New Hampshire",  data_coverage: true,  source: "ambest" },
  { code: "NJ", name: "New Jersey",     data_coverage: true,  source: "ambest" },
  { code: "NM", name: "New Mexico",     data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "NY", name: "New York",       data_coverage: true,  source: "ambest" }, // PERMANENT (DFS, non-SERFF) — see AMBEST_PERMANENT_STATES
  { code: "NC", name: "North Carolina", data_coverage: false }, // EXCLUDED: structural NCRB Rate-Bureau gap (no per-carrier AM Best data); not fixable via this source
  { code: "ND", name: "North Dakota",   data_coverage: true,  source: "ambest" },
  { code: "OH", name: "Ohio",           data_coverage: true,  validated: { auto: false, home: false } }, // scraped 2026-06-24 (interim->real): 246-row SERFF scrape, 397/397 filings. Directly-scraped real data; AM Best cross-check not yet run (CO-like) -> validation pending, not yet a cross-checked state.
  { code: "OK", name: "Oklahoma",       data_coverage: true,  source: "ambest" },
  { code: "OR", name: "Oregon",         data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "PA", name: "Pennsylvania",   data_coverage: true,  source: "ambest" },
  { code: "RI", name: "Rhode Island",   data_coverage: true,  source: "ambest" },
  { code: "SC", name: "South Carolina", data_coverage: true,  source: "ambest" },
  { code: "SD", name: "South Dakota",   data_coverage: true,  source: "ambest" },
  { code: "TN", name: "Tennessee",      data_coverage: true,  source: "ambest" },
  { code: "TX", name: "Texas",          data_coverage: true,  source: "ambest" }, // PERMANENT (TDI, non-SERFF) — see AMBEST_PERMANENT_STATES
  { code: "UT", name: "Utah",           data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "VT", name: "Vermont",        data_coverage: true,  source: "ambest" },
  { code: "VA", name: "Virginia",       data_coverage: true,  validated: { auto: true,  home: true  } }, // scraped 2026-06-22 (interim->real); AM Best cross-check: PPA 92.3%, HO values agree where they overlap (the 68.6% is AM Best-only coverage/recency, and the lone "disagreement" was AM Best's transposition the scrape got right) -> both validated
  { code: "WA", name: "Washington",     data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "WV", name: "West Virginia",  data_coverage: true,  source: "ambest" },
  { code: "WI", name: "Wisconsin",      data_coverage: true,  source: "ambest" },
  { code: "WY", name: "Wyoming",        data_coverage: false }, // listed but no filings yet
];

export const COVERED_STATE_RECORDS: readonly StateRecord[] = STATES.filter(s => s.data_coverage);
export const COVERED_STATE_CODE_SET: ReadonlySet<string> = new Set(
  COVERED_STATE_RECORDS.map(s => s.code),
);

export function isCoveredState(code: string): boolean {
  return COVERED_STATE_CODE_SET.has(code);
}
