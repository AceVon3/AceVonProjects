// retirementMandates.ts
//
// Per-state EMPLOYER RETIREMENT-PLAN MANDATES (state auto-IRA / "Secure
// Choice" programs such as CalSavers, OregonSaves, Illinois Secure Choice).
// A growing set of states require employers above an employee-count line,
// without a qualified retirement plan of their own, to register with the
// state program and facilitate payroll deductions — with per-employee
// penalties for not doing so.
//
// Rendered on /compliance for the PRIMARY OFFICE STATE ONLY (product
// decision 2026-09-16, per Ryan): the mandate that reaches an agency is the
// one where its office sits. Employee work/live states are NOT consulted
// here — an out-of-state remote worker's own state mandate is a separate
// question the registration guide already hedges.
//
// Every figure is product copy verified against OFFICIAL sources (state
// treasurer / program sites, statutes, legislature bill records) in the
// 2026-09-16 harvest; `verified` carries the date. Where a program portal
// blocked automated fetches (403), the statute or treasurer page was used
// instead and the source list reflects that. Thresholds and penalty
// schedules change (several programs are still phasing in), so the UI
// always pairs these with the "confirm with a professional" hedge and never
// turns them into a per-reader determination.
//
// Statuses:
//   mandate-live      employers above the line must register today
//   mandate-pending   law enacted; registration not yet required (date given)
//   voluntary         state-run program exists, no employer mandate
//   none              no state program or mandate (searched, nothing found)
//
// Harvest findings worth knowing (2026-09-16):
//   - 15 live mandates: CA, CO, CT, DE, IL, MD, ME, MN, NJ, NV, NY, OR, RI, VA, VT
//   - 2 enacted, not yet live: HI (launch projected late Dec 2026),
//     WA (launch by July 1, 2027)
//   - 5 voluntary programs: MA (nonprofits), MO, MS (new 2026), NM (inactive),
//     UT (exchange, 2027)
//   - 29 none — several had bills die in 2025/2026 (AK vetoed June 2026;
//     MI SB 807 passed Senate June 2026, sitting in House; PA HB 1263 passed
//     House May 2025, sitting in Senate)
//   - Three states with NO dollar penalty despite a mandate: MD (fee-waiver
//     incentive only), NV (no penalty in NRS 353D), NY (none in GBL art. 43)

import type { StateCode } from "./resourceUrls";
import { STATES } from "./states";

export type MandateStatus =
  | "mandate-live"
  | "mandate-pending"
  | "voluntary"
  | "none";

export type RetirementMandateInfo = {
  status: MandateStatus;
  // Official program name, null when the state has none.
  program: string | null;
  // Employee-count line at which the mandate applies. 1 = reaches every
  // employer from the first employee. null = no mandate, or (WA) a
  // non-headcount test explained in `counting`.
  threshold: number | null;
  // How the state counts employees toward the line, when the source says.
  counting?: string;
  // Other gating conditions (in business N years, uses payroll software…).
  conditions?: string;
  // What exempts an employer — typically already sponsoring a qualified plan.
  exemption?: string;
  // Registration deadline(s), or that they have all passed.
  deadlines?: string;
  // Penalty schedule in plain words with the exact figures, or an explicit
  // "no penalty" statement.
  penalties?: string;
  // The plain-language one-liner the panel leads with.
  summary: string;
  // Official source pages (user-facing links).
  sources: string[];
  // Date the figures were verified against the sources (YYYY-MM-DD).
  verified: string;
  // Anything worth a caveat (recent change, pending rulemaking, an official
  // page that was unreachable).
  note?: string;
};

const V = "2026-09-16";

const QUALIFIED = "401(a), 401(k), 403(a), 403(b), 408(k) SEP, or 408(p) SIMPLE plan";

// Shared copy for states with no program and no mandate.
function none(state: string, detail: string, sources: string[], note?: string): RetirementMandateInfo {
  return {
    status: "none",
    program: null,
    threshold: null,
    penalties: "No penalty — there is no state program or mandate.",
    summary: `${state} has no state-run retirement savings program and no law requiring private employers to offer or facilitate a retirement plan. ${detail}`,
    sources,
    verified: V,
    ...(note ? { note } : {}),
  };
}

// Filled by the state retirement-mandate harvest (2026-09-16).
export const RETIREMENT_MANDATES: Partial<Record<StateCode, RetirementMandateInfo>> = {
  // --- Live mandates ---------------------------------------------------------
  CA: {
    status: "mandate-live",
    program: "CalSavers Retirement Savings Program",
    threshold: 1,
    counting: "an average of one or more California-based employees in the prior calendar year (at least one age 18+), assessed each spring from the four quarterly DE 9C filings",
    conditions: "Employers whose only workers are the owner(s) are not eligible employers.",
    exemption: `Employers that sponsor a qualified plan (${QUALIFIED}, or an automatic-enrollment payroll-deduction IRA) certify their exemption on the employer portal. Religious, tribal, and government employers are also exempt.`,
    deadlines: "All deadlines have passed. Phase-in ran 100+ employees (Sept 30, 2020), 50+ (June 30, 2021), 5+ (June 30, 2022), and 1+ employees (December 31, 2025). Newly mandated employers register by December 31 of the year they are notified.",
    penalties: "Gov. Code §100033(b): $250 per eligible employee if noncompliance continues 90 days or more after the notice, plus an additional $500 per eligible employee at 180 days or more (up to $750 per eligible employee), assessed by the Franchise Tax Board. No statutory cap.",
    summary: "California requires every employer with at least one employee that does not sponsor its own retirement plan to register with CalSavers and facilitate payroll-deduction Roth IRAs. The mandate reached its final tier on December 31, 2025, so every eligible employer is now past its deadline.",
    sources: [
      "https://www.treasurer.ca.gov/calsavers",
      "https://www.calsavers.com/home/frequently-asked-questions.html",
      "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=100033",
    ],
    verified: V,
  },
  CO: {
    status: "mandate-live",
    program: "Colorado SecureSavings",
    threshold: 5,
    conditions: "In business two or more years (measured from the earliest of the IRS SS-4 date, Secretary of State formation date, sales-tax license date, or start of Colorado wage-withholding liability).",
    exemption: `Employers that offer a qualified retirement plan (${QUALIFIED}) certify their exemption; employers with fewer than five employees or under two years in business are outside the mandate.`,
    deadlines: "All original wave deadlines have passed (program launched January 2023; phased registration ran through mid-2023). Newly eligible employers register or certify exemption on the schedule in their notice.",
    penalties: "C.R.S. §24-54.3-107 and program rules: $100 per employee per year, not to exceed $5,000 in a calendar year, assessed by the Colorado Department of Labor and Employment after three notices of non-compliance; fines start no earlier than 12 months after the enrollment date and three months after the first notice.",
    summary: "Colorado requires employers with five or more employees, in business two or more years, that do not offer a qualified retirement plan to register with Colorado SecureSavings or certify their exemption.",
    sources: [
      "https://treasury.colorado.gov/sites/treasury/files/CSSP_Fact%20Sheet_BizOutreach.pdf",
      "https://leg.colorado.gov/bills/sb20-200",
      "https://www.sos.state.co.us/CCR/Upload/NoticeOfRulemaking/ProposedRuleAttach2022-00286.doc",
    ],
    verified: V,
    note: "The program site (coloradosecuresavings.com) blocks automated checks; figures come from the Treasury fact sheet, the statute, and the program's rulemaking text.",
  },
  CT: {
    status: "mandate-live",
    program: "MyCTSavings (Connecticut Retirement Security Program)",
    threshold: 5,
    counting: "five or more individuals employed in Connecticut on October 1 of the preceding year, at least five of whom were paid $5,000 or more in taxable wages that year",
    conditions: "In existence throughout the current and preceding calendar year.",
    exemption: "Employers that maintain a retirement plan under IRC §219(g)(5) (a 401(k), SEP, SIMPLE, or similar plan) certify their exemption at myctsavings.com; the exemption lapses if no employee became newly eligible and no contributions were made in the prior year.",
    deadlines: "All original wave deadlines have passed (final wave March 30, 2023). Newly eligible employers are notified annually from the October 1 headcount.",
    penalties: "Public Act 25-30 (effective July 1, 2025): after at least two notices and a final notice, an employer still noncompliant 90 days after the final notice may be assessed a civil penalty each year of up to $500 (5–24 employees), $1,000 (25–99 employees), or $1,500 (100+ employees). The penalty is per employer per year, not per employee.",
    summary: "Connecticut requires employers with five or more employees (at least five paid $5,000+ in the prior year) that do not offer a retirement plan to register with MyCTSavings. Dollar penalties are new as of July 2025 and scale with employer size.",
    sources: [
      "https://osc.ct.gov/crsp/",
      "https://www.cga.ct.gov/2025/ACT/PA/PDF/2025PA-00030-R00SB-01221-PA.PDF",
      "https://www.cga.ct.gov/current/pub/chap_574.htm",
    ],
    verified: V,
  },
  DE: {
    status: "mandate-live",
    program: "Delaware EARNS (Expanding Access for Retirement and Necessary Saving)",
    threshold: 5,
    counting: "five or more W-2 employees in Delaware during the previous calendar year, full-time or part-time",
    conditions: "In business in Delaware at least six months in the preceding calendar year.",
    exemption: "Employers that maintain a specified tax-favored retirement plan (a qualified 401(k), SEP, SIMPLE, or similar plan) certify their exemption at EARNSDelaware.com.",
    deadlines: "Initial deadline October 15, 2024; a second-year deadline of October 15, 2025 applied to employers not yet registered. Both have passed.",
    penalties: "19 Del. C. ch. 38: an administrative penalty of up to $250 per employee per year, capped at $5,000 per year; enforcement cannot begin until one year after an employer's initial compliance date (the state indicated fines would begin in 2026).",
    summary: "Delaware requires employers with five or more Delaware employees, in business at least six months, that do not offer a qualified retirement plan to register with Delaware EARNS or certify their exemption.",
    sources: [
      "https://treasurer.delaware.gov/earns/",
      "https://delcode.delaware.gov/title19/c038/index.html",
      "https://news.delaware.gov/2025/10/01/october-15-deadline-approaching-for-employers-to-register-for-delaware-earns/",
    ],
    verified: V,
  },
  IL: {
    status: "mandate-live",
    program: "Illinois Secure Choice Savings Program",
    threshold: 5,
    counting: "the average number of employees with Illinois tax withheld across the four quarters of the tax year (IL-941 Schedule P data)",
    conditions: "In business two or more years.",
    exemption: "Employers that offer a qualified retirement plan report the exemption through the employer portal; an approved exemption counts as compliance.",
    deadlines: "All wave deadlines have passed (the final wave, employers with 5–15 employees, closed November 1, 2023). Newly eligible employers are notified by the program.",
    penalties: "820 ILCS 80/85, enforced by the Illinois Department of Revenue: $250 per employee for the first calendar year of noncompliance, then $500 per employee for each subsequent year (years need not be consecutive). A Notice of Proposed Assessment gives 120 days to register, certify exemption, or request a hearing; unpaid penalties can be collected by levy or lien. No statutory cap.",
    summary: "Illinois requires employers with five or more employees, in business two or more years, that do not offer a qualified retirement plan to register with Illinois Secure Choice. The Department of Revenue enforces the per-employee penalties.",
    sources: [
      "https://tax.illinois.gov/businesses/securechoiceprogramenforcement.html",
      "https://tax.illinois.gov/content/dam/soi/en/web/taxarchive/research/publications/bulletins/2023/FY2023-09_N0223.pdf",
    ],
    verified: V,
  },
  MD: {
    status: "mandate-live",
    program: "MarylandSaves",
    threshold: 1,
    counting: "any employer that pays employees through a payroll system or service — there is no employee-count line",
    conditions: "In business throughout the current and preceding calendar year.",
    exemption: "Employers that offer, or in the preceding two calendar years offered, an employer-sponsored retirement savings arrangement are outside the mandate and can certify that plan to claim the fee waiver.",
    deadlines: "No size-based schedule. To earn the following year's $300 SDAT annual-report fee waiver, an employer registers (or certifies another plan) by December 31 each year.",
    penalties: "No dollar penalty. The only statutory consequence of not participating is losing the waiver of Maryland's $300 annual business-report filing fee (Lab. & Empl. §12-402(b); Corps. & Ass'ns §1-203(b)).",
    summary: "Maryland's law directs every employer that runs payroll and does not offer its own retirement plan to set up MarylandSaves — but the law carries no fine. Participating (or having another plan) earns a waiver of the $300 annual SDAT report fee; not participating simply forfeits it.",
    sources: [
      "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gle&section=12-402&enactments=false",
      "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gle&section=12-101&enactments=false",
      "https://www.marylandsaves.org/marylandsaves-and-the-law/",
    ],
    verified: V,
  },
  ME: {
    status: "mandate-live",
    program: "MERIT (Maine Retirement Investment Trust)",
    threshold: 5,
    conditions: "In business during both the current and the preceding calendar year.",
    exemption: `Employers that offered a specified tax-favored retirement plan (${QUALIFIED}, or a 457(b)) at any time in the current or two preceding calendar years are outside the mandate. Government employers are excluded.`,
    deadlines: "Statutory deadline December 31, 2024 for covered employers; employers that newly met the criteria in 2025 had until June 30, 2025. Both have passed; later newly covered employers register per board rules.",
    penalties: "5 M.R.S. §173(4): for each covered employee not enrolled (or opted out) without reasonable cause, per calendar year — up to $20 per employee through June 30, 2026, up to $50 from July 1, 2026 through June 30, 2027, and up to $100 on or after July 1, 2027. Waived if the employer did not know and cures within 90 days; an employer is deemed to know after three program communications. Enforced by the Attorney General.",
    summary: "Maine requires employers with five or more Maine employees, in business two years, that do not offer a qualified retirement plan to register with MERIT. Per-employee penalties step up each July through 2027.",
    sources: [
      "https://legislature.maine.gov/statutes/5/title5sec173.html",
      "https://legislature.maine.gov/statutes/5/title5sec171.html",
      "https://www.maine.gov/treasurer/maine%20retirement%20savings%20board",
      "https://meritsaves.org/",
    ],
    verified: V,
    note: "A 2026 bill (LD 355) that would have lowered the line to three employees and delayed the penalty schedule was enacted only as a funding measure — the statutory threshold and penalty dates above remain as passed in 2023.",
  },
  MN: {
    status: "mandate-live",
    program: "Minnesota Secure Choice Retirement Program",
    threshold: 5,
    counting: "five or more covered employees (age 18+, excluding temporary or seasonal workers hired for 180 days or less); phase is based on the employee count as of January 2026",
    conditions: "Doing business in Minnesota during the preceding 12 months; government entities excluded.",
    exemption: "Employers that sponsor or contribute to a retirement savings plan (or did in the preceding 12 months) are outside the mandate and can file an exemption certification through the portal.",
    deadlines: "Program opened January 19, 2026. Registration deadlines are staggered by employee count, with every covered employer required to register by June 30, 2028 at the latest (larger employers earlier).",
    penalties: "Minn. Stat. §187.12: written warnings only for the first two years after an employer was first required to comply. From the second anniversary: $100 per covered employee (max $4,000); third anniversary $200 per employee (max $6,000); fourth anniversary $300 per employee (no cap); each later year $500 per employee (no cap). No penalty if cured within 30 days of the board's notice. Failure to remit withheld contributions draws separate $250-per-employee penalties and can be a misdemeanor.",
    summary: "Minnesota requires employers with five or more covered employees that do not sponsor a retirement plan to register with Minnesota Secure Choice on a size-staggered schedule running through June 30, 2028. Dollar penalties begin only two years after an employer's own compliance date.",
    sources: [
      "https://mn.gov/scrb/",
      "https://www.lcpr.mn.gov/SecureChoice.htm",
      "https://www.revisor.mn.gov/statutes/cite/187.12",
      "https://www.revisor.mn.gov/statutes/cite/187.03",
    ],
    verified: V,
    note: "The size-tier deadline dates are published only on the employer portal, which blocks automated checks — confirm the exact date for a given headcount at mn.gov/scrb.",
  },
  NJ: {
    status: "mandate-live",
    program: "RetireReady NJ (New Jersey Secure Choice Savings Program)",
    threshold: 10,
    counting: "at no time during the previous calendar year fewer than 10 employees in New Jersey (leased/PEO employees count for the client company)",
    conditions: "In business at least two years. Employers under 10 employees or under two years may join voluntarily.",
    exemption: `Employers that offered a qualified retirement plan (${QUALIFIED}, 457(b), or a PEO-sponsored plan) in the preceding two years are outside the mandate and certify their exemption with the access code in their notice.`,
    deadlines: "40+ employees: September 15, 2024 (passed). 25–39 employees: November 15, 2024 (passed). 20–24 employees: December 1, 2026. 10–19 employees: February 17, 2027.",
    penalties: "N.J.S.A. 43:23-31 (as amended 2026): first calendar year with a violation — a written warning; second year — a $100 fine; third and fourth years — $250 for each employee not enrolled; fifth and later years — $500 for each employee not enrolled. Failing to remit withheld contributions is $2,500 for a first offense and $5,000 thereafter. These are maximums the program may reduce; no aggregate cap.",
    summary: "New Jersey lowered its line from 25 to 10 employees effective April 1, 2026: employers with 10 or more New Jersey employees, in business two years, that do not offer a qualified retirement plan must facilitate RetireReady NJ. Employers with 10–24 employees have deadlines in December 2026 and February 2027.",
    sources: [
      "https://www.nj.gov/treasury/securechoiceprogram/employers/employer-program-details.shtml",
      "https://pub.njleg.state.nj.us/Bills/2024/PL25/379_.PDF",
      "https://nj.gov/treasury/securechoiceprogram/documents/pdf/EmployersFS.pdf",
    ],
    verified: V,
    note: "P.L. 2025, c. 379 (approved January 20, 2026) made the 25-to-10 change and rewrote the penalty section.",
  },
  NV: {
    status: "mandate-live",
    program: "Nevada Employee Savings Trust (NEST)",
    threshold: 6,
    counting: "more than five persons employed in Nevada (the statute does not specify a counting date or FTE method); covered employees are age 18+, employed 120+ days, with Nevada wages",
    conditions: "In business at least 36 months.",
    exemption: `Employers that maintained a tax-favored retirement plan (${QUALIFIED}) at any time in the current or three preceding calendar years are outside the mandate; a similar program through a chamber of commerce or trade association also satisfies it.`,
    deadlines: "A single deadline for all covered employers — register or certify exemption by September 1, 2025 — has passed. Contributions began July 1, 2025.",
    penalties: "None in statute. NRS chapter 353D and the enacting bill (SB 305, 2023) contain no fine or civil penalty for employer noncompliance, and the Treasurer's FAQ publishes none. The board may adopt compliance regulations.",
    summary: "Nevada requires employers with more than five Nevada employees, in business three years, that have not offered a retirement plan to participate in the Nevada Employee Savings Trust. The law sets no dollar penalty for employers that do not.",
    sources: [
      "https://www.nevadatreasurer.gov/FinancialSecurity/emp-savings/About/",
      "https://www.nevadatreasurer.gov/NEST/",
      "https://www.leg.state.nv.us/nrs/nrs-353d.html",
    ],
    verified: V,
  },
  NY: {
    status: "mandate-live",
    program: "New York State Secure Choice Savings Program",
    threshold: 10,
    counting: "at least 10 employees in New York at all times during the previous calendar year",
    conditions: "In business at least two years.",
    exemption: `Employers that offered a qualified retirement plan (${QUALIFIED}, or 457(b)) in the preceding two years are outside the mandate and certify their exemption.`,
    deadlines: "First-ever deadlines: 30+ employees March 18, 2026; 15–29 employees May 15, 2026; 10–14 employees July 15, 2026. All have passed.",
    penalties: "No penalty provision found. General Business Law article 43 (§§1300–1316) imposes no fine on employers that fail to register or enroll, and the program publishes no penalty schedule; the commissioner may issue regulations.",
    summary: "New York's Secure Choice program launched in October 2025 and required employers with 10 or more New York employees, in business two years, without a qualified plan to register on a size-staggered schedule that finished July 15, 2026. The statute currently sets no dollar penalty.",
    sources: [
      "https://securechoice.ny.gov/about.htm",
      "https://securechoice.ny.gov/pdf/06-12-2026/program-updates-06-12-2026.pdf",
      "https://www.nysenate.gov/legislation/laws/GBS/A43",
      "https://www.governor.ny.gov/news/governor-hochul-announces-launch-new-york-state-secure-choice-retirement-savings-program",
    ],
    verified: V,
    note: "New York City's separate 2021 law (5+ employees) was written to yield to a state mandate and has not been implemented.",
  },
  OR: {
    status: "mandate-live",
    program: "OregonSaves",
    threshold: 1,
    counting: "one or more employees in each of 18 separate weeks in a calendar year, or a quarterly payroll of $1,000 or more (OAR 170-080)",
    exemption: `Employers that offer a qualified retirement plan (${QUALIFIED}, 457(b), or similar) file a certificate of exemption through the program portal.`,
    deadlines: "All phased deadlines have passed — the final tier (1–2 employees) closed July 31, 2023. New employers register or certify exemption by July 31 of each year.",
    penalties: "ORS 178.250 makes noncompliance an unlawful practice; ORS 178.990 lets the Bureau of Labor and Industries assess up to $100 for each eligible employee, not to exceed $5,000 in a calendar year, after the board's compliance attempts.",
    summary: "Oregon requires every employer with at least one employee that does not offer a qualified retirement plan to facilitate OregonSaves. The program has been fully phased in since July 2023.",
    sources: [
      "https://www.oregonsaves.com/employers",
      "https://www.oregonlegislature.gov/bills_laws/ors/ors178.html",
      "https://secure.sos.state.or.us/oard/displayDivisionRules.action?selectedDivision=634",
    ],
    verified: V,
  },
  RI: {
    status: "mandate-live",
    program: "RISavers (Rhode Island Secure Choice Retirement Savings Program)",
    threshold: 5,
    counting: "five or more employees; eligible employees are age 18+ and employed at least 120 days",
    exemption: "Employers that provide a tax-qualified retirement savings program (401(k), 403(b), 457(b), SEP, SIMPLE, or an automatic-enrollment payroll-deduction IRA) are outside the mandate. Employers under five may join voluntarily.",
    deadlines: "Program launched October 21, 2025. Statutory compliance deadlines are staggered by size: more than 100 eligible employees October 15, 2026; 50–99 October 15, 2027; 5–49 October 15, 2028 (the Treasurer may extend).",
    penalties: "R.I. Gen. Laws §35-23-15: after a notice of noncompliance, an employer that without good cause fails to allow eligible employees to participate within 30 days of the penalty notice is subject to $250 per eligible employee. No escalation or cap appears in the statute.",
    summary: "Rhode Island requires employers with five or more employees that do not offer a qualifying retirement plan to facilitate RISavers, with compliance deadlines staggered by size from October 2026 through October 2028.",
    sources: [
      "https://treasury.ri.gov/press-releases/important-information-regarding-risavers-program",
      "https://webserver.rilegislature.gov/Statutes/TITLE35/35-23/35-23-15.htm",
      "https://webserver.rilegislature.gov/Statutes/TITLE35/35-23/35-23-2.htm",
    ],
    verified: V,
  },
  VA: {
    status: "mandate-live",
    program: "RetirePath Virginia",
    threshold: 5,
    counting: "five or more eligible employees (age 18+, currently employed, receiving wages — part-time workers count) for the period ending December 31 of the preceding year",
    conditions: "Program guidance also lists two or more years in operation.",
    exemption: `Employers that sponsor, maintain, or contribute to a qualified plan (${QUALIFIED}) are outside the mandate.`,
    deadlines: "Employers with 25+ employees have been covered since 2024 (deadlines passed). The July 1, 2026 expansion to 5+ employees brings deadlines in fall 2026 for newly covered employers, set in each employer's notice (program guidance: 10–24 employees September 30, 2026; 5–9 employees October 30, 2026).",
    penalties: "Va. Code §2.2-2747: the board may impose penalties not to exceed $200 per eligible employee annually.",
    summary: "Virginia lowered its line from 25 to 5 employees effective July 1, 2026: employers with five or more eligible employees (part-time included) that do not sponsor a qualified plan must register with RetirePath Virginia.",
    sources: [
      "https://law.lis.virginia.gov/vacode/title2.2/chapter27.1/section2.2-2744/",
      "https://law.lis.virginia.gov/vacode/title2.2/chapter27.1/section2.2-2747/",
      "https://www.retirepathva.com/",
    ],
    verified: V,
    note: "2026 Acts of Assembly cc. 84 and 85 made the change; the fall 2026 size-band deadlines come from the program's own guidance rather than the statute.",
  },

  VT: {
    status: "mandate-live",
    program: "Vermont Saves (VT Saves)",
    threshold: 2,
    counting: "two or more W-2 employees (lowered from five by Treasurer rule effective February 2026); covered employees are age 18+ with Vermont wages",
    conditions: "In business during both the current and the preceding calendar year.",
    exemption: `Employers that offer a qualified plan (${QUALIFIED}, or 457(b)) certify their exemption instead of registering.`,
    deadlines: "All deadlines have passed: 25+ employees July 1, 2025; 15–24 January 1, 2026; 5–14 July 1, 2026; newly eligible 2–4 employee firms June 30, 2026.",
    penalties: "3 V.S.A. §535: per covered employee not enrolled or opted out, per calendar year, without reasonable cause — up to $20 through September 30, 2026, then up to $75 on or after October 1, 2026. Waivable where the employer did not know and exercised reasonable diligence, or cures within 90 days. Paying a penalty does not satisfy the obligation to comply.",
    summary: "Vermont requires employers with two or more W-2 employees, in business two years, that do not offer a qualified plan to register with Vermont Saves — the line dropped from five to two in February 2026, and the per-employee penalty rises to $75 on October 1, 2026.",
    sources: [
      "https://www.vermonttreasurer.gov/economic-empowerment-division/vermont-saves",
      "https://legislature.vermont.gov/statutes/fullchapter/03/018",
    ],
    verified: V,
  },

  // --- Enacted, not yet in effect --------------------------------------------
  HI: {
    status: "mandate-pending",
    program: "Hawaiʻi Retirement Savings Program",
    threshold: 1,
    counting: "one or more individuals in employment in Hawaii; covered employees are Hawaii residents age 18+ with taxable wages",
    exemption: `Employers that offered or maintained a qualified plan (${QUALIFIED}) within the preceding two years are exempt.`,
    deadlines: "None yet. Employer duties begin on a date set by the board; the Department of Labor projects a launch in late December 2026, with no size-based phase-in in the statute.",
    penalties: "HRS §389-14: $25 for each month a covered employee is not enrolled, rising to $50 per month after a penalty is assessed; other violations at least $500 each, with penalties capped at $5,000 per calendar year. Waivable if the employer exercised reasonable diligence and cures within 90 days of notice.",
    summary: "Hawaii's program was converted from opt-in to a mandatory automatic-enrollment program in 2025 (Act 113) for every employer with at least one employee and no qualified plan. It is not live yet — launch is projected for late December 2026.",
    sources: [
      "https://labor.hawaii.gov/hrsp/",
      "https://labor.hawaii.gov/hrsp/frequently-asked-questions/",
      "https://data.capitol.hawaii.gov/hrscurrent/Vol07_Ch0346-0398/HRS0389/HRS_0389-0014.htm",
    ],
    verified: V,
  },
  WA: {
    status: "mandate-pending",
    program: "Washington Saves",
    threshold: null,
    counting: "an hours test, not a headcount — employees working a combined 10,400 hours or more in the preceding calendar year (roughly five full-time employees); covered employees are age 18+",
    conditions: "In business in Washington at least two years with a physical presence.",
    exemption: `Employers that offer a qualified plan (${QUALIFIED}) to covered employees with one year or more of continuous employment are outside the mandate.`,
    deadlines: "None yet. RCW 19.05.040 requires the program to launch by July 1, 2027, with implementation allowed to stagger by employer size after that; L&I plans employer education in early 2027.",
    penalties: "RCW 19.05.070: no civil penalties before January 1, 2030 — L&I offers technical assistance and 90 days to remedy after an educational letter. For violations after January 1, 2030: up to $100 for a first willful violation, $250 for a second, $500 for each subsequent willful violation.",
    summary: "Washington Saves is enacted but not live: employers whose staff worked 10,400+ combined hours last year (about five full-time employees), in business two years, without a qualified plan will need to participate once the program launches by July 1, 2027. No penalties apply before 2030.",
    sources: [
      "https://lni.wa.gov/workers-rights/workplace-policies/washington-saves-retirement-program",
      "https://app.leg.wa.gov/RCW/default.aspx?cite=19.05.010",
      "https://app.leg.wa.gov/RCW/default.aspx?cite=19.05.070",
      "https://www.wasaves.com/employers",
    ],
    verified: V,
  },

  // --- Voluntary state programs (no mandate) ---------------------------------
  MA: {
    status: "voluntary",
    program: "Massachusetts CORE Plan",
    threshold: null,
    conditions: "A voluntary state-sponsored 401(k) multiple-employer plan open only to nonprofit employers with 100 or fewer employees (raised from 20 by St. 2025, c. 9, effective July 1, 2025). For-profit employers are not eligible.",
    penalties: "No penalty — participation is elective and Massachusetts has no auto-IRA mandate.",
    summary: "Massachusetts has no employer retirement mandate. Its CORE Plan is a voluntary 401(k) for small nonprofits only; a for-profit insurance agency has no state retirement-plan obligation.",
    sources: [
      "https://malegislature.gov/Laws/GeneralLaws/PartI/TitleIII/Chapter29/Section64E",
    ],
    verified: V,
  },
  MO: {
    status: "voluntary",
    program: "Show-Me MyRetirement Savings Plan",
    threshold: null,
    conditions: "A voluntary multiple-employer 401(k) for Missouri employers with 50 or fewer employees and the self-employed (RSMo §§285.1000–285.1055).",
    penalties: "No penalty — participation is voluntary.",
    summary: "Missouri has no employer retirement mandate. The Show-Me MyRetirement Savings Plan is an optional state-facilitated 401(k) for employers with 50 or fewer employees.",
    sources: [
      "https://revisor.mo.gov/main/OneSection.aspx?section=285.1000",
      "https://revisor.mo.gov/main/OneSection.aspx?section=285.1015",
      "https://treasurer.mo.gov/",
    ],
    verified: V,
    note: "Launch status of the plan could not be confirmed on an official Treasurer page; the statute is verified.",
  },
  MS: {
    status: "voluntary",
    program: "Mississippi Work and Save Program",
    threshold: null,
    conditions: "Created by HB 4073 (approved April 8, 2026, effective July 1, 2026): a voluntary payroll-deduction Roth IRA program administered by the State Treasurer, to be operational by August 1, 2028. Employer participation is optional.",
    penalties: "No penalty — the act imposes no employer obligation and protects participating employers from liability.",
    summary: "Mississippi enacted a voluntary Work and Save program in 2026 with no employer mandate; the program is not yet operating (contributions must be possible by August 1, 2028).",
    sources: [
      "https://billstatus.ls.state.ms.us/documents/2026/html/HB/4000-4099/HB4073SG.htm",
      "https://treasury.ms.gov/",
    ],
    verified: V,
  },
  NM: {
    status: "voluntary",
    program: "New Mexico Work and $ave",
    threshold: null,
    conditions: "Designed as voluntary for both employers and employees; the State Treasurer lists the program as inactive as of 2025 (archived page).",
    penalties: "No penalty — participation was voluntary and the program is inactive.",
    summary: "New Mexico has no employer retirement mandate. Its voluntary Work and $ave program never launched and is marked inactive by the State Treasurer; bills to make it mandatory did not advance.",
    sources: [
      "https://www.nmsto.gov/work-and-save",
      "https://www.nmlegis.gov/Sessions/21%20Regular/bills/senate/SB0129.html",
    ],
    verified: V,
  },
  UT: {
    status: "voluntary",
    program: "Utah Retirement Plan Exchange",
    threshold: null,
    conditions: "HB 250 (2026, effective May 6, 2026) directs the Treasurer to run an online exchange where employers with one or more employees may compare and select private retirement plans; the exchange must operate by January 1, 2027. Participation is optional.",
    penalties: "No employer penalty — the only enforcement is removal of a plan provider from the exchange.",
    summary: "Utah has no employer retirement mandate. A new voluntary plan exchange (a comparison marketplace, not a state plan) opens by January 1, 2027.",
    sources: [
      "https://le.utah.gov/Session/2026/bills/enrolled/HB0250.pdf",
      "https://governor.utah.gov/press/gov-cox-signs-47-bills-in-the-2026-general-legislative-session/",
    ],
    verified: V,
  },

  // --- No program, no mandate ------------------------------------------------
  AL: none("Alabama",
    "Bills for a voluntary Alabama Retirement Savings Program (SB 173 in 2025, SB 135 in 2026) did not pass.",
    ["https://alison.legislature.state.al.us/files/pdf/SearchableInstruments/2026RS/SB135-int.pdf"]),
  AK: none("Alaska",
    "SB 21 (Alaska Work and Save, 5+ employees) passed the legislature in May 2026 but was vetoed on June 18, 2026; the override vote fell one short.",
    ["https://www.akleg.gov/basis/Bill/Detail/34?Root=SB21"],
    "Watch item: the bill had majority support and may return in 2027."),
  AZ: none("Arizona",
    "HB 4126 (2026) would have created a mandate phasing in from 2028 with $10–$100 per-employee penalties; it died in House Ways & Means.",
    ["https://www.azleg.gov/legtext/57leg/2R/bills/HB4126P.pdf"]),
  AR: none("Arkansas",
    "HB 1335 (2025, Every Arkansan Retirement Plan Opportunity Act) died in committee at sine die adjournment on May 5, 2025.",
    ["https://arkleg.state.ar.us/Bills/Detail?id=HB1335&ddBienniumSession=2025%2F2025R"]),
  FL: none("Florida",
    "The only 2026 bill (SB 930, a study task force) died in committee on March 13, 2026.",
    ["https://www.flsenate.gov/Session/Bill/2026/930"]),
  GA: none("Georgia",
    "SB 226 (Peach State Saves, 5+ employees, $250/$500 penalties) was voted down in the Senate Retirement Committee in February 2025 and did not advance in 2026.",
    ["https://www.legis.ga.gov/api/document/docs/default-source/senate-calendars/20252026/scomposite788080b4702048e088a9bb803b278911.pdf?sfvrsn=b3a0c845_36"]),
  ID: none("Idaho",
    "No auto-IRA or work-and-save bill was filed in the 2025 or 2026 sessions.",
    ["https://legislature.idaho.gov/sessioninfo/2026/legislation/"]),
  IN: none("Indiana",
    "SB 513 (2025, 5+ employee auto-IRA) was never heard in Senate Appropriations; nothing was filed in 2026.",
    ["https://iga.in.gov/legislative/2026/bills"]),
  IA: none("Iowa",
    "SF 185 (2025, retirement savings plan trust) was assigned to a subcommittee in February 2025 and has had no further action.",
    ["https://www.legis.iowa.gov/legislation/billTracking/billHistory?billName=SF185&ga=91"]),
  KS: none("Kansas",
    "HB 2649 (Kansas Empowerment Savings Program) had a hearing in March 2026 and died in committee; earlier Work and Save bills (2021, 2022) also failed.",
    ["https://kslegislature.gov/b2025_26/bills/hb2649/"]),
  KY: none("Kentucky",
    "No auto-IRA, secure choice, or work-and-save bill appears in the 2024, 2025, or 2026 Regular Session records.",
    ["https://apps.legislature.ky.gov/record/26rs/house_bills_title.html"]),
  LA: none("Louisiana",
    "The last Secure Choice bill (SB 53 of 2016) died in committee; nothing was filed in 2025 or 2026.",
    ["https://legis.la.gov/legis/BillInfo.aspx?i=228896"]),
  MI: none("Michigan",
    "SB 807 (Michigan Secure Retirement Savings Program) passed the Senate 20–18 on June 17, 2026 and sits in the House Committee on Economic Competitiveness — not law.",
    ["https://www.legislature.mi.gov/Bills/Bill?ObjectName=2026-SB-0807"],
    "Watch item: a live bill has cleared one chamber."),
  MT: none("Montana",
    "SB 233 (2019) died in committee; no codified program and no 2025 bill.",
    ["https://archive.legmt.gov/bills/2019/BillHtml/SB0233.htm"]),
  NE: none("Nebraska",
    "Only public-employee retirement bills were found in the 2025–2026 Legislature.",
    ["https://nebraskalegislature.gov/bills/view_bill.php?DocumentID=62672"]),
  NH: none("New Hampshire",
    "2025–2026 General Court retirement bills concern the public-employee retirement system only.",
    ["https://gc.nh.gov/"]),
  NC: none("North Carolina",
    "H79 (North Carolina Work and Save, 2025) was reported favorably in June 2025 and re-referred to the House Insurance Committee; no floor vote.",
    ["https://www.ncleg.gov/BillLookUp/2025/H79"]),
  ND: none("North Dakota",
    "2025 retirement legislation (HB 1602) covered new state employees only.",
    ["https://ndlegis.gov/"]),
  OH: none("Ohio",
    "Prior bills (SB 199 of 2013, HB 416 of 2021–2022) did not pass; nothing was filed in the 136th General Assembly.",
    ["https://www.legislature.ohio.gov/"]),
  OK: none("Oklahoma",
    "The Oklahoma Prosperity Act (SB 527) passed the Senate in 2022 but was never enacted; no 2025–2026 bill revived it.",
    ["https://www.oklegislature.gov/"]),
  PA: none("Pennsylvania",
    "Keystone Saves (HB 1263) passed the House 102–101 on May 13, 2025 and has sat in Senate Finance since; companion SB 1069 likewise. Not law.",
    ["https://www.palegis.us/legislation/bills/2025/hb1263", "https://www.palegis.us/legislation/bills/2025/sb1069"],
    "Watch item: the session ends November 30, 2026."),
  SC: none("South Carolina",
    "H 5019 (2024) died in Ways and Means; no 2025–2026 bill was filed.",
    ["https://www.scstatehouse.gov/sess125_2023-2024/bills/5019.htm"]),
  SD: none("South Dakota",
    "No private-sector auto-IRA bill surfaced for 2025 or 2026.",
    ["https://sdlegislature.gov/"]),
  TN: none("Tennessee",
    "SB 2397 (2026) was filed as an auto-IRA bill but was amended into an unrelated custodial-account measure before passage (Public Chapter 910).",
    ["https://wapp.capitol.tn.gov/apps/BillInfo/Default.aspx?BillNumber=SB2397&GA=114"]),
  TX: none("Texas",
    "The last attempt (HB 2996, 2021) was left pending in committee; no 2025 bill was found.",
    ["https://capitol.texas.gov/BillLookup/History.aspx?LegSess=87R&Bill=HB2996"]),
  WV: none("West Virginia",
    "HB 5150 (West Virginia Secure Choice, 2026) was referred to House Finance and died at adjournment; 2024 and 2025 versions also failed.",
    ["https://www.wvlegislature.gov/Bill_Status/bills_history.cfm?INPUT=5150&year=2026&sessiontype=RS"]),
  WI: none("Wisconsin",
    "WisEARNS bills (AB 1179 / SB 1137) were introduced on the last day of the 2026 session and failed to pass.",
    ["https://docs.legis.wisconsin.gov/2025/proposals/reg/asm/bill/ab1179"]),
  WY: none("Wyoming",
    "SF 41 (2026) created optional portable benefit accounts for independent contractors only — no employer mandate.",
    ["https://www.wyoleg.gov/Legislation/2026/SF0041"]),
};

export function retirementMandateInfo(state: string): RetirementMandateInfo | null {
  return RETIREMENT_MANDATES[state as StateCode] ?? null;
}

export const MANDATE_STATUS_LABEL: Record<MandateStatus, string> = {
  "mandate-live": "Employer mandate in effect",
  "mandate-pending": "Mandate enacted — not yet in effect",
  voluntary: "Voluntary program — no mandate",
  none: "No state retirement mandate",
};

function emp(n: number): string {
  return `${n} ${n === 1 ? "employee" : "employees"}`;
}

// The "applies at T+; you have N — where you sit" line. Same discipline as the
// briefing size gates: states the line, the agent's number, the neutral
// above/below comparison, and defers the conclusion. NEVER "this applies to
// you" / "you are exempt". Returns null when the state has no headcount line.
//
// `multiOffice`: the agency has offices in more than one state, so the
// profile's total headcount is split across states — the line says so and
// points at the in-state count as the one that matters.
export function retirementSizeLine(state: string, n: number, multiOffice = false): string | null {
  const info = retirementMandateInfo(state);
  if (!info || info.threshold === null) return null;
  if (info.status !== "mandate-live" && info.status !== "mandate-pending") return null;
  const t = info.threshold;
  const where = n >= t ? "at or above" : "below";
  const lineText = t === 1
    ? `${info.program} reaches employers from the first employee`
    : `${info.program} registration applies at ${t}+ employees`;
  const tense = info.status === "mandate-pending" ? " once the program launches" : "";
  const you = multiOffice
    ? `You have ${emp(n)} across your offices — ${where} the ${t}-employee line on the total; the count that matters is staff working in ${stateNameOf(state)}, so verify against that number.`
    : `You have ${emp(n)} — ${where} the ${t}-employee line. Counting rules vary — verify your obligation.`;
  return `${lineText}${tense} (for employers without a qualified retirement plan of their own). ${you}`;
}

// Local name lookup (avoids importing briefing.ts, which imports this module's
// consumers) — STATES is the canonical list.
const NAME = new Map<string, string>(STATES.map(s => [s.code, s.name]));
function stateNameOf(code: string): string {
  return NAME.get(code) ?? code;
}
