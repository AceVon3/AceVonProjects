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
  { code: "AK", name: "Alaska",         data_coverage: true,  validated: { auto: true,  home: true  } }, // scraped 2026-07-05 (interim->real): 100-row SERFF scrape, 189/189 in-target. Coverage-thin AM Best (53 in-target): value-agreement on SHARED filings 41/41 (100%), interim 41/41 (0 disagreements), PPA in-window 34/34 (100%) / HO 13/13 (100%). Scrape RICHER (59 scrape-only) — genuine Country enrichment (12 rate rows vs AM Best's 2) + 0% filings, sub-types, back-extension. (Farmers/Liberty file only Form/Rule in AK, no rates → AM Best correctly 0, NOT a gap.) 0 material soft-miss (6 AM-Best-only all recency/immaterial). Recovered 2 material COUNTRY CFPC (wrapped-name bug) incl. CFPC-134283900 +9.6%/9,644ph Prospect signal -> both validated.
  { code: "AZ", name: "Arizona",        data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "AR", name: "Arkansas",       data_coverage: true,  source: "ambest" },
  { code: "CA", name: "California",     data_coverage: true,  source: "ambest" }, // PERMANENT (non-SERFF) — see AMBEST_PERMANENT_STATES
  { code: "CO", name: "Colorado",       data_coverage: true,  validated: { auto: false, home: false } },
  { code: "CT", name: "Connecticut",    data_coverage: true,  source: "ambest" },
  { code: "DE", name: "Delaware",       data_coverage: true,  source: "ambest" },
  { code: "FL", name: "Florida",        data_coverage: false },
  { code: "GA", name: "Georgia",        data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "HI", name: "Hawaii",         data_coverage: true,  validated: { auto: true,  home: true  } }, // scraped 2026-07-01 (interim->real): 71-row SERFF scrape, 138/138 in-target. AM Best cross-check CLEANEST YET: PPA 44/44 (100%) / HO 7/7 (100%) corroboration, interim 41/41 (100%) impact agreement — 0 disagreements, 0 soft-misses, 0 recoveries, 0 parser flags. AmFam pre-resolved = 0 genuine. HO small-N (7) read in-context: robust PPA leg 44/44 -> both validated.
  { code: "ID", name: "Idaho",          data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "IL", name: "Illinois",       data_coverage: true,  validated: { auto: true,  home: true  } }, // scraped 2026-06-25 (interim->real): 303-row SERFF scrape, 600/602 filings. AM Best cross-check: PPA 93.8% / HO 95.2% corroboration, 155/156 interim-impact agreement. 1 immaterial coverage gap (Liberty HO, AM Best-covered) -> both validated.
  { code: "IN", name: "Indiana",        data_coverage: true,  source: "ambest" },
  { code: "IA", name: "Iowa",           data_coverage: true,  source: "ambest" },
  { code: "KS", name: "Kansas",         data_coverage: true,  source: "ambest" },
  { code: "KY", name: "Kentucky",       data_coverage: true,  source: "ambest" },
  { code: "LA", name: "Louisiana",      data_coverage: false },
  { code: "ME", name: "Maine",          data_coverage: true,  validated: { auto: true,  home: true  } }, // scraped 2026-07-08 (interim->real): 114-row SERFF scrape, 309/309 in-target cached, 0 true misses (12-state streak). AM Best cross-check (12th interim->real point, CLEANEST YET): value-agreement 48/48 (100% — first perfect) / interim 46/46 (0 disagreements); adjudicated in-window PPA 45/45 + HO 18/18 (headline 82.7/94.7 deflated only by 2026-eff recency + one LBPM pair AM Best carried at a pre-final stage — source PDF shows both entities 0.000%, ours source-true). THE ISOLATION-BOUNDARY TEST: ME (small/rural/somewhat-isolated) resolves ND/RI-COMPLETE — Nationwide 25-vs-6 and Travelers 23-vs-4 watch-points both adjudicated Form/Rule-richness (the 1 material Travelers Quantum +7.5%/16,008ph IS in AM Best); thinness stays AK-Country-specific -> both validated (HO N=19 mid-N read with the perfect PPA leg, the ND precedent)
  { code: "MD", name: "Maryland",       data_coverage: true,  source: "ambest" },
  { code: "MA", name: "Massachusetts",  data_coverage: true,  validated: { auto: true,  home: true  } }, // scraped 2026-07-06 (interim->real): 129-row SERFF scrape (LM P&C + Wausau family excluded per the LM-vehicle doctrine), 281/282 in-target (the 1 a Rule filing). AM Best cross-check: PPA 37/38 (97.4%, the 1 miss pure recency) / HO 27/27 (100% — FIRST robust-N home read), value-agreement on shared 53/53 (100%), interim 49/49 (0 disagreements, 9th interim->real point). Coverage verdict: richness-only (GEICO/Progressive/Farmers form/rule-heavy per-brand — the AK resolution) + 1 GEICO enrichment (GECC-134365103 +3.7% AM Best lacks). NICOA paginator-glitch save corroborated -> both validated
  { code: "MI", name: "Michigan",       data_coverage: true,  source: "ambest" },
  { code: "MN", name: "Minnesota",      data_coverage: true,  source: "ambest" },
  { code: "MS", name: "Mississippi",    data_coverage: true,  source: "ambest" },
  { code: "MO", name: "Missouri",       data_coverage: true,  source: "ambest" },
  { code: "MT", name: "Montana",        data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "NE", name: "Nebraska",       data_coverage: true,  source: "ambest" },
  { code: "NV", name: "Nevada",         data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "NH", name: "New Hampshire",  data_coverage: true,  validated: { auto: true,  home: true  } }, // scraped 2026-06-29 (interim->real): 113-row SERFF scrape, 214/214 in-target. AM Best cross-check (in-window): PPA 22/22 (100%) / HO 14/14 (100%) corroboration, interim 33/33 (100%) impact agreement — cleanest yet (0 disagreements). Recovered the Safeco General Insurance Co of America soft-miss (eff 01/19/25 +15.8%/3711ph) via the 2nd search-term fix -> both validated.
  { code: "NJ", name: "New Jersey",     data_coverage: true,  source: "ambest" },
  { code: "NM", name: "New Mexico",     data_coverage: true,  validated: { auto: true,  home: true  } },
  { code: "NY", name: "New York",       data_coverage: true,  source: "ambest" }, // PERMANENT (DFS, non-SERFF) — see AMBEST_PERMANENT_STATES
  { code: "NC", name: "North Carolina", data_coverage: false }, // EXCLUDED: structural NCRB Rate-Bureau gap (no per-carrier AM Best data); not fixable via this source
  { code: "ND", name: "North Dakota",   data_coverage: true,  validated: { auto: true,  home: true  } }, // scraped 2026-07-07 (interim->real): 114-row SERFF scrape (121->114 after the B9 bare-"farmers" fix dropped 7 independent-mutual rows), 290/290 in-target cached, 0 true misses (10-state streak). AM Best cross-check (10th interim->real point): value-agreement on shared 44/44 (100%), interim 45/45 (0 disagreements), in-window PPA 35/35 + HO 20/20 (100%). Coverage verdict: richness-only on all 4 divergence brands. B9 surfaced HERE: bare-"farmers" had mislabeled 13 independent mutuals (~86 interim rows / 12 states) as Farmers — fixed globally in the same import -> both validated
  { code: "OH", name: "Ohio",           data_coverage: true,  validated: { auto: true,  home: true  } }, // scraped 2026-06-24 (interim->real); AM Best cross-check 2026-06-25: PPA 96.1% / HO 97.1% corroboration, 105/105 interim-impact agreement (0 disagreements). 4 AM Best-only rows all 0% (coverage/recency, not value errors) -> both validated.
  { code: "OK", name: "Oklahoma",       data_coverage: true,  source: "ambest" },
  { code: "OR", name: "Oregon",         data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "PA", name: "Pennsylvania",   data_coverage: true,  source: "ambest" },
  { code: "RI", name: "Rhode Island",   data_coverage: true,  validated: { auto: true,  home: true  } }, // scraped 2026-07-07 (interim->real): 100-row SERFF scrape, 193/193 in-target cached, 0 true misses (11-state streak). AM Best cross-check (11th interim->real point): PPA 39/42 (92.9%; 3 AM-Best-only = 2 recency eff 04/20/26 + 1 adjudicated stale-stage) / HO 24/25 (96.0% — ROBUST N, coastal) -> adjudicated in-window 100%/100%; value-agreement 41/42 (the 1 differ = AM Best's OWN entity transposition on TRVD-G134527101, ours matches the source PDF); interim 40/41 (same transposition) -> effectively 0 disagreements. Coverage verdict: RICHNESS-ONLY x4 (incl. Encompass 8 SERFF = 6 form/rule + 2 new-product vs AM Best 0 — correct). TravCo Quantum Home captured via the search-term fix found at recon -> both validated
  { code: "SC", name: "South Carolina", data_coverage: true,  source: "ambest" },
  { code: "SD", name: "South Dakota",   data_coverage: true,  source: "ambest" },
  { code: "TN", name: "Tennessee",      data_coverage: true,  source: "ambest" },
  { code: "TX", name: "Texas",          data_coverage: true,  source: "ambest" }, // PERMANENT (TDI, non-SERFF) — see AMBEST_PERMANENT_STATES
  { code: "UT", name: "Utah",           data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "VT", name: "Vermont",        data_coverage: true,  validated: { auto: true,  home: true  } }, // scraped 2026-06-30 (interim->real): 103-row SERFF scrape, 154/154 in-target. AM Best cross-check: PPA 26/32 (material in-window 42/42 = 100%) / HO 16/17 (94.1%, the 1 non-corrob immaterial) corroboration, interim 37/37 (100%) impact agreement — cleanest yet (0 disagreements, 0 soft-misses, 0 recoveries). Gap-class closure payoff: General Insurance Co of America captured proactively -> both validated.
  { code: "VA", name: "Virginia",       data_coverage: true,  validated: { auto: true,  home: true  } }, // scraped 2026-06-22 (interim->real); AM Best cross-check: PPA 92.3%, HO values agree where they overlap (the 68.6% is AM Best-only coverage/recency, and the lone "disagreement" was AM Best's transposition the scrape got right) -> both validated
  { code: "WA", name: "Washington",     data_coverage: true,  validated: { auto: true,  home: false } },
  { code: "WV", name: "West Virginia",  data_coverage: true,  validated: { auto: true,  home: true  } }, // scraped 2026-06-26 (interim->real): 113-row SERFF scrape, 207/207 filings. AM Best cross-check: PPA 30/33 (90.9%) / HO 9/10 (90%, lone miss pure recency -> 9/9 in-window) corroboration, 37/40 interim-impact agreement (the 3 diffs all AM-Best-side per source PDFs). Recovered the material Liberty Insurance Corporation HO (eff 01/09/25 -5%/7894ph) via a search-term fix -> both validated.
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
