// resourceUrls.ts
//
// Per-state, per-topic official source URLs for the Compliance feature (Feature 6).
//
// Each (state, topic) maps to an ARRAY of official .gov source URLs (one or more).
// The /api/compliance/summary route fetches ALL listed pages for a topic and asks
// the LLM to summarize STRICTLY from their combined content — never the model's own
// knowledge. Every URL used is shown to the user as a source link.
//
// STATUS: Washington (WA) is fully populated and each URL below was verified as an
// official state source (lni.wa.gov, esd.wa.gov, dor.wa.gov, insurance.wa.gov).
// The other 7 covered states (AZ, CO, ID, MT, NV, OR, UT) are stubbed and fall back
// to "Source coming soon" until their URLs are gathered and verified the same way.
//
// VERIFICATION DISCIPLINE (important for a compliance feature):
//  - Only official government domains (.gov, or a state's official domain).
//  - Never a law-firm blog, payroll-vendor page, or aggregator, even if it ranks higher.
//  - Prefer the agency's own topic/landing page over a deep PDF, so the summary stays
//    current as the agency updates the page.
//  - Re-verify URLs periodically; agencies reorganize their sites.

export type ResourceKey =
  | "wage_hour"
  | "leave"
  | "payroll"
  | "workers_comp"
  | "termination"
  | "nexus"
  | "hiring"
  | "remote";

export type StateCode =
  | "AZ" | "CO" | "ID" | "MT" | "NV" | "OR" | "UT" | "WA";

export const RESOURCE_URLS: Record<
  StateCode,
  Partial<Record<ResourceKey, string[]>>
> = {
  // ============================================================
  // WASHINGTON — fully populated & verified (template state)
  // ============================================================
  WA: {
    // Wage & Hour — L&I Employment Standards: wages, minimum wage, overtime.
    wage_hour: [
      "https://www.lni.wa.gov/workers-rights/wages/minimum-wage/",
      "https://www.lni.wa.gov/workers-rights/wages/overtime/",
    ],
    // Leave Laws — L&I paid sick leave (employer-provided) + state PFML (ESD-run).
    leave: [
      "https://www.lni.wa.gov/workers-rights/leave/paid-sick-leave/",
      "https://paidleave.wa.gov/",
    ],
    // Payroll — ESD employer tax guide (UI / Paid Leave / WA Cares filing) + DOR
    // business licensing (employers must license with DOR before filing).
    payroll: [
      "https://esd.wa.gov/employer-requirements/unemployment-taxes/employers-guide-paying-taxes",
      "https://dor.wa.gov/open-business",
    ],
    // Workers' Comp — WA is a monopolistic state fund administered by L&I.
    workers_comp: [
      "https://www.lni.wa.gov/insurance/",
    ],
    // Termination — final pay (L&I wages) + ESD WARN / mass-layoff notice rules.
    termination: [
      "https://www.lni.wa.gov/workers-rights/wages/getting-paid/",
      "https://esd.wa.gov/employer-requirements/layoffs-and-employee-notifications/warn-requirements",
    ],
    // Nexus & Licensing — for insurance agents this is producer licensing via the
    // Office of the Insurance Commissioner, plus DOR business registration (tax nexus).
    nexus: [
      "https://www.insurance.wa.gov/producers-adjusters/licensing",
      "https://dor.wa.gov/open-business",
    ],
    // Hiring Basics — L&I employment-standards hub for employer obligations when hiring.
    // (New-hire reporting is handled via DSHS/ESD; L&I covers core wage/standards rules.)
    hiring: [
      "https://www.lni.wa.gov/workers-rights/",
    ],
    // Remote Work — no single WA "remote work" statute; the relevant rules live in
    // L&I employment standards (which apply by where the employee performs work).
    // Mapped to the standards hub; expect this to be the topic most likely to need
    // a better page or to hit the fetch fallback.
    remote: [
      "https://www.lni.wa.gov/workers-rights/",
    ],
  },

  // ============================================================
  // STUBS — to be populated & verified state-by-state.
  // Empty objects render every topic as "Source coming soon".
  // ============================================================
  AZ: {},
  CO: {},
  ID: {},
  MT: {},
  NV: {},
  OR: {},
  UT: {},
};
