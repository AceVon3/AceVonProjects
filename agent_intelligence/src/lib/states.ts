// All 50 US states. `data_coverage: true` is the ONLY flag that makes a
// state selectable in the Licensed-states grid; expanding coverage = flip
// the flag (no other code changes). `validated` reflects AM Best cross-check
// and is only meaningful where data_coverage is true.

export type StateRecord = {
  readonly code: string;
  readonly name: string;
  readonly data_coverage: boolean;
  readonly validated?: { readonly auto: boolean; readonly home: boolean };
};

export const STATES: readonly StateRecord[] = [
  { code: "AL", name: "Alabama",        data_coverage: false },
  { code: "AK", name: "Alaska",         data_coverage: false },
  { code: "AZ", name: "Arizona",        data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "AR", name: "Arkansas",       data_coverage: false },
  { code: "CA", name: "California",     data_coverage: false },
  { code: "CO", name: "Colorado",       data_coverage: true,  validated: { auto: false, home: false } },
  { code: "CT", name: "Connecticut",    data_coverage: false },
  { code: "DE", name: "Delaware",       data_coverage: false },
  { code: "FL", name: "Florida",        data_coverage: false },
  { code: "GA", name: "Georgia",        data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "HI", name: "Hawaii",         data_coverage: false },
  { code: "ID", name: "Idaho",          data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "IL", name: "Illinois",       data_coverage: false },
  { code: "IN", name: "Indiana",        data_coverage: false },
  { code: "IA", name: "Iowa",           data_coverage: false },
  { code: "KS", name: "Kansas",         data_coverage: false },
  { code: "KY", name: "Kentucky",       data_coverage: false },
  { code: "LA", name: "Louisiana",      data_coverage: false },
  { code: "ME", name: "Maine",          data_coverage: false },
  { code: "MD", name: "Maryland",       data_coverage: false },
  { code: "MA", name: "Massachusetts",  data_coverage: false },
  { code: "MI", name: "Michigan",       data_coverage: false },
  { code: "MN", name: "Minnesota",      data_coverage: false },
  { code: "MS", name: "Mississippi",    data_coverage: false },
  { code: "MO", name: "Missouri",       data_coverage: false },
  { code: "MT", name: "Montana",        data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "NE", name: "Nebraska",       data_coverage: false },
  { code: "NV", name: "Nevada",         data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "NH", name: "New Hampshire",  data_coverage: false },
  { code: "NJ", name: "New Jersey",     data_coverage: false },
  { code: "NM", name: "New Mexico",     data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "NY", name: "New York",       data_coverage: false },
  { code: "NC", name: "North Carolina", data_coverage: false },
  { code: "ND", name: "North Dakota",   data_coverage: false },
  { code: "OH", name: "Ohio",           data_coverage: false },
  { code: "OK", name: "Oklahoma",       data_coverage: false },
  { code: "OR", name: "Oregon",         data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "PA", name: "Pennsylvania",   data_coverage: false },
  { code: "RI", name: "Rhode Island",   data_coverage: false },
  { code: "SC", name: "South Carolina", data_coverage: false },
  { code: "SD", name: "South Dakota",   data_coverage: false },
  { code: "TN", name: "Tennessee",      data_coverage: false },
  { code: "TX", name: "Texas",          data_coverage: false },
  { code: "UT", name: "Utah",           data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "VT", name: "Vermont",        data_coverage: false },
  { code: "VA", name: "Virginia",       data_coverage: false },
  { code: "WA", name: "Washington",     data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "WV", name: "West Virginia",  data_coverage: false },
  { code: "WI", name: "Wisconsin",      data_coverage: false },
  { code: "WY", name: "Wyoming",        data_coverage: false }, // listed but no filings yet
];

export const COVERED_STATE_RECORDS: readonly StateRecord[] = STATES.filter(s => s.data_coverage);
export const COVERED_STATE_CODE_SET: ReadonlySet<string> = new Set(
  COVERED_STATE_RECORDS.map(s => s.code),
);

export function isCoveredState(code: string): boolean {
  return COVERED_STATE_CODE_SET.has(code);
}
