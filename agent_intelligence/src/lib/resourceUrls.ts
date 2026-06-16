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
  | "remote"
  // --- Office-briefing topics (Feature 9) ---
  // New grounded topics for the Compliance "office briefing". WA-mapped &
  // verified; other states stay coming-soon until mapped. (Minimum wage,
  // overtime, and WA PFML reuse the existing wage_hour / leave summaries —
  // no new key for those.)
  | "salary_threshold"
  | "wa_cares"
  | "at_will"
  | "business_tax";

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

    // --- Office-briefing topics (Feature 9), WA verified 2026-06-XX ---
    // Salary/exempt threshold — L&I "Changes to overtime rules": the EAP
    // exempt salary threshold, tiered by employer size (small ≤50 / large
    // 51+). The page prints the current figure, but the briefing describes
    // the tiered structure and defers the figure to source (a stale number
    // could drive a misclassification — see generate_compliance guidance).
    salary_threshold: [
      "https://www.lni.wa.gov/workers-rights/wages/overtime/changes-to-overtime-rules",
    ],
    // WA Cares — the state long-term-care program (DSHS/HCA/ESD). Homepage
    // for the program overview; the Employers page carries employer duties
    // and the "applies to W-2 employees, no size gate" framing.
    wa_cares: [
      "https://wacaresfund.wa.gov/",
      "https://wacaresfund.wa.gov/employers/",
    ],
    // At-will termination — L&I "Termination & Retaliation". States and
    // defines WA at-will AND centers on the exceptions (discrimination,
    // retaliation, protected leave). The summary MUST carry the exceptions,
    // never just the at-will headline (see generate_compliance guidance).
    at_will: [
      "https://www.lni.wa.gov/workers-rights/workplace-policies/termination-retaliation",
    ],
    // Business tax basics — DOR Business & Occupation (B&O) gross-receipts
    // tax. The classifications page carries the per-classification rates,
    // including "Insurance Agents/Insurance Brokers Commissions" (.00484 =
    // 0.484%) — the rate that applies to an agency's commission income.
    // Business-licensing page kept for context.
    business_tax: [
      "https://dor.wa.gov/taxes-rates/business-occupation-tax",
      "https://dor.wa.gov/taxes-rates/business-occupation-tax/business-occupation-tax-classifications",
      "https://dor.wa.gov/open-business",
    ],
  },

  // ============================================================
  // IDAHO — federal-default state (multi-state expansion, pair 1).
  // Maps ONLY the office-briefing topics that apply. ID follows federal on
  // minimum wage, overtime, and the exempt-salary threshold; has NO state
  // leave program; is at-will; taxes business INCOME (not gross receipts).
  // Federal figures (exempt salary, FMLA) are sourced from federal .gov pages
  // because the state defers to federal — see generate_compliance guidance.
  // ============================================================
  ID: {
    // Wage & Hour — Idaho DOL labor-laws FAQ: states Idaho's minimum wage
    // ($7.25, tracking federal) and that overtime follows the federal FLSA
    // (1.5x over 40). Same page also establishes at-will (below).
    wage_hour: [
      "https://www.labor.idaho.gov/businesses/labor-laws/labor-laws-faq/",
    ],
    // Salary/exempt threshold — Idaho has NO state threshold; the white-collar
    // exemption follows the FEDERAL FLSA salary level. Federal sources: US DOL
    // overtime hub + the eCFR regulation (29 CFR 541.600) that states the
    // weekly figure. (Fetchability of federal pages is a known risk.)
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // Leave — Idaho has NO state paid family/medical or paid sick leave program;
    // federal FMLA may apply to larger employers. Idaho DOL FAQ (no state leave
    // program shown) + US DOL FMLA (federal coverage figures).
    leave: [
      "https://www.labor.idaho.gov/businesses/labor-laws/labor-laws-faq/",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    // At-will — the Idaho DOL FAQ explicitly states Idaho is "work at will" AND
    // its exceptions (no discriminatory/retaliatory termination or public-policy
    // violation). Authoritative enough to ground (meets the WA at-will bar).
    at_will: [
      "https://www.labor.idaho.gov/businesses/labor-laws/labor-laws-faq/",
    ],
    // Business tax — Idaho taxes business INCOME (net profit), not gross
    // receipts. State Tax Commission business-income guide + pass-through
    // entities. Framed as income-on-net-profit / pass-through (not a B&O-style
    // "your rate") — see generate_compliance federal-default guidance.
    business_tax: [
      "https://tax.idaho.gov/taxes/income-tax/business-income/online-guide/",
      "https://tax.idaho.gov/taxes/income-tax/business-income/guides-for-certain-businesses/pass-through-entities/",
    ],
  },

  // ============================================================
  // UTAH — federal-default state (multi-state expansion, pair 1).
  // Same profile as Idaho. NOTE: at_will is intentionally UNMAPPED — Utah's
  // at-will doctrine is common-law with no clean official .gov statement, so
  // (per the WA bar) that section defers to coming-soon rather than grounding
  // weakly.
  // ============================================================
  UT: {
    // Wage & Hour — TWO sources, by necessity:
    //  1. Utah Labor Commission (UALD) Wage Claim page — supplies the minimum
    //     wage ($7.25), training wage, and tipped figures in static HTML. (The
    //     page ALSO states "The State of Utah has no overtime law," but that
    //     text is in a JS-rendered FAQ accordion the generator's raw fetch does
    //     NOT receive — so it cannot ground the overtime half from this page.)
    //  2. US DOL Fact Sheet #23 (FLSA overtime) — supplies the overtime rule
    //     (1.5x over 40) in static HTML. Utah is a federal-default state with no
    //     state overtime law, so federal FLSA governs overtime; dol.gov is
    //     generator-fetchable (the FMLA figures in `leave` came from dol.gov).
    wage_hour: [
      "https://laborcommission.utah.gov/divisions/utah-antidiscrimination-and-labor-uald/wage-claim/",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    // Salary/exempt threshold — federal (Utah has no state threshold). Same
    // federal sources as Idaho.
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // Leave — Utah requires no state paid sick / family-medical leave program;
    // federal FMLA may apply. UALD division page + US DOL FMLA.
    leave: [
      "https://laborcommission.utah.gov/divisions/utah-antidiscrimination-and-labor-uald/",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    // At-will — intentionally omitted (no authoritative Utah .gov source;
    // defers to coming-soon, per the WA bar).

    // Business tax — Utah taxes business INCOME (net profit), not gross
    // receipts. State Tax Commission C-corp page + the flat income-tax rate
    // page. Framed as income-on-net-profit / pass-through (not a B&O-style
    // "your rate") — see generate_compliance federal-default guidance.
    business_tax: [
      "https://tax.utah.gov/business/corporate-income-tax/c-corp-tax/",
      "https://incometax.utah.gov/paying/tax-rates",
    ],
  },

  // ============================================================
  // STUBS — to be populated & verified state-by-state.
  // Empty objects render every topic as "Source coming soon".
  // ============================================================
  AZ: {},
  CO: {},
  MT: {},
  NV: {},
  OR: {},
};
