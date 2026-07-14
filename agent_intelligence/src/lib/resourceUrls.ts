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
  | "business_tax"
  // --- 50-state expansion (2026-07) ---
  // Signature state employer-mandate programs that aren't WA Cares: state
  // disability insurance (TDI/SDI/DBL), paid-leave premium programs, and
  // state retirement mandates (Secure Choice / MyCTSavings / RetirePath).
  // Only mapped for states that actually run such programs; states without
  // them simply omit the key (no coming-soon card is rendered for it).
  | "state_programs";

// All 50 states — compliance coverage is nationwide as of the 2026-07
// expansion, independent of the filing-data coverage flags in states.ts.
export type StateCode =
  | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA"
  | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME" | "MD"
  | "MA" | "MI" | "MN" | "MS" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ"
  | "NM" | "NY" | "NC" | "ND" | "OH" | "OK" | "OR" | "PA" | "RI" | "SC"
  | "SD" | "TN" | "TX" | "UT" | "VA" | "VT" | "WA" | "WV" | "WI" | "WY";

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

    // --- 50-state expansion (2026-07): the six previously unmapped topics ---
    // Payroll — Idaho DOL unemployment-tax help hub for employers.
    payroll: [
      "https://www.labor.idaho.gov/businesses/help-with-unemployment-tax/",
    ],
    // Workers' comp — Idaho Industrial Commission: 1+ employees must carry
    // coverage unless specifically exempt; FAQs cover exemptions/penalties.
    workers_comp: [
      "https://iic.idaho.gov/employer-compliance-division/employer-information/",
      "https://iic.idaho.gov/employer-compliance-division/employer-information/employers-faqs/",
    ],
    // Termination — final wages due the sooner of next payday or 10 days
    // (48 hours on written request); same FAQ page as wage_hour/at_will.
    termination: [
      "https://www.labor.idaho.gov/businesses/labor-laws/labor-laws-faq/",
    ],
    // Nexus — Idaho DOI producer licensing (2-year renewals, CE).
    nexus: [
      "https://doi.idaho.gov/industry/licensing-services/license-types/producer-individual/",
    ],
    // Hiring — report new hires to Idaho DOL within 20 days.
    hiring: [
      "https://www.labor.idaho.gov/businesses/report-new-hires/",
    ],
    // Remote — labor-laws hub (rules apply where the employee works).
    remote: [
      "https://www.labor.idaho.gov/businesses/labor-laws/",
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

    // --- 50-state expansion (2026-07): the six previously unmapped topics ---
    // Payroll — DWS employer portal hub (UI registration/tax; verified
    // substantive static content, not an empty auth shell).
    payroll: [
      "https://jobs.utah.gov/ui/employer/Public/PublicPortal.aspx",
    ],
    // Workers' comp — Labor Commission Industrial Accidents: nearly every
    // Utah employer must carry coverage (Utah Code 34A-2-201).
    workers_comp: [
      "https://laborcommission.utah.gov/divisions/industrial-accidents/employers/",
      "https://laborcommission.utah.gov/divisions/industrial-accidents/employers/employers-guide-to-workers-compensation/",
    ],
    // Termination — UALD wage-claim page: on employer-initiated separation,
    // all wages due within 24 hours.
    // Utah Code Ch. 34-28 via le.utah.gov's direct chapter PDF (the HTML site is an SPA, but /xcode PDFs extract cleanly): 34-28-5 incl. the 24-hour rule and 60-day penalty.
    termination: [
      "https://laborcommission.utah.gov/divisions/utah-antidiscrimination-and-labor-uald/wage-claim/",
      "https://le.utah.gov/xcode/Title34/Chapter28/C34-28_1800010118000101.pdf",
    ],
    // Nexus — Utah Insurance Dept Producer Licensing Division.
    nexus: [
      "https://insurance.utah.gov/licensees/producers/",
    ],
    // Hiring — new-hire reporting via the same DWS employer portal hub.
    // DWS New Hire Handbook (HTML + PDF): 20-day deadline, data elements, Utah Code 35A-7 basis, $25/$500 penalties.
    hiring: [
      "https://jobs.utah.gov/ui/employer/public/NewHire/NewHireHandbook.aspx",
      "https://jobs.utah.gov/ui/Employer/Public/NewHire/New%20Hire%20Handbook.pdf",
    ],
    // Remote — UALD division hub (rules apply where the employee works).
    remote: [
      "https://laborcommission.utah.gov/divisions/utah-antidiscrimination-and-labor-uald/",
    ],
    // Doctrine via Hansen v. America Online (Utah Supreme Court opinion in
    // static HTML on the official courts site — states the at-will
    // presumption + the public-policy exception) + UALD exceptions pages.
    at_will: [
      "https://legacy.utcourts.gov/opinions/supopin/hansen072004.htm",
      "https://laborcommission.utah.gov/divisions/utah-antidiscrimination-and-labor-uald/employment-discrimination/",
      "https://laborcommission.utah.gov/divisions/utah-antidiscrimination-and-labor-uald/",
    ],
  },

  // ============================================================
  // 50-STATE EXPANSION (2026-07) — the remaining 47 states, harvested
  // and per-URL verified (loads, on-topic, substantive static text,
  // official government domain) by the 12-batch harvest. Per-state
  // profile comments come from the harvest classification. Topics
  // marked "intentionally unmapped" have no clean fetchable official
  // source and render coming-soon.
  // ============================================================
  // own-threshold state — exempt EAP salary must be 2x state minimum wage for the first 40 hrs (AS 23.10.055(b); $1,120/week as of Jul 1, 2026); daily overtime after 8 hrs; mandatory paid sick leave (Ballot Measure 1) since Jul 1, 2025; no personal income tax or state sales tax, but graduated corporate income tax 0-9.4%.
  AK: {
    wage_hour: [
      "https://labor.alaska.gov/lss/whhome.htm",
      "https://labor.alaska.gov/lss/whact.htm",
    ],
    leave: [
      "https://www.labor.alaska.gov/lss/sick-leave-faq.html",
    ],
    payroll: [
      "https://labor.alaska.gov/estax/",
    ],
    workers_comp: [
      "https://labor.alaska.gov/wc/er-profit.html",
      "https://labor.alaska.gov/wc/",
    ],
    termination: [
      "https://labor.alaska.gov/lss/whfaq.htm",
    ],
    // nexus: intentionally unmapped (coming-soon) — EMPTY BY BLOCKER, not absence: the official sources exist — Alaska Division of Insurance producer licensing (https://www.commerce.alaska.gov/web/ins/Producers.aspx) and business licensing/registration (https://www.commerce.alaska.gov/web/cbpl) — but commerce.alaska.gov sits behind a DataDome captcha wall returning 403 to every automated fetcher tried (WebFetch and curl with full browser headers). No URL could pass verification; the app's fetcher would likely be blocked too — coming-soon until a fetchable official source exists.
    hiring: [
      "https://childsupport.alaska.gov/child-support-enforcement/information",
      "https://childsupport.alaska.gov/docs/childsupportserviceslibraries/brochures/04-6610-employer-guide-to-reporting-09-2025.pdf",
    ],
    remote: [
      "https://labor.alaska.gov/lss/",
    ],
    salary_threshold: [
      "https://labor.alaska.gov/news/2025/news25-11.htm",
      "https://labor.alaska.gov/lss/whact.htm",
    ],
    // Doctrine (whfaq Q17 no-reason firing) + ASCHR exceptions (bases + retaliation).
    at_will: [
      "https://labor.alaska.gov/lss/whfaq.htm",
      "https://humanrights.alaska.gov/services/complaints/",
    ],
    business_tax: [
      "https://tax.alaska.gov/programs/programs/index.aspx?60380",
    ],
  },
  // federal-default — no state minimum wage, overtime, leave, or salary-threshold law; distinctive Business Privilege Tax alongside corporate income tax; no employer-mandate programs
  AL: {
    wage_hour: [
      "https://labor.alabama.gov/Wage_and_Hour_Info.pdf",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://labor.alabama.gov/business/",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://labor.alabama.gov/uc/employer.aspx",
    ],
    workers_comp: [
      "https://adol.alabama.gov/insurance-requirement-information/",
    ],
    termination: [
      "https://www2.labor.alabama.gov/Information/job_termination_laws.aspx",
    ],
    nexus: [
      "https://aldoi.gov/licensing/",
      "https://www.sos.alabama.gov/business-entities",
    ],
    hiring: [
      "https://adol.alabama.gov/employers/alabama-new-hire/",
    ],
    remote: [
      "https://labor.alabama.gov/business/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // ADOL termination page (doctrine implicit) + EEOC (AL has no state FEP agency — federal law governs exceptions). Model may refuse the implicit doctrine.
    at_will: [
      "https://www2.labor.alabama.gov/Information/job_termination_laws.aspx",
      "https://www.eeoc.gov/prohibited-employment-policiespractices",
    ],
    business_tax: [
      "https://www.revenue.alabama.gov/division/individual-corporate/",
      "https://www.revenue.alabama.gov/tax-types/business-privilege-tax/",
    ],
  },
  // own state minimum wage ($11.00) but otherwise federal-default on leave/threshold; no employer-mandate programs
  AR: {
    // labor.arkansas.gov is fetcher-blocked (kept as the user-facing link); grounding via ADE Commissioner's Memo ($11.00 rate, Issue 5) + UA Cooperative Extension (state land-grant institution).
    wage_hour: [
      "https://labor.arkansas.gov/labor/labor-standards/minimum-wage-and-overtime/",
      "https://adecm.ade.arkansas.gov/ViewApprovedMemo.aspx?id=4419",
      "https://www.uaex.uada.edu/business-communities/ced-blog/posts/2023/january/what-is-the-minimum-wage-in-arkansas.aspx",
    ],
    leave: [
      "https://labor.arkansas.gov/labor/labor-standards/",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://dws.arkansas.gov/workforce-services/unemployment/employer-ui-information/",
    ],
    workers_comp: [
      "https://labor.arkansas.gov/workers-comp/awcc-about-us/basic-facts/",
    ],
    termination: [
      "https://labor.arkansas.gov/labor/labor-standards/wage-claims/",
    ],
    nexus: [
      "https://insurance.arkansas.gov/industry-regulation/licensing/",
      "https://www.sos.arkansas.gov/business-commercial-services-bcs/",
    ],
    hiring: [
      "https://portal.arkansas.gov/service/report-new-hire-or-re-hire/",
    ],
    remote: [
      "https://labor.arkansas.gov/labor/labor-standards/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // at_will: intentionally unmapped (coming-soon) — No clean official source stating the at-will doctrine and exceptions — coming-soon.
    business_tax: [
      "https://www.dfa.arkansas.gov/office/taxes/income-tax-administration/corporation-income-tax/",
      "https://www.sos.arkansas.gov/business-commercial-services-bcs/franchise-tax/",
    ],
  },
  // federal-default: no state overtime law or own exempt threshold; distinctive: Prop 206 earned paid sick time mandate (24/40 hrs by employer size) and voter-protected minimum wage indexing.
  // NOTE (2026-07 retry): azica.gov / des.az.gov / difi.az.gov hard-block the
  // generator's fetch (TLS fingerprinting — browser headers don't help), so
  // azleg.gov statute pages (probe-verified 200 with full section text) carry
  // the grounding; the agency URLs stay listed as the better user-facing
  // links if their WAFs ever open up.
  AZ: {
    wage_hour: [
      "https://www.azica.gov/labor-minimum-wage-main-page",
      "https://www.azleg.gov/ars/23/00363.htm",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://www.azica.gov/frequently-asked-questions-about-wage-and-earned-paid-sick-time-laws",
      "https://www.azleg.gov/ars/23/00371.htm",
      "https://www.azleg.gov/ars/23/00372.htm",
    ],
    payroll: [
      "https://des.az.gov/services/employment/unemployment-employer",
      "https://azdor.gov/business/withholding-tax",
    ],
    workers_comp: [
      "https://www.azica.gov/obtaining-workers-compensation-coverage-information",
      "https://www.azleg.gov/ars/23/00961.htm",
    ],
    termination: [
      "https://www.azleg.gov/ars/23/00353.htm",
      "https://www.azica.gov/labor-wage-claims-main-page",
    ],
    nexus: [
      "https://difi.az.gov/licensing/insurance-professionals",
      "https://www.azleg.gov/ars/20/00281.htm",
    ],
    hiring: [
      "https://des.az.gov/services/child-and-family/child-support/employers",
      "https://www.azleg.gov/ars/23/00722-01.htm",
    ],
    remote: [
      "https://www.azica.gov/labor-department",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://www.azleg.gov/ars/23/01501.htm",
    ],
    business_tax: [
      "https://azdor.gov/businesses-arizona/corporate-income-tax",
    ],
  },
  // own-threshold + program-state: CA sets its own minimum wage/exempt threshold, runs SDI/PFL (EDD) and the CalSavers retirement mandate (all employers 1+ employees as of 2026).
  CA: {
    wage_hour: [
      "https://www.dir.ca.gov/dlse/faq_minimumwage.htm",
      "https://www.dir.ca.gov/dlse/faq_overtime.htm",
    ],
    leave: [
      "https://www.dir.ca.gov/dlse/paid_sick_leave.htm",
      "https://edd.ca.gov/en/disability/paid-family-leave/",
    ],
    payroll: [
      "https://edd.ca.gov/en/payroll_taxes/",
    ],
    workers_comp: [
      "https://www.dir.ca.gov/dwc/employer.htm",
    ],
    termination: [
      "https://www.dir.ca.gov/dlse/faq_paydays.htm",
      "https://edd.ca.gov/en/jobs_and_training/layoff_services_warn/",
    ],
    nexus: [
      "https://www.insurance.ca.gov/0200-industry/0200-prod-licensing/0100-applicant-info/",
      "https://www.sos.ca.gov/business-programs/business-entities",
    ],
    hiring: [
      "https://edd.ca.gov/en/payroll_taxes/new_hire_reporting/",
    ],
    remote: [
      "https://www.dir.ca.gov/dlse/",
    ],
    salary_threshold: [
      "https://www.dir.ca.gov/dlse/faq_overtimeexemptions.htm",
      "https://www.dir.ca.gov/dlse/faq_minimumwage.htm",
    ],
    // Labor Code 2922 doctrine + CRD employment page exceptions (15 protected categories, retaliation).
    at_will: [
      "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=LAB&sectionNum=2922",
      "https://calcivilrights.ca.gov/employment/",
    ],
    business_tax: [
      "https://www.ftb.ca.gov/file/business/types/corporations/index.html",
    ],
    state_programs: [
      "https://edd.ca.gov/en/disability/",
      "https://www.treasurer.ca.gov/calsavers/",
    ],
  },
  // own-threshold + program-state: annual COMPS/PAY CALC orders set state minimum wage and exempt salary thresholds; runs FAMLI (paid family/medical leave premiums), HFWA paid sick leave, and the Colorado SecureSavings retirement mandate.
  CO: {
    wage_hour: [
      "https://cdle.colorado.gov/dlss/labor-laws-by-topic/wage-and-hour-laws-including-paid-sick-leave",
    ],
    leave: [
      "https://famli.colorado.gov/employers",
      "https://cdle.colorado.gov/dlss/labor-laws-by-topic/wage-and-hour-laws-including-paid-sick-leave",
    ],
    payroll: [
      "https://cdle.colorado.gov/employers/unemployment-insurance-premiums",
    ],
    workers_comp: [
      "https://cdle.colorado.gov/dwc/employers/insurance-coverage",
    ],
    termination: [
      "https://cdle.colorado.gov/dlss/labor-laws-by-topic/wage-and-hour-laws-including-paid-sick-leave",
      "https://cdle.colorado.gov/employers/layoff/separations",
    ],
    nexus: [
      "https://doi.colorado.gov/insurance-industry/for-producers/agents",
      "https://www.sos.state.co.us/pubs/business/businessHome.html",
    ],
    hiring: [
      "https://childsupport.state.co.us/new-hire-reporting",
      "https://cdle.colorado.gov/employers/recruiting-hiring/new-employer-checklist",
    ],
    remote: [
      "https://cdle.colorado.gov/dlss",
    ],
    // LINK-ONLY: the 2026 PAY CALC order exists ONLY as PDF/DOCX and CDLE's COMPS HTML pages hard-403. The generator's PDF guard fails it cleanly -> coming-soon card with the authoritative link.
    salary_threshold: [
      "https://cdle.colorado.gov/sites/cdle/files/adopted_2026_pay_calc_order_7_ccr_1103-14_12.8.25.pdf",
    ],
    // EXCEPTIONS ONLY — cdle.colorado.gov/termination (the doctrine page) hard-403s all fetchers; may refuse until a doctrine source exists.
    at_will: [
      "https://ccrd.colorado.gov/common-civil-rights-questions",
      "https://ccrd.colorado.gov/discrimination",
    ],
    business_tax: [
      "https://tax.colorado.gov/business-income-tax",
    ],
    state_programs: [
      "https://famli.colorado.gov/employers",
      "https://coloradosecuresavings.com/employers",
    ],
  },
  // program-state with own minimum wage/overtime but federal-default salary threshold; runs CT Paid Leave (FMLI, employee-funded 0.5%), paid sick leave expanding to all employers by 1/1/2027, and MyCTSavings retirement mandate (5+ employees)
  CT: {
    wage_hour: [
      "https://portal.ct.gov/dol/divisions/wage-and-workplace-standards/wage-and-hour",
      "https://portal.ct.gov/dol/divisions/wage-and-workplace-standards",
    ],
    leave: [
      "https://portal.ct.gov/dol/knowledge-base/articles/wage-and-workplace-standards/paid-sick-leave",
      "https://portal.ct.gov/dol/divisions/legal/connecticut-leave-programs",
      "https://www.ctpaidleave.org/",
    ],
    payroll: [
      "https://portal.ct.gov/dol/divisions/unemployment-insurance-tax",
      "https://portal.ct.gov/dol/knowledge-base/articles/unemployment-taxes/how-do-i-register",
    ],
    workers_comp: [
      "https://portal.ct.gov/wcc/knowledge-base/articles/employers/workers-compensation-insurance",
    ],
    termination: [
      "https://portal.ct.gov/dol/divisions/wage-and-workplace-standards/wage-and-hour",
      "https://portal.ct.gov/dol/knowledge-base/articles/employment-and-training/rapid-response/warn",
    ],
    nexus: [
      "https://portal.ct.gov/cid/licensing/producer-individual",
      "https://portal.ct.gov/cid/licensing",
      "https://business.ct.gov/start-your-business/register-your-business",
    ],
    hiring: [
      "https://business.ct.gov/knowledge-base/articles/new-hire-reporting",
    ],
    remote: [
      "https://portal.ct.gov/dol/divisions/wage-and-workplace-standards",
    ],
    salary_threshold: [
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://www.cga.ct.gov/2001/rpt/2001-R-0246.htm",
    ],
    business_tax: [
      "https://portal.ct.gov/drs/corporation-tax/tax-information",
    ],
    state_programs: [
      "https://www.ctpaidleave.org/for-businesses-and-employers",
      "https://myctsavings.com/",
      "https://business.ct.gov/knowledge-base/articles/maintain-your-business/assistance/myctsavings-retirement-program",
    ],
  },
  // program-state — federal FLSA salary thresholds but state $15/hr minimum wage; runs mandatory employer programs: Delaware Paid Leave (live Jan 2026) and Delaware EARNS retirement mandate (5+ employees), plus the incorporation-based franchise tax quirk.
  DE: {
    // Statute text added: Title 19 Ch.9 carries the rate schedule ($15.00 from 2025-01-01); Ch.11 wage payment.
    wage_hour: [
      "https://industrialaffairs.delaware.gov/wage-hour",
      "https://delcode.delaware.gov/title19/c009/index.html",
      "https://delcode.delaware.gov/title19/c011/index.html",
    ],
    leave: [
      "https://labor.delaware.gov/delaware-paid-leave/",
      "https://labor.delaware.gov/delaware-paid-leave/employers/",
    ],
    payroll: [
      "https://labor.delaware.gov/divisions/unemployment-insurance/employer-services/",
    ],
    workers_comp: [
      "https://industrialaffairs.delaware.gov/workers-compensation",
      "https://industrialaffairs.delaware.gov/en/knowledgebase-employer/when-is-an-employer-required-to-carry-workers-compensation-insurance",
    ],
    termination: [
      "https://industrialaffairs.delaware.gov/wage-hour",
      "https://delcode.delaware.gov/title19/c011/",
    ],
    nexus: [
      "https://insurance.delaware.gov/divisions/renewlicense/",
      "https://firststeps.delaware.gov/",
    ],
    hiring: [
      "https://dhss.delaware.gov/dcss/division-of-child-support-services/employers/",
    ],
    remote: [
      "https://industrialaffairs.delaware.gov/en-us/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // Doctrine via SB292 preamble (states current DE at-will law; the bill's just-cause scheme was NEVER enacted) + Title 19 Ch.7 subch. II + DDOL anti-discrimination.
    at_will: [
      "https://legis.delaware.gov/json/BillDetail/GetHtmlDocument?fileAttachmentId=21856",
      "https://delcode.delaware.gov/title19/c007/sc02/index.html",
      "https://industrialaffairs.delaware.gov/anti-discrimination",
    ],
    business_tax: [
      "https://revenue.delaware.gov/business-tax-forms/filing-corporate-income-tax/",
      "https://corp.delaware.gov/frtax/",
    ],
    state_programs: [
      "https://labor.delaware.gov/delaware-paid-leave/",
      "https://treasurer.delaware.gov/earns/",
    ],
  },
  // own-minimum-wage state (constitutional schedule) but federal-default for overtime and salary thresholds; no personal income tax; no state leave/disability/retirement mandate programs.
  FL: {
    wage_hour: [
      "https://floridajobs.org/florida-minimum-wage",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://floridajobs.org/",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://floridarevenue.com/taxes/taxesfees/Pages/reemployment.aspx",
    ],
    workers_comp: [
      "https://www.myfloridacfo.com/division/wc/employer/coverage-requirements",
    ],
    termination: [
      "https://floridajobs.org/workforce-resources/worker-adjustment-and-retraining-notification-(warn)",
    ],
    nexus: [
      "https://myfloridacfo.com/division/agents",
      "https://dos.fl.gov/sunbiz/",
    ],
    hiring: [
      "https://servicesforemployers.floridarevenue.com/Pages/home.aspx",
    ],
    remote: [
      "https://floridajobs.org/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // EXCEPTIONS ONLY — FL at-will is pure common law with no official HTML statement; expect refusal, links still useful.
    at_will: [
      "https://fchr.myflorida.com/faq-frequently-asked-questions",
      "https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0700-0799/0760/Sections/0760.10.html",
    ],
    business_tax: [
      "https://floridarevenue.com/taxes/taxesfees/Pages/corporate.aspx",
    ],
  },
  // federal-default — follows federal minimum wage, overtime, and FLSA salary thresholds; no state leave/disability/retirement mandate programs.
  GA: {
    wage_hour: [
      "https://dol.georgia.gov/minimum-wage",
      "https://dol.georgia.gov/faqs-employers/employers-faqs-fair-labor-standards-act",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://dol.georgia.gov/employment-laws-and-rules",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://dol.georgia.gov/employers/taxes-unemployment-insurance-claims",
    ],
    workers_comp: [
      "https://sbwc.georgia.gov/employer-information",
    ],
    termination: [
      "https://dol.georgia.gov/mass-separations",
      "https://dol.georgia.gov/faqs-individuals/individuals-faqs-laws-and-regulations",
    ],
    nexus: [
      "https://oci.georgia.gov/agents-agency-licensing",
      "https://sos.ga.gov/corporations-division",
    ],
    hiring: [
      "https://dol.georgia.gov/faqs-employers/employers-faqs-laws-and-regulations",
    ],
    remote: [
      "https://dol.georgia.gov/employment-laws-and-rules",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // GDOL FAQ states the doctrine verbatim (O.C.G.A. is Lexis-hosted) + GCEO exceptions.
    at_will: [
      "https://dol.georgia.gov/faqs-individuals/individuals-faqs-fair-labor-standards-act",
      "https://gceo.georgia.gov/faqs/employment-faq",
    ],
    business_tax: [
      "https://dor.georgia.gov/taxes/business-taxes/corporate-income-and-net-worth-tax",
    ],
  },
  // own-threshold + program-state: Hawaii sets its own minimum wage schedule (to $18.00 by 2028) and its own overtime-exempt guaranteed-salary threshold ($4,000/month, HRS ch. 387), and mandates two signature employer programs — Temporary Disability Insurance (TDI) and the Prepaid Health Care Act (employer health coverage for 20+ hr/week employees), both administered by DLIR Disability Compensation Division.
  HI: {
    wage_hour: [
      "https://labor.hawaii.gov/wsd/minimum-wage/",
      "https://labor.hawaii.gov/wsd/wage-and-hour-faqs/",
    ],
    leave: [
      "https://labor.hawaii.gov/wsd/hawaii-family-leave/",
    ],
    payroll: [
      "https://labor.hawaii.gov/ui/",
    ],
    workers_comp: [
      "https://labor.hawaii.gov/dcd/home/aboutwc/",
    ],
    termination: [
      "https://labor.hawaii.gov/wsd/unpaid-wages/",
      "https://labor.hawaii.gov/wdc/the-warn-act/",
    ],
    nexus: [
      "https://cca.hawaii.gov/ins/producers-instructions_insurance_license/",
      "https://cca.hawaii.gov/breg/registration/",
    ],
    hiring: [
      "https://ag.hawaii.gov/csea/employer-information/",
    ],
    remote: [
      "https://labor.hawaii.gov/wsd/",
    ],
    salary_threshold: [
      "https://labor.hawaii.gov/wsd/wage-and-hour-faqs/",
    ],
    at_will: [
      "https://labor.hawaii.gov/wsd/illegal-termination-from-your-job/",
    ],
    business_tax: [
      "https://tax.hawaii.gov/geninfo/get/",
    ],
    state_programs: [
      "https://labor.hawaii.gov/dcd/home/about-tdi/",
      "https://labor.hawaii.gov/dcd/home/about-phc/",
    ],
  },
  // federal-default: minimum wage $7.25 tied to federal, no state overtime law, no paid leave/SDI/retirement mandate; labor enforcement sits with DIAL (dial.iowa.gov) after agency reorganization, UI/WARN with Iowa Workforce Development (workforce.iowa.gov).
  IA: {
    wage_hour: [
      "https://dial.iowa.gov/hearings/wage-and-child-labor/wages",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://dial.iowa.gov/hearings/wage-and-child-labor/wages",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://workforce.iowa.gov/employers/unemployment-insurance",
      "https://workforce.iowa.gov/employers/unemployment-insurance/unemployment-insurance-employer-handbook/unemployment-insurance-taxes",
    ],
    workers_comp: [
      "https://dial.iowa.gov/hearings/workers-comp/compliance",
    ],
    termination: [
      "https://dial.iowa.gov/hearings/wage-and-child-labor/wages",
      "https://workforce.iowa.gov/employers/resources/warn",
    ],
    nexus: [
      "https://iid.iowa.gov/regulated-individuals/insurance-producers-related-professionals/insurance-producers",
      "https://sos.iowa.gov/business-services",
    ],
    hiring: [
      "https://workforce.iowa.gov/employers/unemployment-insurance/reporting-hires",
    ],
    remote: [
      "https://dial.iowa.gov/hearings/wage-and-child-labor",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://dial.iowa.gov/i-need/claims/how-do-i-wage-claim/wage-claims-faq",
    ],
    business_tax: [
      "https://revenue.iowa.gov/topics/corporation-income-tax",
      "https://revenue.iowa.gov/taxes/tax-guidance/business-income-tax/iowa-corporate-income-tax-rates",
    ],
  },
  // program-state with own wage floor: IL sets its own $15/hr minimum wage but follows federal FLSA exempt-salary thresholds (IDOL page confirms $684/wk via FLSA incorporation); mandatory PLAWA paid leave; mandatory Secure Choice retirement program; own mini-WARN Act.
  IL: {
    wage_hour: [
      "https://labor.illinois.gov/laws-rules/fls/minimum-wage-law.html",
      "https://labor.illinois.gov/faqs/minimum-wage-overtime-faq.html",
    ],
    leave: [
      "https://labor.illinois.gov/laws-rules/paidleave.html",
    ],
    payroll: [
      "https://ides.illinois.gov/employer-resources/taxes-reporting.html",
      "https://ides.illinois.gov/employer-resources/taxes-reporting/are-you-a-new-employer-register.html",
    ],
    workers_comp: [
      "https://iwcc.illinois.gov/about/insurance.html",
    ],
    termination: [
      "https://labor.illinois.gov/laws-rules/fls/wage-payment-collection.html",
      "https://labor.illinois.gov/laws-rules/conmed/warn.html",
      "https://dceo.illinois.gov/workforcedevelopment/warn.html",
    ],
    nexus: [
      "https://idoi.illinois.gov/producers/licensescertificationsfaqs.html",
      "https://idoi.illinois.gov/producers/licensescertificationsfaqs/become-resident-producer.html",
    ],
    hiring: [
      "https://ides.illinois.gov/employer-resources/taxes-reporting/new-hires.html",
    ],
    remote: [
      "https://labor.illinois.gov/laws-rules.html",
    ],
    salary_threshold: [
      "https://labor.illinois.gov/laws-rules/fls/overtime-exemption.html",
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://labor.illinois.gov/faqs.html",
    ],
    business_tax: [
      "https://tax.illinois.gov/research/taxinformation/income/corporate.html",
      "https://tax.illinois.gov/questionsandanswers/answer.82.html",
    ],
    state_programs: [
      "https://illinoistreasurer.gov/home/individuals/my-illinois-savings/",
      "https://tax.illinois.gov/businesses/securechoiceprogramenforcement.html",
    ],
  },
  // federal-default — minimum wage $7.25 matches federal, follows FLSA overtime and exempt salary thresholds, no state paid leave program, no employer-mandate state programs (state_programs omitted)
  IN: {
    wage_hour: [
      "https://www.in.gov/dol/wage-and-hour/wage-and-hour-home/",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://www.in.gov/dol/",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://www.in.gov/dwd/indiana-unemployment/employers/",
    ],
    workers_comp: [
      "https://www.in.gov/wcb/employers/",
      "https://www.in.gov/wcb/compliance/",
      "https://www.in.gov/wcb/employees/who-is-eligible/",
    ],
    termination: [
      "https://faqs.in.gov/hc/en-us/articles/115005044367-I-have-a-wage-issue-where-do-I-go",
      "https://www.in.gov/dwd/warn-notices/",
    ],
    nexus: [
      "https://www.in.gov/idoi/licensing/",
      "https://inbiz.in.gov/BOS/Home/Index",
    ],
    hiring: [
      "https://www.in.gov/dcs/child-support/employer-information/new-hire-reporting/",
      "https://www.in.gov/dwd/indiana-unemployment/employers/employer-guide/unemployer-insurance-employer-guide/new-hire-reporting/",
    ],
    remote: [
      "https://www.in.gov/dol/wage-and-hour/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // IN.gov FAQ covers both halves; ICRC retaliation page reinforces exceptions.
    at_will: [
      "https://faqs.in.gov/hc/en-us/articles/115005043967-Can-my-employer-terminate-me-for-no-reason",
      "https://www.in.gov/icrc/enforcement/employment/retaliation-in-employment",
    ],
    business_tax: [
      "https://www.in.gov/dor/i-am-a/business-corp/",
    ],
  },
  // federal-default | minimum wage pegged at federal $7.25, no state leave programs, no own salary threshold; quirks are the 46-hr state overtime rule for non-FLSA employers and the $20k-payroll workers-comp threshold.
  KS: {
    wage_hour: [
      "https://www.dol.ks.gov/employers/workplace-laws",
      "https://www.dol.ks.gov/employers/workplace-laws/workplace-laws-faqs",
    ],
    leave: [
      "https://www.dol.ks.gov/employers/workplace-laws",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://www.dol.ks.gov/employers/employer-services/unemployment-tax",
    ],
    workers_comp: [
      "https://www.dol.ks.gov/workers-compensation/overview",
    ],
    // K.S.A. 44-315 (statute HTML on kslegislature.gov — session-scoped path, recheck at regen) carries the next-regular-payday rule; KDOL pages kept as user-facing links.
    termination: [
      "https://www.kslegislature.gov/li/b2025_26/statute/044_000_0000_chapter/044_003_0000_article/044_003_0015_section/044_003_0015_k/",
      "https://www.dol.ks.gov/employers/workplace-laws/workplace-laws-faqs",
      "https://www.dol.ks.gov/employers/workplace-laws/wage-claims",
    ],
    nexus: [
      "https://www.insurance.kansas.gov/licensing",
    ],
    hiring: [
      "https://www.dol.ks.gov/employers/employer-services/new-hire-reporting",
    ],
    remote: [
      "https://www.dol.ks.gov/employers/workplace-laws",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://www.dol.ks.gov/employers/workplace-laws/workplace-laws-faqs",
    ],
    business_tax: [
      "https://www.ksrevenue.gov/bustaxtypescorp.html",
      "https://www.ksrevenue.gov/business.html",
    ],
  },
  // federal-default for wage floor and salary thresholds, but with its own stricter state rules (7th-day overtime, paid rest breaks, 14-day final-pay rule); no state leave/disability/retirement mandate programs.
  KY: {
    wage_hour: [
      "https://elc.ky.gov/workplace-standards/Pages/Wages-and-Hours.aspx",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://elc.ky.gov/workplace-standards/Pages/default.aspx",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://kcc.ky.gov/career/employers/Pages/If-You-Are-An-Employer.aspx",
    ],
    workers_comp: [
      "https://elc.ky.gov/Workers-Compensation/Pages/Employer-Frequently-Asked-Questions.aspx",
    ],
    termination: [
      "https://elc.ky.gov/workplace-standards/Pages/Wages-and-Hours.aspx",
    ],
    nexus: [
      "https://insurance.ky.gov/ppc/new_default.aspx?divid=2",
      "https://onestop.ky.gov/Pages/default.aspx",
    ],
    hiring: [
      "https://onestop.ky.gov/manage/Pages/employees.aspx",
    ],
    remote: [
      "https://elc.ky.gov/workplace-standards/Pages/default.aspx",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // ELC page states the doctrine + KCHR KRS 344 exceptions.
    at_will: [
      "https://elc.ky.gov/workplace-standards/Pages/Wages-and-Hours.aspx",
      "https://kchr.ky.gov/About/Pages/Kentucky-Civil-Rights-Act.aspx",
    ],
    business_tax: [
      "https://revenue.ky.gov/Business/Corporation-Income-and-Limited-Liability-Entity-Tax/Pages/default.aspx",
    ],
  },
  // federal-default on wage/leave/threshold; workers' comp from employee #1; franchise tax just repealed (2026) with flat 5.5% corporate income rate; no employer-mandate programs
  LA: {
    wage_hour: [
      "https://www.laworks.net/laborlawinfo.asp",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://www.laworks.net/laborlawinfo.asp",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://www.laworks.net/UnemploymentInsurance/UI_WageTaxReportingOverview.asp",
    ],
    workers_comp: [
      "https://www.laworks.net/FAQs/FAQ_WorkComp_EmployerCoverage.asp",
    ],
    termination: [
      "https://www.legis.la.gov/legis/Law.aspx?d=83945",
      "https://www.laworks.net/laborlawinfo.asp",
    ],
    // La. R.S. 22:1546 (producer lines of authority / licensing, statute
    // viewer HTML — hunt-3 straggler fix) carries grounding; LDI page kept
    // as the user-facing link.
    nexus: [
      "https://www.ldi.la.gov/industry/producer-adjuster/license-application",
      "https://www.legis.la.gov/legis/Law.aspx?d=508528",
      "https://legis.la.gov/Legis/LawPrint.aspx?d=508521",
    ],
    hiring: [
      "https://www.dcfs.louisiana.gov/page/164",
    ],
    remote: [
      "https://www.laworks.net/laborlawinfo.asp",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // Civil Code art. 2747 doctrine + LCHR exceptions.
    at_will: [
      "https://www.legis.la.gov/legis/Law.aspx?d=109812",
      "https://humanrights.la.gov/",
    ],
    business_tax: [
      "https://revenue.louisiana.gov/businesses/widely-used-tax-types/corporate-income-franchise-tax/",
      "https://revenue.louisiana.gov/tax-education-and-faqs/faqs/income-tax-reform/is-the-corporation-franchise-tax-repealed/",
    ],
  },
  // program-state for leave (mandatory PFML premium program + Earned Sick Time) but federal-default for exempt salary threshold; no mandatory state retirement program (CORE plan is voluntary/nonprofit-only); business tax is the MA corporate excise
  MA: {
    wage_hour: [
      "https://www.mass.gov/info-details/massachusetts-law-about-minimum-wage",
      "https://www.mass.gov/info-details/massachusetts-law-about-overtime",
      "https://www.mass.gov/guides/pay-and-recordkeeping",
    ],
    leave: [
      "https://www.mass.gov/info-details/earned-sick-time",
      "https://www.mass.gov/paid-family-and-medical-leave-information-for-massachusetts-employers",
    ],
    payroll: [
      "https://www.mass.gov/unemployment-insurance-for-employers",
      "https://www.mass.gov/orgs/department-of-unemployment-assistance",
    ],
    workers_comp: [
      "https://www.mass.gov/workers-compensation-for-employers",
      "https://www.mass.gov/orgs/department-of-industrial-accidents",
    ],
    termination: [
      "https://www.mass.gov/info-details/massachusetts-law-about-employment-termination",
      "https://www.mass.gov/guides/pay-and-recordkeeping",
      "https://www.mass.gov/how-to/submit-a-warn-notice",
    ],
    nexus: [
      "https://www.mass.gov/info-details/producer-licensing-department",
      "https://www.mass.gov/info-details/individual-and-business-entity-licensing",
    ],
    hiring: [
      "https://www.mass.gov/how-to/report-new-hires",
      "https://www.mass.gov/info-details/learn-about-the-new-hire-reporting-program",
      "https://www.mass.gov/info-details/massachusetts-law-about-hiring-employees",
    ],
    remote: [
      "https://www.mass.gov/orgs/the-attorney-generals-fair-labor-division",
      "https://www.mass.gov/orgs/department-of-labor-standards",
    ],
    // dol.gov + mass.gov both fetch fine locally (datacenter 403s only); mass.gov page states MA parallels the federal exemptions.
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
      "https://www.mass.gov/info-details/massachusetts-law-about-overtime",
    ],
    at_will: [
      "https://www.mass.gov/info-details/massachusetts-law-about-employment-termination",
    ],
    business_tax: [
      "https://www.mass.gov/info-details/massachusetts-dor-corporate-excise-tax-guide",
      "https://www.mass.gov/business-taxes",
    ],
    state_programs: [
      "https://www.mass.gov/orgs/department-of-family-and-medical-leave",
      "https://www.mass.gov/paid-family-and-medical-leave-information-for-massachusetts-employers",
      "https://www.mass.gov/guides/employers-introduction-to-paid-family-and-medical-leave",
    ],
  },
  // program-state — state $15 minimum wage but federal FLSA salary thresholds; mandatory sick-and-safe leave and MarylandSaves now, FAMLI premiums/benefits pending (2027/2028).
  MD: {
    wage_hour: [
      "https://www.labor.maryland.gov/labor/wages/wagehrfacts.shtml",
      "https://www.labor.maryland.gov/labor/wages/",
    ],
    leave: [
      "https://labor.maryland.gov/paidleave/",
      "https://paidleave.maryland.gov/",
    ],
    payroll: [
      "https://labor.maryland.gov/unemployment-insurance/employer-agent/new-employer-get-started.shtml",
    ],
    workers_comp: [
      "https://www.wcc.state.md.us/Gen_Info/FAQ%20Employers.html",
    ],
    termination: [
      "https://labor.maryland.gov/labor/wagepay/wppayonterm.shtml",
      "https://labor.maryland.gov/labor/wagepay/wpdiswork.shtml",
    ],
    nexus: [
      "https://insurance.maryland.gov/Producer/pages/default.aspx",
      "https://businessexpress.maryland.gov/",
    ],
    hiring: [
      "https://dhs.maryland.gov/child-support-services/report-new-hires/",
    ],
    remote: [
      "https://www.labor.maryland.gov/labor/wages/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://labor.maryland.gov/labor/wagepay/wpatwill.shtml",
    ],
    business_tax: [
      "https://commerce.maryland.gov/about/taxes",
    ],
    state_programs: [
      "https://marylandsaves.com/",
      "https://paidleave.maryland.gov/",
    ],
  },
  // own-threshold + program-state — Maine sets its own overtime-exempt salary threshold tied to the state minimum wage and runs mandatory employer programs (PFML premium program, Earned Paid Leave mandate)
  ME: {
    wage_hour: [
      "https://www.maine.gov/labor/labor_laws/minimumwagefaq/",
      "https://www.maine.gov/labor/labor_laws/overtime/",
    ],
    leave: [
      "https://www.maine.gov/labor/labor_laws/earnedpaidleave/",
      "https://www.maine.gov/paidleave/",
    ],
    payroll: [
      "https://www.maine.gov/unemployment/employers/",
    ],
    workers_comp: [
      "https://www.maine.gov/pfr/insurance/frequently-asked-questions/workers-compensation",
    ],
    termination: [
      "https://www.maine.gov/labor/labor_laws/employeerightsguide/",
      "https://legislature.maine.gov/statutes/26/title26sec625-B.html",
    ],
    nexus: [
      "https://www.maine.gov/pfr/insurance/licensees/individuals-business-entities/producers/producer-licensure",
      "https://www.maine.gov/sos/corporations-commissions/corporations-business-services",
    ],
    hiring: [
      "https://www.maine.gov/dhhs/ofi/programs-services/child-support-services/employers/new-hire-faq",
    ],
    remote: [
      "https://www.maine.gov/labor/labor_laws/",
    ],
    salary_threshold: [
      "https://www.maine.gov/labor/labor_laws/overtime/",
    ],
    at_will: [
      "https://www.maine.gov/labor/labor_laws/employeerightsguide/",
    ],
    business_tax: [
      "https://www.maine.gov/revenue/taxes/income-estate-tax/corporate-income-tax-1120me",
    ],
    state_programs: [
      "https://www.maine.gov/paidleave/",
      "https://www.maine.gov/paidleave/employers/",
    ],
  },
  // hybrid — sets its own minimum wage/overtime law (Improved Workforce Opportunity Wage Act, $13.73/hr as of 1/1/2026) and a mandatory paid-sick-leave program (Earned Sick Time Act, eff. 2/21/2025), but follows federal FLSA for the exempt salary threshold; no TDI, no retirement mandate, no paid-family-leave premium program
  MI: {
    wage_hour: [
      "https://www.michigan.gov/leo/bureaus-agencies/ber/wage-and-hour/min-wage",
      "https://www.michigan.gov/leo/bureaus-agencies/ber/wage-and-hour/min-wage/acts-rules/michigans-minimum-wage-and-overtime-law-improved-workforce-opportunity-wage-act-public-act-337-of-2",
    ],
    leave: [
      "https://www.michigan.gov/leo/bureaus-agencies/ber/wage-and-hour/paid-medical-leave-act",
      "https://www.michigan.gov/leo/bureaus-agencies/ber/wage-and-hour/frequently-asked-questions/wage-and-hour/earned-sick-time-faqs",
    ],
    payroll: [
      "https://www.michigan.gov/leo/bureaus-agencies/uia/employers",
      "https://www.michigan.gov/leo/bureaus-agencies/uia/tools/employer-help-center/register-your-business",
    ],
    workers_comp: [
      "https://www.michigan.gov/leo/bureaus-agencies/wdca/insurance-requirements/pages/workers-disability-compensation-insurance-requirements",
      "https://www.michigan.gov/leo/bureaus-agencies/wdca/employers-and-business-owners/employer-frequently-asked-questions",
    ],
    termination: [
      "https://www.michigan.gov/leo/bureaus-agencies/ber/wage-and-hour/payment-of-wages-and-fringe-benefits-act-public-act-390-of-1978",
      "https://www.michigan.gov/leo/bureaus-agencies/wd/programs-services/worker-adjustment-and-retraining-notification-act-warn",
    ],
    nexus: [
      "https://www.michigan.gov/difs/industry/licensing-ins/agnt-ins",
      "https://www.michigan.gov/difs/industry/licensing-ins/agncy-ins",
      "https://www.michigan.gov/taxes/business-taxes/new-business-registration",
    ],
    // Michigan has no state new-hire statute (rides federal 42 USC 653a); the official Treasury Form 3281 PDF carries the concrete 20-day rule + data elements.
    hiring: [
      "https://www.michigan.gov/mdhhs/adult-child-serv/child-sup/resources/employers/new-hire-reporting",
      "https://www.michigan.gov/-/media/Project/Websites/taxes/Forms/SUW/3281.pdf?rev=c83f1103db1f4d01a4fb3ab6d9221102",
    ],
    remote: [
      "https://www.michigan.gov/leo/bureaus-agencies/ber/wage-and-hour",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://www.michigan.gov/leo/bureaus-agencies/ber/wage-and-hour/frequently-asked-questions/wage-and-hour/general-faqs",
    ],
    business_tax: [
      "https://www.michigan.gov/taxes/business-taxes/cit",
      "https://www.michigan.gov/taxes/business-taxes",
    ],
  },
  // program-state (heavy): MN Paid Leave (launched Jan 2026, paidleave.mn.gov), ESST sick leave, Secure Choice retirement mandate (5+ employees, rollout began Jan 2026), own MN FLSA with 48-hour overtime threshold, unified state minimum wage ($11.41/hr all employers as of Jan 1 2026, no tip credit); follows federal white-collar salary thresholds.
  MN: {
    wage_hour: [
      "https://www.dli.mn.gov/business/employment-practices/minimum-wage-minnesota",
      "https://www.dli.mn.gov/business/employment-practices/overtime-laws",
    ],
    leave: [
      "https://paidleave.mn.gov/",
      "https://mn.gov/deed/paidleave/employers/",
      "https://www.dli.mn.gov/sick-leave",
    ],
    payroll: [
      "https://www.uimn.org/employers/index.jsp",
    ],
    workers_comp: [
      "https://www.dli.mn.gov/business/workers-compensation/work-comp-mandatory-coverage-information",
      "https://www.dli.mn.gov/business/workers-compensation/work-comp-who-needs-workers-compensation-coverage",
    ],
    termination: [
      "https://www.dli.mn.gov/business/employment-practices/employment-termination",
      "https://www.dli.mn.gov/business/employment-practices/termination-faqs",
      "https://www.revisor.mn.gov/statutes/cite/116L.976",
    ],
    nexus: [
      "https://www.revisor.mn.gov/statutes/cite/60K.32",
    ],
    hiring: [
      "https://www.revisor.mn.gov/statutes/cite/142A.29",
      "https://www.dli.mn.gov/employee-notice",
    ],
    remote: [
      "https://www.dli.mn.gov/business/employment-practices",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://www.dli.mn.gov/business/employment-practices/employment-termination",
      "https://www.dli.mn.gov/business/employment-practices/termination-faqs",
    ],
    business_tax: [
      "https://www.revenue.state.mn.us/corporation-franchise-tax",
    ],
    state_programs: [
      "https://paidleave.mn.gov/",
      "https://www.dli.mn.gov/sick-leave",
      "https://securechoice.mn.gov/",
    ],
  },
  // largely federal-default with own-minimum-wage: state-set minimum wage ($15.00/hr in 2026 via Prop A ballot initiative, annual adjustments) with state overtime provision (RSMo 290.500-290.530); no state paid-leave program (Prop A sick time repealed), no state WARN, federal FLSA salary thresholds, 4% corporate income tax.
  MO: {
    wage_hour: [
      "https://labor.mo.gov/dls/minimum-wage",
      "https://labor.mo.gov/dls/general",
    ],
    leave: [
      "https://labor.mo.gov/dls/general",
      "https://labor.mo.gov/dls/proposition-a-paid-sick-time-benefits-faqs",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://labor.mo.gov/des/employers",
    ],
    workers_comp: [
      "https://labor.mo.gov/dwc/employers",
      "https://labor.mo.gov/faqs/knowledge-base/who-required-carry-workers-compensation-insurance-coverage",
    ],
    termination: [
      "https://labor.mo.gov/dls/general",
      "https://jobs.mo.gov/employer/warn",
    ],
    nexus: [
      "https://insurance.mo.gov/producers",
      "https://insurance.mo.gov/resident-producers/resident-producer-licensing-application-requirements",
      "https://www.sos.mo.gov/business/corporations/startbusiness",
    ],
    hiring: [
      "https://www.missouriemployer.dss.mo.gov/NewHireInfo.aspx",
      "https://dss.mo.gov/child-support/employers/",
    ],
    remote: [
      "https://labor.mo.gov/dls",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://labor.mo.gov/dls/general",
    ],
    business_tax: [
      "https://dor.mo.gov/taxation/business/tax-types/corporation-income/",
      "https://dor.mo.gov/taxation/business/",
    ],
  },
  // federal-default — no state wage/leave/threshold law and no state labor dept (MDES handles UI only); franchise tax phasing out (repeal Jan 2028); no employer-mandate programs
  MS: {
    wage_hour: [
      "https://mdes.ms.gov/employers/unemployment-tax/employer-resources/employment-issues/",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://mdes.ms.gov/employers/",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://mdes.ms.gov/employers/",
    ],
    workers_comp: [
      "https://mwcc.ms.gov/pdf/WCFacts2013.pdf",
    ],
    termination: [
      "https://mdes.ms.gov/employers/unemployment-tax/employer-resources/employment-issues/",
    ],
    nexus: [
      "https://www.mid.ms.gov/mississippi-insurance-department/licensing/producer-individual-licensing/",
      "https://www.sos.ms.gov/business-services",
    ],
    hiring: [
      "https://www.mdhs.ms.gov/childsupport/employers/",
      "https://ms-newhire.com/reporting_fundamentals",
    ],
    remote: [
      "https://mdes.ms.gov/employers/unemployment-tax/employer-resources/employment-issues/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // MDES FAQ states doctrine + discrimination limit; EEOC is MS's actual exceptions enforcement (no state FEP agency).
    at_will: [
      "https://mdes.ms.gov/job-searching-faqs/",
      "https://www.eeoc.gov/prohibited-employment-policiespractices",
    ],
    // FAQ page carries rates/brackets/franchise phase-out; dor.ms.gov needs the curl fallback (Node TLS).
    business_tax: [
      "https://www.dor.ms.gov/business/corporate-income-and-franchise-tax-faqs",
      "https://www.dor.ms.gov/business/corporate-income-and-franchise-tax",
    ],
  },
  // federal-default for exempt salary threshold, but sets its own CPI-indexed minimum wage ($10.85 effective 1/1/2026, no tip credit) and is unique nationally as a NON-at-will state (WDEA); no state paid-leave program, no employer-mandate programs, no general sales tax.
  MT: {
    wage_hour: [
      "https://erd.dli.mt.gov/labor-standards/wage-and-hour-payment-act/state-minimum-wage",
      "https://erd.dli.mt.gov/labor-standards/wage-and-hour-payment-act/overtime",
    ],
    leave: [
      "https://erd.dli.mt.gov/labor-standards/",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://uid.dli.mt.gov/employers/",
      "https://uid.dli.mt.gov/employers/eservices/",
    ],
    workers_comp: [
      "https://erd.dli.mt.gov/work-comp-regulations/insurance-compliance/",
      "https://erd.dli.mt.gov/work-comp-regulations/",
    ],
    termination: [
      "https://erd.dli.mt.gov/labor-standards/wage-and-hour-payment-act/wage-payment-act",
      "https://erd.dli.mt.gov/labor-standards/wage-and-hour-payment-act/wage-and-hour-faq",
    ],
    nexus: [
      "https://csimt.gov/insurance/licensing/",
      "https://sosmt.gov/business/",
    ],
    hiring: [
      "https://dphhs.mt.gov/cssd/employerinfo/newhirereporting",
    ],
    remote: [
      "https://erd.dli.mt.gov/labor-standards/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://mca.legmt.gov/bills/mca/title_0390/chapter_0020/part_0090/sections_index.html",
      "https://erd.dli.mt.gov/labor-standards/wage-and-hour-payment-act/wage-and-hour-faq",
    ],
    business_tax: [
      "https://revenue.mt.gov/taxes/corporate-income-tax",
    ],
  },
  // federal-default on wage/threshold ($7.25, FLSA overtime) with no state leave programs, but a distinctive tax structure: 2.00% corporate income tax phasing to zero plus a separate franchise tax.
  NC: {
    wage_hour: [
      "https://www.labor.nc.gov/workplace-rights/employee-rights-regarding-time-worked-and-wages-earned/minimum-wage-nc",
      "https://www.labor.nc.gov/workplace-rights/employee-rights-regarding-time-worked-and-wages-earned/overtime-pay-salary-and-comp-time",
    ],
    leave: [
      "https://www.labor.nc.gov/workplace-rights/employee-rights-regarding-time-worked-and-wages-earned",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://www.des.nc.gov/employers",
    ],
    workers_comp: [
      "https://www.ic.nc.gov/wcinsrqmt.html",
    ],
    termination: [
      "https://www.labor.nc.gov/workplace-rights/employee-rights-regarding-time-worked-and-wages-earned/payment-final-wages",
    ],
    nexus: [
      "https://www.ncdoi.gov/licensees/insurance-producer-and-adjuster-licensing",
      "https://www.sosnc.gov/divisions/business_registration",
    ],
    hiring: [
      "https://ncnewhires.ncdhhs.gov/reporting_fundamentals",
    ],
    remote: [
      "https://www.labor.nc.gov/workplace-rights/employee-rights-regarding-time-worked-and-wages-earned",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://www.labor.nc.gov/workplace-rights/employee-rights-regarding-time-worked-and-wages-earned/employment-will",
    ],
    business_tax: [
      "https://www.ncdor.gov/taxes-forms/corporate-income-and-franchise-tax",
      "https://www.ncdor.gov/taxes-forms/corporate-income-franchise-tax/corporate-income-and-franchise-tax-rates",
    ],
  },
  // federal-default | no state minimum wage above federal, no state leave programs, no own salary threshold; only distinctive feature is the monopolistic WSI workers-comp fund.
  ND: {
    wage_hour: [
      "https://www.nd.gov/labor/wage-and-hour-topics",
      "https://www.nd.gov/labor/wage-and-hour-faq",
    ],
    leave: [
      "https://www.nd.gov/labor/wage-and-hour-faq",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://www.jobsnd.com/unemployment-business-tax",
    ],
    workers_comp: [
      "https://www.workforcesafety.com/employers/insurance-coverage-information/coverage-requirements",
    ],
    termination: [
      "https://www.nd.gov/labor/wage-and-hour-faq",
    ],
    nexus: [
      "https://www.insurance.nd.gov/producers",
    ],
    // HHS reporting-requirements page (20 days, data elements) + full NDCC ch. 34-15 statute PDF.
    hiring: [
      "https://www.hhs.nd.gov/childsupport/employers/new-hire-reporting/reporting-requirements",
      "https://ndlegis.gov/cencode/t34c15.pdf",
    ],
    remote: [
      "https://www.nd.gov/labor/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://www.nd.gov/labor/wage-and-hour-faq",
    ],
    business_tax: [
      "https://www.tax.nd.gov/business/corporate-income-tax",
    ],
  },
  // program-state (lightly): state minimum wage ($15) and a new paid-sick-time employer mandate (no premium/state fund), federal overtime/salary-threshold defaults, declining corporate income tax.
  NE: {
    wage_hour: [
      "https://dol.nebraska.gov/LaborStandards",
      "https://dol.nebraska.gov/webdocs/Resources/Items/Wages.pdf",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://dol.nebraska.gov/LaborStandards/PaidSickTime/PSTFAQs",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://dol.nebraska.gov/UITax",
    ],
    workers_comp: [
      "https://www.newcc.gov/employers/employer-frequently-asked-questions",
      "https://www.newcc.gov/employers",
    ],
    // Neb. Rev. Stat. 48-1230(4): next regular payday or within two weeks, whichever is sooner.
    termination: [
      "https://nebraskalegislature.gov/laws/statutes.php?statute=48-1230",
      "https://dol.nebraska.gov/LaborStandards/wages/WageComplaint",
    ],
    nexus: [
      "https://doi.nebraska.gov/producer-licensing",
    ],
    hiring: [
      "https://dhhs.ne.gov/Pages/Child-Support-Employer-New-Hire.aspx",
    ],
    remote: [
      "https://dol.nebraska.gov/LaborStandards",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // NE Supreme Court opinion (257 Neb. 50) states the rule verbatim + NEOC exceptions. NDOL's FAQ 404s post-restructure.
    at_will: [
      "https://www.nebraska.gov/ncir/reporter_and_appeals_search/data/appeals/Nebraska%20Supreme%20Court/257%20Neb.%2050.htm",
      "https://neoc.nebraska.gov/employment",
    ],
    business_tax: [
      "https://revenue.nebraska.gov/about/frequently-asked-questions/business-income-tax-faqs",
    ],
  },
  // federal-default — federal minimum wage, federal FLSA overtime and salary threshold, no mandatory paid leave (voluntary Granite State PFML only), no wage income tax; distinctive BPT+BET business tax structure. state_programs omitted: the only signature program (Granite State PFML) is voluntary, not an employer mandate
  NH: {
    wage_hour: [
      "https://www.dol.nh.gov/inspections/wage-and-hour/minimum-wage",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://www.paidfamilymedicalleave.nh.gov/",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://www.nhes.nh.gov/employers/register-your-company-nh",
      "https://www.nhes.nh.gov/employers/employer-claims-taxes",
    ],
    workers_comp: [
      "https://www.dol.nh.gov/workers-compensation/employer-information",
      "https://www.dol.nh.gov/resource-center/frequently-asked-questions/workers-compensation-insurance-faqs",
    ],
    termination: [
      "https://www.dol.nh.gov/resource-center/frequently-asked-questions/wages-and-work-hours-faqs",
    ],
    nexus: [
      "https://www.insurance.nh.gov/producersadjusters/producer-licenses",
      "https://quickstart.sos.nh.gov/online",
    ],
    hiring: [
      "https://www.nhes.nh.gov/employers/business-compliance",
      "https://www.nhes.nh.gov/document/employers-guide-new-hire-reporting",
    ],
    remote: [
      "https://www.dol.nh.gov/inspections/wage-and-hour",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://www.humanrights.nh.gov/types-discrimination/employment-discrimination/employers/discharge",
    ],
    business_tax: [
      "https://www.revenue.nh.gov/taxes-glance/business-taxes",
      "https://www.revenue.nh.gov/resource-center/frequently-asked-questions/business-profits-tax",
      "https://www.revenue.nh.gov/resource-center/frequently-asked-questions/business-enterprise-tax",
    ],
  },
  // program-state — sets its own minimum wage ($15.92/hr for 2026) but follows federal FLSA exempt-salary thresholds; runs mandatory TDI + FLI, Earned Sick Leave, a strengthened mini-WARN (90-day notice + severance), and the RetireReady NJ retirement mandate.
  NJ: {
    wage_hour: [
      "https://www.nj.gov/labor/wageandhour/",
      "https://www.nj.gov/labor/wageandhour/support/faqs/wageandhouremployerfaqs.shtml",
    ],
    leave: [
      "https://www.nj.gov/labor/myworkrights/leave-benefits/sick-leave/",
      "https://www.nj.gov/labor/myleavebenefits/",
    ],
    payroll: [
      "https://www.nj.gov/labor/ea/employer-services/register-update/",
      "https://www.nj.gov/labor/ea/employer-services/rate-info/",
    ],
    workers_comp: [
      "https://www.nj.gov/labor/workerscompensation/employer-requirements/",
    ],
    termination: [
      "https://www.nj.gov/labor/wageandhour/support/faqs/wageandhouremployerfaqs.shtml",
      "https://www.nj.gov/labor/business-services/layoffs-and-closing/file-warn-notice/",
    ],
    nexus: [
      "https://www.nj.gov/dobi/inslic.htm",
      "https://business.nj.gov/pages/register-your-business",
    ],
    hiring: [
      "https://business.nj.gov/pages/hiring-employees",
      "https://www.njcsesp.com/law",
    ],
    remote: [
      "https://www.nj.gov/labor/myworkrights/",
    ],
    salary_threshold: [
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // NJDOL FAQ doctrine + CSC LAD description + NJDOL retaliation/CEPA page (njoag.gov blocks fetchers).
    at_will: [
      "https://www.nj.gov/labor/wageandhour/support/faqs/wageandhourworkerfaqs.shtml",
      "https://nj.gov/csc/about/divisions/eeo/laws.shtml",
      "https://www.nj.gov/labor/myworkrights/worker-protections/retaliation_protections/",
    ],
    business_tax: [
      "https://www.nj.gov/treasury/taxation/cbt/index.shtml",
      "https://www.nj.gov/treasury/taxation/corp_over.shtml",
    ],
    state_programs: [
      "https://www.nj.gov/labor/myleavebenefits/employer/",
      "https://www.nj.gov/treasury/securechoiceprogram/",
      "https://www.nj.gov/treasury/securechoiceprogram/employers/index.shtml",
    ],
  },
  // federal-default on exempt salary threshold; sets own minimum wage ($12.00/hr, NMSA 50-4-22) and a mandatory paid-sick-leave mandate (Healthy Workplaces Act); distinctive gross receipts tax instead of a sales tax; no PFML/SDI and no retirement mandate (Work and Save is voluntary and currently inactive).
  NM: {
    // cabq.gov (official city gov) states the prevailing STATE $12.00 rate; NMAC 11.1.4 carries the wage-hour rules (DWS is WAF-blocked).
    wage_hour: [
      "https://www.cabq.gov/legal/albuquerque-minimum-wage-information",
      "https://www.srca.nm.gov/parts/title11/11.001.0004.html",
    ],
    leave: [
      "https://www.srca.nm.gov/parts/title11/11.001.0006.html",
    ],
    payroll: [
      "https://biz.nm.gov/business-navigator/file-and-pay-taxes/",
      "https://www.tax.newmexico.gov/businesses/wage-withholding-tax/",
    ],
    workers_comp: [
      "https://www.workerscomp.nm.gov/faqs/",
    ],
    // termination: intentionally unmapped (coming-soon) — no fetchable official source — final-paycheck rules (NMSA 50-4-4: fixed wages due within 5 days of discharge; 50-4-5: quitting employees next regular payday) exist only on the WAF-blocked DWS site or non-government statute mirrors; NM has no state mini-WARN act — coming-soon.
    nexus: [
      "https://www.osi.state.nm.us/en/insurance-professionals/individuals-and-agencies/",
      "https://www.tax.newmexico.gov/businesses/who-must-register-a-business/",
    ],
    hiring: [
      "https://nm-newhire.com/",
      "https://biz.nm.gov/business-navigator/workplace-hiring-requirements/",
    ],
    remote: [
      "https://biz.nm.gov/business-navigator/workplace-hiring-requirements/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
      "https://www.govinfo.gov/link/cfr/29/541?link-type=pdf&sectionnum=600&year=mostrecent",
    ],
    // EXCEPTIONS ONLY (HRB rules + NMSA 28-1-7 session-law text); doctrine sources are WAF-blocked/PDF — may refuse.
    at_will: [
      "https://www.srca.nm.gov/parts/title09/09.001.0001.html",
      "https://www.nmlegis.gov/sessions/03%20Regular/FinalVersions/SB0028.html",
    ],
    business_tax: [
      "https://www.tax.newmexico.gov/businesses/gross-receipts-overview/",
      "https://www.tax.newmexico.gov/businesses/corporate-income-franchise-tax-overview/",
    ],
  },
  // federal-default threshold, no PFML/SDI/retirement mandate; distinctive: SB 312 paid leave mandate, daily overtime, MBT payroll tax, no corporate income tax.
  NV: {
    wage_hour: [
      "https://labor.nv.gov/",
      "https://www.leg.state.nv.us/nrs/nrs-608.html",
    ],
    leave: [
      "https://labor.nv.gov/uploadedFiles/labornvgov/content/Employer/SB%20312%20Paid%20Leave%20English.pdf",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://detr.nv.gov/Page/UI_Information_for_Employers",
    ],
    // NRS 616B (616B.612/.633 coverage mandate from one employee) + 616D (616D.200 penalties: 6yr back premiums, misdemeanor->felony) carry grounding.
    workers_comp: [
      "https://dir.nv.gov/WCS/Employers/",
      "https://www.leg.state.nv.us/NRS/NRS-616B.html",
      "https://www.leg.state.nv.us/NRS/NRS-616D.html",
    ],
    termination: [
      "https://www.leg.state.nv.us/nrs/nrs-608.html",
    ],
    nexus: [
      "https://doi.nv.gov/Licensing/License_Types/Producer/",
      "https://tax.nv.gov/manage-a-business/start-run-a-business/",
    ],
    hiring: [
      "https://detr.nv.gov/Page/New_Hire_Reporting_Info",
    ],
    remote: [
      "https://labor.nv.gov/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // Doctrine via the Labor Commissioner's official FAQ PDF (extracted —
    // 2026-07 PDF support; the Rules PDF lacked the doctrine statement) +
    // NRS 613 / NERC exceptions.
    at_will: [
      "https://labor.nv.gov/uploadedFiles/labornvgov/content/About/Frequently_Asked_Questions/Frequently%20Asked%20Questions.pdf",
      "https://www.leg.state.nv.us/nrs/nrs-613.html",
      "https://detr.nv.gov/Page/Equal_Rights_Commision",
    ],
    business_tax: [
      "https://tax.nv.gov/tax-types/modified-business-tax/",
      "https://tax.nv.gov/tax-types/commerce-tax/",
    ],
  },
  // own-threshold + program-state: NY sets regional minimum wage and its own regional exempt salary thresholds, and runs mandatory employer programs (DBL, PFL, paid sick leave, Secure Choice retirement mandate, state mini-WARN).
  NY: {
    wage_hour: [
      "https://dol.ny.gov/minimum-wage-0",
      "https://dol.ny.gov/wages-and-hours-frequently-asked-questions",
    ],
    leave: [
      "https://www.ny.gov/programs/new-york-paid-sick-leave",
      "https://paidfamilyleave.ny.gov/",
    ],
    payroll: [
      "https://dol.ny.gov/unemployment/unemployment-insurance-information-employers",
      "https://dol.ny.gov/nys-45-quarterly-reporting",
    ],
    workers_comp: [
      "https://www.wcb.ny.gov/content/main/coverage-requirements-wc/",
    ],
    termination: [
      "https://dol.ny.gov/wages-and-hours-frequently-asked-questions",
      "https://dol.ny.gov/worker-adjustment-and-retraining-notification-warn",
    ],
    nexus: [
      "https://www.dfs.ny.gov/apps_and_licensing/agents_and_brokers/home",
    ],
    hiring: [
      "https://www.tax.ny.gov/bus/wt/newhire.htm",
    ],
    remote: [
      "https://dol.ny.gov/labor-standards-0",
    ],
    salary_threshold: [
      "https://dol.ny.gov/minimum-wage-frequently-asked-questions",
    ],
    at_will: [
      "https://ag.ny.gov/resources/individuals/workers-rights/job-termination",
    ],
    business_tax: [
      "https://www.tax.ny.gov/bus/ct/ctidx.htm",
    ],
    state_programs: [
      "https://www.wcb.ny.gov/content/main/DisabilityBenefits/employer-disability-benefits.jsp",
      "https://paidfamilyleave.ny.gov/",
      "https://securechoice.ny.gov/",
    ],
  },
  // federal-default for exempt salary threshold; own constitutional minimum wage (indexed annually, revenue-tiered: smaller employers under the annual gross-receipts threshold pay federal minimum); monopolistic BWC state fund for workers' comp; CAT gross-receipts business tax; no state paid-leave program
  OH: {
    wage_hour: [
      "https://com.ohio.gov/divisions-and-programs/industrial-compliance/wage-and-hour/wage-and-hour",
      "https://com.ohio.gov/divisions-and-programs/industrial-compliance/wage-and-hour/guides-and-resources/ohio-minimum-wage-laws",
      "https://codes.ohio.gov/ohio-revised-code/section-4111.03",
    ],
    leave: [
      "https://com.ohio.gov/divisions-and-programs/industrial-compliance/wage-and-hour/wage-and-hour",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    // ORC 4141.20: quarterly reports due last day of first month after quarter; 0.25% forfeiture ($50 min/$1,000 max).
    payroll: [
      "https://codes.ohio.gov/ohio-revised-code/section-4141.20",
      "https://jfs.ohio.gov/unemployment-services/for-employers/register-as-an-employer",
    ],
    // ORC 4123.35 (every private employer pays into the state fund — OH is monopolistic) carries grounding; BWC page kept as user link.
    workers_comp: [
      "https://codes.ohio.gov/ohio-revised-code/section-4123.35",
      "https://info.bwc.ohio.gov/for-employers/workers-compensation-coverage/getting-coverage",
    ],
    termination: [
      "https://codes.ohio.gov/ohio-revised-code/section-4113.15",
      "https://jfs.ohio.gov/job-workforce-services/job-programs-and-services/submit-a-warn-notice",
    ],
    // ORC 3905.02 (license mandate) + 3905.06 (resident-producer qualifications) carry grounding; ODI page kept as user link.
    nexus: [
      "https://insurance.ohio.gov/agents-and-agencies/agent-licensing/agent-licensing",
      "https://codes.ohio.gov/ohio-revised-code/section-3905.02",
      "https://codes.ohio.gov/ohio-revised-code/section-3905.06",
    ],
    // ORC new-hire trio: 3121.891 mandate, 3121.893 the 20-day employer deadline + methods, 3121.8910 penalties ($25/$500).
    hiring: [
      "https://codes.ohio.gov/ohio-revised-code/section-3121.891",
      "https://codes.ohio.gov/ohio-revised-code/section-3121.893",
      "https://codes.ohio.gov/ohio-revised-code/section-3121.8910",
    ],
    remote: [
      "https://com.ohio.gov/divisions-and-programs/industrial-compliance/wage-and-hour/wage-and-hour",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // EXCEPTIONS ONLY — OH doctrine is common law; the only HTML statement is scoped to one college (rejected); LSC brief is PDF. May refuse.
    at_will: [
      "https://codes.ohio.gov/ohio-revised-code/section-4112.02",
      "https://www.ohioattorneygeneral.gov/FAQ/Civil-rights-FAQs",
    ],
    business_tax: [
      "https://tax.ohio.gov/business/commercial-activity-tax",
      "https://tax.ohio.gov/business",
    ],
  },
  // federal-default: minimum wage tied to federal $7.25 (state act covers employers with 10+ FTEs or >$100k gross), federal FLSA overtime/thresholds, no state leave or employer-mandate programs, franchise tax repealed 2024.
  OK: {
    wage_hour: [
      "https://oklahoma.gov/labor/workplace-rights/wage-hour.html",
      "https://oklahoma.gov/labor/workplace-rights/wage-hour/faqs---wage-and-hour.html",
    ],
    leave: [
      "https://oklahoma.gov/labor/workplace-rights.html",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://oklahoma.gov/oesc/employers/tax.html",
    ],
    workers_comp: [
      "https://oklahoma.gov/business/launch/filings-for-businesses-with-employees.html",
    ],
    termination: [
      "https://oklahoma.gov/labor/workplace-rights/wage-hour/faqs---wage-and-hour.html",
    ],
    nexus: [
      "https://www.oid.ok.gov/licensing-and-education/",
      "https://www.sos.ok.gov/business/default.aspx",
    ],
    hiring: [
      "https://oklahoma.gov/oesc/employers/new-hire-reporting.html",
    ],
    remote: [
      "https://oklahoma.gov/labor/workplace-rights.html",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // OSCN (official state courts network) opinion states doctrine + Burk public-policy framework; OAG OCRE exceptions.
    at_will: [
      "https://www.oscn.net/applications/oscn/DeliverDocument.asp?CiteID=15328",
      "https://oklahoma.gov/oag/about/divisions/civil-rights-enforcement.html",
      "https://oklahoma.gov/oag/about/divisions/civil-rights-enforcement/faqs.html",
    ],
    business_tax: [
      "https://oklahoma.gov/tax/helpcenter/businesses.html",
      "https://oklahoma.gov/tax/newsroom/2023/07-26-23.html",
    ],
  },
  // federal-default threshold + program-state: federal FLSA exempt threshold, but runs Paid Leave Oregon (payroll-funded PFML) and the OregonSaves retirement mandate; three-tier regional minimum wage.
  OR: {
    wage_hour: [
      "https://www.oregon.gov/boli/workers/pages/minimum-wage.aspx",
      "https://www.oregon.gov/boli/employers/pages/overtime.aspx",
    ],
    leave: [
      "https://www.oregon.gov/boli/workers/pages/sick-time.aspx",
      "https://paidleave.oregon.gov/employers/",
    ],
    payroll: [
      "https://www.oregon.gov/employ/businesses/pages/contributions.aspx",
    ],
    workers_comp: [
      "https://wcd.oregon.gov/employer/Pages/index.aspx",
    ],
    termination: [
      "https://www.oregon.gov/boli/workers/pages/paychecks.aspx",
      "https://www.oregon.gov/highered/about/workforce/pages/warn.aspx",
    ],
    nexus: [
      "https://dfr.oregon.gov/business/licensing/insurance/pages/producer-licensing.aspx",
      "https://sos.oregon.gov/business/Pages/register.aspx",
    ],
    hiring: [
      "https://www.doj.state.or.us/child-support/for-employers/report-new-hires/",
    ],
    remote: [
      "https://www.oregon.gov/boli/employers/pages/default.aspx",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // BOLI's own Employment-at-will page + BOLI discrimination page — the cleanest pair.
    at_will: [
      "https://www.oregon.gov/boli/employers/pages/employment-at-will.aspx",
      "https://www.oregon.gov/boli/workers/Pages/discrimination-at-work.aspx",
    ],
    business_tax: [
      "https://www.oregon.gov/dor/programs/businesses/pages/corp-requirements.aspx",
      "https://www.oregon.gov/dor/programs/businesses/pages/corporate-activity-tax.aspx",
    ],
    state_programs: [
      "https://paidleave.oregon.gov/employers/",
      "https://www.oregonsaves.com/employers",
    ],
  },
  // federal-default — $7.25 minimum wage and federal FLSA thresholds, but PMWA overtime exemptions are narrower than federal (no computer-professional or HCE exemption); no state leave mandate or employer-mandate programs.
  PA: {
    wage_hour: [
      "https://www.pa.gov/agencies/dli/resources/compliance-laws-and-regulations/labor-management-relations/pennsylvania-s-minimum-wage-act",
      "https://www.pa.gov/agencies/dli/resources/compliance-laws-and-regulations/labor-management-relations/labor-law/overtime-and-tipped-worker-rules-in-pa",
    ],
    leave: [
      "https://www.pa.gov/agencies/dli/programs-services/labor-management-relations/labor-law-compliance",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://www.pa.gov/agencies/dli/programs-services/unemployment/for-employers/uc-tax-payment",
    ],
    workers_comp: [
      "https://www.pa.gov/agencies/dli/resources/for-employers-and-educators/workers--compensation-for-employers/workers--compensation-compliance",
      "https://www.pa.gov/agencies/dli/resources/for-employers-and-educators/workers--compensation-for-employers/libc-200-employer-information",
    ],
    termination: [
      "https://www.pa.gov/agencies/dli/resources/compliance-laws-and-regulations/labor-management-relations/pennsylvania-s-minimum-wage-act/wage-faqs",
      "https://www.pa.gov/services/dli/file-a-wage-payment-and-collection-complaint",
      "https://www.pa.gov/agencies/dli/programs-services/workforce-development-home/warn-requirements",
    ],
    nexus: [
      "https://www.pa.gov/agencies/insurance/licensing/licensees",
      "https://business.pa.gov/register/",
    ],
    hiring: [
      "https://www.pa.gov/services/dli/report-newly-hired-employees",
      "https://business.pa.gov/operate/hiring-workers/new-hire-reporting-requirements/",
    ],
    remote: [
      "https://www.pa.gov/agencies/dli/programs-services/labor-management-relations/labor-law-compliance",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
      "https://www.pa.gov/agencies/dli/resources/compliance-laws-and-regulations/labor-management-relations/labor-law/overtime-and-tipped-worker-rules-in-pa",
    ],
    at_will: [
      "https://www.pa.gov/agencies/dli/resources/compliance-laws-and-regulations/labor-management-relations/pennsylvania-s-minimum-wage-act/wage-faqs",
    ],
    business_tax: [
      "https://www.pa.gov/agencies/revenue/resources/tax-types-and-information/corporation-taxes/corporate-net-income-tax",
    ],
  },
  // federal-default salary threshold, but a strong program-state: TDI/TCI employee-funded disability and caregiver insurance, paid sick leave mandate (18+ employees), and RISavers retirement mandate (5+ employees)
  RI: {
    wage_hour: [
      "https://dlt.ri.gov/regulation-and-safety/labor-standards/minimum-wage",
      "https://dlt.ri.gov/regulation-and-safety/labor-standards/labor-standards-faq",
    ],
    leave: [
      "https://dlt.ri.gov/regulation-and-safety/labor-standards/paid-sick-and-safe-leave",
      "https://dlt.ri.gov/individuals/temporary-disability-caregiver-insurance",
    ],
    payroll: [
      "https://dlt.ri.gov/employers/employer-tax-unit",
      "https://dlt.ri.gov/employers/employer-tax-unit/frequently-asked-employer-tax-questions",
    ],
    workers_comp: [
      "https://dlt.ri.gov/workers-compensation/employers",
      "https://dlt.ri.gov/workers-compensation/frequently-asked-questions",
    ],
    // RI Gen. Laws 28-14-4: next regular payday; 24 hours on liquidation/merger/relocation; vacation payout after one year.
    termination: [
      "https://webserver.rilegislature.gov/Statutes/TITLE28/28-14/28-14-4.htm",
      "https://dlt.ri.gov/regulation-and-safety/labor-standards/labor-standards-faq",
    ],
    nexus: [
      "https://dbr.ri.gov/insurance/insurance-professionals",
      "https://www.sos.ri.gov/divisions/business-services",
    ],
    hiring: [
      "https://ocss.ri.gov/employer-info/new-hire-reporting",
    ],
    remote: [
      "https://dlt.ri.gov/regulation-and-safety/labor-standards",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // EXCEPTIONS ONLY — no official RI page states the doctrine (rilegislature hits are unenacted bills). May refuse.
    at_will: [
      "https://dlt.ri.gov/regulation-and-safety/labor-standards/labor-standards-faq",
      "https://richr.ri.gov/about/index.php",
    ],
    business_tax: [
      "https://tax.ri.gov/tax-sections/corporate-tax",
    ],
    state_programs: [
      "https://dlt.ri.gov/individuals/temporary-disability-caregiver-insurance/employers",
      "https://risavers.gov/",
      "https://risavers.gov/employers/",
    ],
  },
  // federal-default — no state minimum wage, overtime, salary threshold, or leave/retirement mandates; 5% corporate income tax plus annual corporate license fee.
  SC: {
    wage_hour: [
      "https://llr.sc.gov/wage/faq.aspx",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://llr.sc.gov/wage/",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://dew.sc.gov/employers/unemployment-tax-information",
    ],
    workers_comp: [
      "https://wcc.sc.gov/employer-faqs",
    ],
    // SC Code 41-10-50 (full chapter HTML on scstatehouse.gov): within 48 hours or next regular payday not exceeding 30 days.
    termination: [
      "https://www.scstatehouse.gov/code/t41c010.php",
      "https://llr.sc.gov/wage/paymentofwages.aspx",
    ],
    nexus: [
      "https://doi.sc.gov/481/Producer",
    ],
    hiring: [
      "https://scbos.sc.gov/hiring-employees",
    ],
    remote: [
      "https://llr.sc.gov/wage/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://llr.sc.gov/wage/faq.aspx",
    ],
    business_tax: [
      "https://dor.sc.gov/business-income-taxes/corporate/c-corporation",
    ],
  },
  // federal-default with one own-threshold feature: state minimum wage (inflation-adjusted), no state overtime law, no leave programs, NO corporate income tax (transaction/excise-based revenue structure).
  SD: {
    wage_hour: [
      "https://dlr.sd.gov/employment_laws/minimum_wage.aspx",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://dlr.sd.gov/employment_laws/default.aspx",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://dlr.sd.gov/ra/businesses/default.aspx",
    ],
    workers_comp: [
      "https://dlr.sd.gov/workers_compensation/coverage.aspx",
    ],
    termination: [
      "https://dlr.sd.gov/employment_laws/termination.aspx",
    ],
    nexus: [
      "https://dlr.sd.gov/insurance/producers.aspx",
    ],
    hiring: [
      "https://dlr.sd.gov/ra/new_hire_reporting/reporting_requirements.aspx",
      "https://dlr.sd.gov/ra/new_hire_reporting/default.aspx",
    ],
    remote: [
      "https://dlr.sd.gov/employment_laws/default.aspx",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://dlr.sd.gov/employment_laws/termination.aspx",
    ],
    business_tax: [
      "https://dor.sd.gov/businesses/taxes/",
    ],
  },
  // federal-default — no state minimum wage, overtime law, or personal income tax; distinctive Franchise & Excise business tax structure; no state leave/disability/retirement mandate programs.
  TN: {
    wage_hour: [
      "https://www.tn.gov/workforce/employees/labor-laws.html",
      "https://www.tn.gov/workforce/employees/labor-laws/labor-laws-redirect/wages-breaks.html",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://www.tn.gov/workforce/employees/labor-laws.html",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://www.tn.gov/workforce/employers/tax-and-insurance-redirect/unemployment-insurance-tax.html",
    ],
    workers_comp: [
      "https://www.tn.gov/workforce/injuries-at-work/employers.html",
    ],
    termination: [
      "https://www.tn.gov/workforce/employees/labor-laws/labor-laws-redirect/wages-breaks.html",
    ],
    nexus: [
      "https://www.tn.gov/commerce/insurance/agent-producer-resources.html",
    ],
    hiring: [
      "https://www.tn.gov/workforce/employers/staffing-redirect/hiring-regulations/new-hire-reporting.html",
    ],
    remote: [
      "https://www.tn.gov/workforce/employees/labor-laws.html",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://www.tn.gov/workforce/employees/labor-laws/labor-laws-redirect/employee-rights.html",
    ],
    business_tax: [
      "https://www.tn.gov/revenue/taxes/franchise---excise-tax.html",
      "https://www.tn.gov/revenue/taxes/business-tax.html",
    ],
  },
  // federal-default with distinctive quirks: federal $7.25 minimum wage and federal FLSA thresholds, no state leave programs or employer-mandate programs, OPTIONAL workers' comp, no income tax (franchise/margin tax instead).
  TX: {
    // efte pages state the $7.25 rate and FLSA scope; www.twc is challenge-walled (kept as user-facing link).
    wage_hour: [
      "https://www.twc.texas.gov/programs/wage-and-hour/texas-minimum-wage-law",
      "https://efte.twc.texas.gov/priority_agreements_statutes.html",
      "https://efte.twc.texas.gov/flsa_does_and_doesnt_do.html",
    ],
    leave: [
      "https://www.twc.texas.gov/programs/wage-and-hour",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    // NOTE (2026-07 retry): www.twc.texas.gov serves a challenge page (202)
    // to the generator's fetch, so the statute site + the TWC employer
    // handbook subdomain (both probe-verified) carry the grounding.
    // statutes.capitol LA.201 removed (SPA shell). twc is challenge-walled — stays coming-soon until a fetchable source exists.
    payroll: [
      "https://www.twc.texas.gov/programs/unemployment-tax",
    ],
    workers_comp: [
      "https://www.tdi.texas.gov/wc/employer/index.html",
    ],
    // statutes.capitol.texas.gov REMOVED — the site now serves an Angular SPA shell (junk text) for /Docs paths.
    termination: [
      "https://www.twc.texas.gov/programs/wage-and-hour/texas-payday-law",
      "https://efte.twc.texas.gov/final_pay.html",
    ],
    nexus: [
      "https://www.tdi.texas.gov/agent/index.html",
      "https://www.sos.state.tx.us/corp/index.shtml",
    ],
    hiring: [
      "https://www.texasattorneygeneral.gov/child-support/employers/new-hire-reporting",
    ],
    remote: [
      "https://www.twc.texas.gov/programs/wage-and-hour",
      "https://efte.twc.texas.gov/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://efte.twc.texas.gov/wrongful_discharge.html",
    ],
    business_tax: [
      "https://comptroller.texas.gov/taxes/franchise/",
    ],
  },
  // program-state — own indexed minimum wage and state overtime act, federal salary threshold, mandatory RetirePath auto-IRA (5+ employees from Jul 2026), PFML launching 2028, new non-compete ban for all non-exempt employees.
  VA: {
    wage_hour: [
      "https://doli.virginia.gov/2025/07/29/virginia-minimum-wage-rate-increasing-effective-january-1-2026/",
      "https://doli.virginia.gov/programs/labor-law/virginia-labor-laws/",
      "https://doli.virginia.gov/virginia-overtime-wage-law/",
    ],
    leave: [
      "https://www.vec.virginia.gov/news/first-south-virginia-enacts-paid-family-medical-leave",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://www.vec.virginia.gov/employers/unemployment-insurance-information",
      "https://www.vec.virginia.gov/tax-filing-registration",
    ],
    workers_comp: [
      "https://workcomp.virginia.gov/content/employers",
    ],
    // Va. Code 40.1-29(B) on law.lis.virginia.gov: final wages due on or before the next scheduled payday.
    termination: [
      "https://law.lis.virginia.gov/vacode/title40.1/section40.1-29/",
      "https://doli.virginia.gov/labor-law-claim-for-unpaid-wages-form/",
    ],
    nexus: [
      "https://www.scc.virginia.gov/regulated-industries/bureau-of-insurance/",
      "https://www.scc.virginia.gov/regulated-industries/bureau-of-insurance/licensed-agent/applying-for-a-individual-va-insurance-license/",
    ],
    hiring: [
      "https://www.dss.virginia.gov/empowering-families/employer-resources/reporting-new-hires-in-virginia/",
    ],
    remote: [
      "https://doli.virginia.gov/programs/labor-law/virginia-labor-laws/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://doli.virginia.gov/programs/labor-law/virginia-labor-laws/",
    ],
    business_tax: [
      "https://www.tax.virginia.gov/corporation-income-tax",
    ],
    state_programs: [
      "https://law.lis.virginia.gov/vacodefull/title2.2/chapter27.1/",
      "https://www.vec.virginia.gov/news/first-south-virginia-enacts-paid-family-medical-leave",
    ],
  },
  // federal-default for salary threshold, but a program-state on leave/retirement: mandatory earned paid sick time, mandatory VT Saves auto-IRA (5+ employees), own mini-WARN, voluntary (not mandated) VT-FMLI paid leave insurance
  VT: {
    wage_hour: [
      "https://labor.vermont.gov/rights-and-wages/wage-and-hour",
    ],
    leave: [
      "https://labor.vermont.gov/sites/labor/files/doc_library/Earned%20Sick%20Time%20FAQ%20modified.pdf",
      "https://labor.vermont.gov/act-32-2025-vermonts-expanded-unpaid-family-parental-leave",
      "https://governor.vermont.gov/vtfmli",
    ],
    payroll: [
      "https://labor.vermont.gov/unemployment-insurance/ui-employers",
    ],
    // 21 V.S.A. 687 (secure-compensation mandate, personal liability of officers) + 692 (penalties) via the curl fallback; VT DOL employer fact-sheet PDF ('mandatory for all Vermont employers').
    workers_comp: [
      "https://legislature.vermont.gov/statutes/section/21/009/00687",
      "https://legislature.vermont.gov/statutes/section/21/009/00692",
      "https://labor.vermont.gov/sites/labor/files/doc_library/Fact%20Sheet%20For%20Employers.pdf",
    ],
    termination: [
      "https://legislature.vermont.gov/statutes/section/21/005/00342",
      "https://labor.vermont.gov/warn-act-and-notice-potential-layoffs-act",
    ],
    nexus: [
      "https://dfr.vermont.gov/insurance/producer-and-individual-licensing",
      "https://dfr.vermont.gov/industry/insurance/producer-and-individual-licensing/apply-and-renew-your-license/producer-license",
      "https://sos.vermont.gov/business-services/business-filings",
    ],
    hiring: [
      "https://labor.vermont.gov/unemployment-insurance/unemployment-information-employers/employer-online-services/new-hire",
    ],
    remote: [
      "https://labor.vermont.gov/rights-and-wages",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // EXCEPTIONS ONLY (21 V.S.A. 495 via the curl fallback — Node TLS fails on legislature.vermont.gov — plus VT HRC). May refuse.
    at_will: [
      "https://legislature.vermont.gov/statutes/section/21/005/00495",
      "https://hrc.vermont.gov/",
    ],
    business_tax: [
      "https://tax.vermont.gov/business/corporate-income-tax",
      "https://tax.vermont.gov/business/business-entity-income-tax",
    ],
    state_programs: [
      "https://vtsaves.vermont.gov/",
      "https://www.vermonttreasurer.gov/vermont-saves",
      "https://governor.vermont.gov/vtfmli",
    ],
  },
  // federal-default: WI minimum wage matches federal $7.25, follows federal FLSA salary thresholds, no state paid-leave/SDI/retirement-mandate programs; but has its own unpaid state FMLA, its own overtime law (DWD 274), and its own WARN-equivalent (Business Closing and Mass Layoff Law).
  WI: {
    wage_hour: [
      "https://dwd.wisconsin.gov/er/laborstandards/minimumwage.htm",
      "https://dwd.wisconsin.gov/er/laborstandards/overtime.htm",
    ],
    leave: [
      "https://dwd.wisconsin.gov/er/civilrights/fmla/",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://dwd.wisconsin.gov/uitax/",
      "https://dwd.wisconsin.gov/uitax/register-business.htm",
    ],
    workers_comp: [
      "https://dwd.wisconsin.gov/wc/employers/",
      "https://dwd.wisconsin.gov/dwd/publications/wc/wkc-13328-p.htm",
    ],
    termination: [
      "https://dwd.wisconsin.gov/er/laborstandards/wages.htm",
      "https://dwd.wisconsin.gov/dislocatedworker/employer/tools/notice/wbcml-overview.htm",
    ],
    nexus: [
      "https://oci.wi.gov/pages/agentshome.aspx",
      "https://oci.wi.gov/pages/agents/applyforalicense.aspx",
      "https://dfi.wi.gov/Pages/BusinessServices/BusinessEntities/FAQ.aspx",
    ],
    hiring: [
      "https://dwd.wisconsin.gov/uinh/",
    ],
    remote: [
      "https://dwd.wisconsin.gov/er/laborstandards/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    at_will: [
      "https://wilawlibrary.gov/jury/files/civil/2750.pdf",
    ],
    business_tax: [
      "https://www.revenue.wi.gov/Pages/FAQS/ise-crpginfo.aspx",
      "https://www.revenue.wi.gov/Pages/Businesses/home.aspx",
    ],
  },
  // federal-default with a quirk — state minimum wage ($8.75) applies only at locations with 6+ employees, overtime and salary threshold follow federal FLSA; no state employer-mandate programs.
  WV: {
    wage_hour: [
      "https://labor.wv.gov/wage-hour/jobs-act/minimum-wage",
      "https://labor.wv.gov/wage-hour-section",
    ],
    leave: [
      "https://labor.wv.gov/wage-hour-section",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://workforcewv.org/businesses/unemployment-tax-information/",
    ],
    workers_comp: [
      "https://www.wvinsurance.gov/Employer-Coverage",
    ],
    // W. Va. Code 21-5-4(b) on code.wvlegislature.gov: due on or before the next regular payday; liquidated damages.
    termination: [
      "https://code.wvlegislature.gov/21-5-4/",
      "https://labor.wv.gov/wage-hour/wage-payment-and-collection",
    ],
    nexus: [
      "https://www.wvinsurance.gov/Divisions_Licensing",
      "https://business4.wv.gov/startmybusiness/Pages/Employer-Responsibilities.aspx",
    ],
    hiring: [
      "https://business4.wv.gov/operatemybusiness/Pages/Managing-Employees.aspx",
      "https://bcse.wv.gov/bcse-employer-resource-center/wv-new-hire-reporting",
    ],
    remote: [
      "https://labor.wv.gov/wage-hour-section",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // at_will: intentionally unmapped (coming-soon) — No official WV state page states the at-will doctrine — coming-soon.
    business_tax: [
      "https://tax.wv.gov/business/corporateincometax/pages/corporateincometax.aspx",
    ],
  },
  // federal-default — WY state minimum wage is $5.15 but federal $7.25 FLSA governs most employers; no state overtime/salary threshold, no state paid-leave program, no corporate or personal income tax; monopolistic workers' comp state fund.
  WY: {
    wage_hour: [
      "https://dws.wyo.gov/dws-division/labor-standards/workers-and-job-seekers/your-rights-as-a-worker/",
      "https://dws.wyo.gov/dws-division/labor-standards/",
      "https://www.dol.gov/agencies/whd/fact-sheets/23-flsa-overtime-pay",
    ],
    leave: [
      "https://dws.wyo.gov/dws-division/labor-standards/",
      "https://www.dol.gov/agencies/whd/fmla",
    ],
    payroll: [
      "https://dws.wyo.gov/dws-division/unemployment-insurance/employers/",
      "https://dws.wyo.gov/dws-division/unemployment-insurance/employers/unemployment-tax-rates/",
    ],
    workers_comp: [
      "https://dws.wyo.gov/dws-division/workers-compensation/employers/",
      "https://dws.wyo.gov/dws-division/workers-compensation/employers/new-employers/",
      "https://dws.wyo.gov/dws-division/workers-compensation/employers/wage-reporting-and-coverage/",
    ],
    termination: [
      "https://dws.wyo.gov/dws-division/labor-standards/workers-and-job-seekers/your-rights-as-a-worker/",
    ],
    nexus: [
      "https://doi.wyo.gov/licensing/producers",
      "https://sos.wyo.gov/Business/",
    ],
    hiring: [
      "https://dws.wyo.gov/dws-division/unemployment-insurance/employers/wyoming-new-hire-reporting/",
      "https://childsupport.wyo.gov/employers/",
    ],
    remote: [
      "https://dws.wyo.gov/dws-division/labor-standards/",
    ],
    salary_threshold: [
      "https://www.dol.gov/agencies/whd/overtime",
      "https://www.ecfr.gov/current/title-29/subtitle-B/chapter-V/subchapter-A/part-541/subpart-G/section-541.600",
    ],
    // at_will: intentionally unmapped (coming-soon) — no clean official source — only state-employee personnel-manual PDFs mention at-will; no WY government page states the doctrine and its exceptions — coming-soon.
    business_tax: [
      "https://excise-tax-div.wyo.gov/",
      "https://revenue.wyo.gov/",
    ],
  },
};
