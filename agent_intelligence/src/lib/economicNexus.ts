// economicNexus.ts
//
// Per-state INCOME/FRANCHISE/GROSS-RECEIPTS tax economic-nexus thresholds
// for an out-of-state SERVICE business (insurance-agency commission income),
// shown in profile setup as each licensed/selling state is selected.
//
// NOT sales-tax (Wayfair) thresholds. "Filing obligation" thresholds â€” where
// a state distinguishes a nexus line from a no-tax-due floor (TX), the note
// carries the nuance. Figures are product copy verified against official
// sources (2026-07 harvest) â€” several are INDEXED ANNUALLY; the UI always
// pairs them with the confirm-with-a-professional hedge. Source links are
// user-facing browser links (official government domains).

import type { StateCode } from "./resourceUrls";

export type NexusBasis =
  | "factor-presence"   // bright-line receipts threshold for income-tax nexus
  | "gross-receipts"    // gross-receipts-style business tax with its own line
  | "doing-business"    // no bright line â€” facts-and-circumstances standard
  | "no-income-tax";    // no entity-level income/gross-receipts tax reaches
                        // an out-of-state service business

export type NexusInfo = {
  basis: NexusBasis;
  // Bright-line receipts figure in USD, null when no bright line exists.
  threshold_usd: number | null;
  // True when the figure is indexed/adjusted annually (CA, NY, AL...).
  indexed: boolean;
  // One plain sentence a small-agency owner understands.
  label: string;
  // Official source page (user-facing link).
  source: string;
  note?: string;
};

// Filled by the economic-nexus harvest (assembled 2026-07).
export const ECONOMIC_NEXUS: Partial<Record<StateCode, NexusInfo>> = {
  AK: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Alaska has a corporate net income tax and asserts nexus over businesses deriving income from Alaska sources under a doing-business standard, at any level.",
    source: "https://tax.alaska.gov/programs/programs/index.aspx?60000",
    note: "Corporate income tax (AS 43.20) applies to C corporations; Alaska has no personal income tax, so pass-through income flowing to individual owners is generally not taxed at the state level.",
  },
  AL: {
    basis: "factor-presence",
    threshold_usd: 538000,
    indexed: true,
    label: "Income-tax nexus at $538,000+ of Alabama-sourced sales (factor presence; figure is CPI-indexed), or $54,000 of in-state property or payroll.",
    source: "https://www.revenue.alabama.gov/individual-corporate/nexus/",
    note: "Ala. Code 40-18-31.2; thresholds adjust when cumulative CPI change reaches 5%, rounded to nearest $1,000 â€” current sales figure $538,000. Distinct from Alabama's $250,000 sales-tax threshold.",
  },
  AR: {
    basis: "factor-presence",
    threshold_usd: 250000,
    indexed: false,
    label: "Income-tax nexus at $250,000+ of Arkansas-sourced receipts for out-of-state businesses with no physical presence (bright-line effective for tax years beginning on or after January 1, 2026).",
    source: "https://arkleg.state.ar.us/Home/FTPDocument?path=/Bills/2025R/Public/SB567.pdf",
    note: "SB 567 (2025) also adopted market-based sourcing for services, so commission income from Arkansas customers is sourced to Arkansas. For tax years before 2026, nexus was a facts-and-circumstances doing-business standard with no dollar threshold.",
  },
  AZ: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Arizona corporate income tax nexus rests on a doing-business standard (regular, systematic, or substantial activity directed at Arizona); income derived from the state can be taxable at any level.",
    source: "https://azdor.gov/taxpayer-education/nexus-program/nexus-program-corporate-income-tax",
    note: "The published $100,000 Arizona threshold is Transaction Privilege (sales) Tax only â€” it does not apply to income tax.",
  },
  CA: {
    basis: "factor-presence",
    threshold_usd: 757070,
    indexed: true,
    label: "'Doing business' (income/franchise tax) at California sales above $757,070 for the 2025 tax year â€” the figure is indexed annually â€” or 25% of total sales, or $75,707 of in-state property or payroll.",
    source: "https://www.ftb.ca.gov/file/business/doing-business-in-california.html",
    note: "R&TC 23101(b). FTB page is bot-blocked (HTTP 403); figures verified via search snippets of the FTB page and practitioner alerts. Caution: California's Office of Tax Appeals has ruled the thresholds are NOT a safe harbor â€” 23101(a) ('any transaction for pecuniary gain') can create nexus below them.",
  },
  CO: {
    basis: "factor-presence",
    threshold_usd: 500000,
    indexed: false,
    label: "Income-tax nexus at $500,000+ of Colorado-sourced receipts (factor presence), or $50,000 of in-state property or payroll.",
    source: "https://tax.colorado.gov/corporate-income-tax-guide",
    note: "Rule 39-22-301(1); sales of services count toward the $500,000 when the purchaser's primary use is in Colorado. No physical presence required.",
  },
  CT: {
    basis: "factor-presence",
    threshold_usd: 500000,
    indexed: false,
    label: "Income-tax (corporation business tax) nexus at $500,000+ of Connecticut-sourced receipts â€” a bright-line economic nexus standard requiring no physical presence.",
    source: "https://portal.ct.gov/drs/publications/informational-publications/2010/ip-2010291-q--a-on-economic-nexus",
    note: "IP 2010(29.1). The $500,000 bright line applies to companies whose only Connecticut contact is economic; DRS can still assert nexus below it where other connections exist. Pass-through entities are subject to the same economic-nexus standard.",
  },
  DE: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Delaware corporate income tax nexus rests on a doing-business / Delaware-source-income standard evaluated case by case (the Division of Revenue uses a nexus questionnaire).",
    source: "https://revenue.delaware.gov/frequently-asked-questions/corporate-income-tax-faqs/",
    note: "Delaware also has a gross receipts tax, but it reaches goods sold or services performed within Delaware â€” a purely out-of-state service business with no in-state activity generally is not subject to it.",
  },
  FL: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Florida has a corporate income tax, and nexus rests on conducting business or activity in Florida (facts and circumstances), not on a dollar amount of sales.",
    source: "https://floridarevenue.com/taxes/businesses/Pages/outstate.aspx",
    note: "Florida has no personal income tax, but C corporations (and LLCs taxed as corporations) with Florida activity owe the 5.5% corporate income tax â€” do not lump Florida with the true no-income-tax states.",
  },
  GA: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Georgia taxes corporations that do business in Georgia or receive income from Georgia sources; nexus is facts-and-circumstances and income derived from the state can be taxable at any level.",
    source: "https://dor.georgia.gov/c-corporations-faq",
    note: "Corporations doing business in Georgia also owe the separate net worth tax; P.L. 86-272 does not shield services.",
  },
  HI: {
    basis: "factor-presence",
    threshold_usd: 100000,
    indexed: false,
    label: "Income-tax nexus presumed at $100,000+ of Hawaii-sourced gross income OR 200+ transactions with Hawaii customers in the current or preceding year (no physical presence needed).",
    source: "https://files.hawaii.gov/tax/legal/tir/tir20-05.pdf",
    note: "HRS 235-4.2 (Act 221 of 2019), effective for tax years beginning after 12/31/2019. Same numbers as many states' sales-tax rules, but this one genuinely applies to Hawaii's net income tax.",
  },
  IA: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Iowa asserts income-tax nexus on economic presence alone (upheld in KFC Corp. v. Iowa Dept. of Revenue, 2010); income derived from Iowa sources can be taxable at any level.",
    source: "https://www.legis.iowa.gov/docs/publications/LG/24337.pdf",
    note: "Iowa Supreme Court held physical presence is not required for income tax; the U.S. Supreme Court declined review. Iowa's $100,000 threshold is sales tax only.",
  },
  ID: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Idaho income/franchise tax nexus rests on a transacting-business standard that includes having any Idaho activity from which you derive income.",
    source: "https://tax.idaho.gov/taxes/income-tax/business-income/guides-for-certain-businesses/income-tax-for-corporations/",
    note: "Idaho's $100,000 threshold is sales tax only. Corporate filers owe the greater of 5.3% of Idaho taxable income or a $20 minimum.",
  },
  IL: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Illinois income tax nexus is extremely fact-specific, resting on a 'significant economic presence' / doing-business standard; the Department will not even issue rulings on nexus.",
    source: "https://tax.illinois.gov/content/dam/soi/en/web/tax/research/legalinformation/letterrulings/it/documents/2022/it22-0009-gil.pdf",
    note: "86 Ill. Adm. Code 100.9720; Illinois' $100,000 threshold is sales/use tax only.",
  },
  IN: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” since 2019 Indiana taxes income derived from Indiana 'to the fullest extent permitted by the Constitution,' regardless of physical presence, so any Indiana-sourced service income can create a filing obligation.",
    source: "https://www.in.gov/dor/i-am-a/business-corp/",
    note: "IC 6-3-2-2; one of the broadest economic-nexus assertions in the country. Indiana's $100,000 threshold is sales tax only.",
  },
  KS: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Kansas corporate income tax applies to every corporation doing business in Kansas or deriving income from Kansas sources, at any level.",
    source: "https://www.ksrevenue.gov/bustaxtypescorp.html",
    note: "Kansas' $100,000 threshold is sales tax only.",
  },
  KY: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Kentucky's own FAQ says the sales-tax minimums do NOT apply to income tax: any amount of Kentucky sales, property, or payroll triggers a corporation income tax / LLET filing requirement.",
    source: "https://taxanswers.ky.gov/Income-Taxes/Pages/Corporation-and-Pass-Through-Entity-Taxes-FAQs.aspx",
    note: "KRS 141.010 doing-business standard includes 'directing activities at Kentucky customers.' The Limited Liability Entity Tax (LLET) is a gross-receipts-based tax with a $175 minimum that applies alongside income tax once nexus exists.",
  },
  LA: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” any corporation deriving income from Louisiana sources must file a Louisiana return, whether or not it owes tax.",
    source: "https://revenue.louisiana.gov/businesses/business-taxes/coporate-income-franchise-tax/",
    note: "Louisiana has not adopted a factor-presence standard (2023 HB 518 proposing $500k sales bright-line was not enacted); nexus is facts-and-circumstances. Corporation franchise tax is repealed for periods beginning on or after 1/1/2026.",
  },
  MA: {
    basis: "factor-presence",
    threshold_usd: 500000,
    indexed: false,
    label: "Corporate excise nexus is presumed at more than $500,000 of Massachusetts-source receipts (bright-line regulation 830 CMR 63.39.1), even with no physical presence.",
    source: "https://www.mass.gov/regulations/830-CMR-63391-corporate-nexus",
    note: "The $500k presumption is technically rebuttable, and DOR aggregates receipts of related unitary-group companies toward the threshold. Effective for tax years beginning on or after 1/1/2019.",
  },
  MD: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Maryland corporate income tax nexus rests on a doing-business/nexus standard, and Maryland-source income can create a filing obligation at any level.",
    source: "https://taxes.marylandtaxes.gov/Business_Taxes/Business_Tax_Types/Income_Tax/Tax_Information/Corporations/Nexus_Information.shtml",
    note: "The $100,000 figure often seen for Maryland is sales/use tax economic nexus, not income tax.",
  },
  ME: {
    basis: "factor-presence",
    threshold_usd: 500000,
    indexed: false,
    label: "Income-tax nexus at $500,000+ of Maine-sourced sales (factor presence), for tax years beginning on or after January 1, 2022.",
    source: "https://legislature.maine.gov/statutes/36/title36sec5200-B.html",
    note: "36 M.R.S. 5200-B: nexus also triggered by $250k Maine property, $250k Maine payroll, or 25% of total property/payroll/sales in Maine. Thresholds are fixed in statute (not indexed).",
  },
  MI: {
    basis: "factor-presence",
    threshold_usd: 350000,
    indexed: false,
    label: "Corporate Income Tax nexus at $350,000+ of Michigan-sourced gross receipts if the company also actively solicits sales in Michigan (mail, phone, email, advertising, or a website transacting with Michigan customers).",
    source: "https://www.michigan.gov/taxes/business-taxes/cit/detail/nexus-and-apportionment-2",
    note: "MCL 206.621: nexus = physical presence >1 day, OR active solicitation + $350k Michigan gross receipts, OR ownership of a flow-through entity with Michigan nexus. CIT applies to C corporations; threshold not indexed.",
  },
  MN: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Minnesota asserts corporate franchise tax nexus over any business earning income from Minnesota sources or customers (a minimum-contacts, doing-business standard), even with no physical presence.",
    source: "https://www.revenue.state.mn.us/nexus-minnesota-taxes",
    note: "The $100,000/200-transaction figures for Minnesota are sales tax only. Services received in Minnesota can be taxed even if performed remotely.",
  },
  MO: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” a corporation with Missouri-source gross income of as little as $100 that files a federal return must file a Missouri corporate return.",
    source: "https://dor.mo.gov/faq/taxation/business/corporation-income.html",
    note: "Chapter 143 RSMo filing floor is effectively any level ($100 of Missouri-source gross income). No factor-presence statute.",
  },
  MS: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” any corporation doing business in or earning income from Mississippi sources is required to file a Mississippi corporate income and franchise tax return.",
    source: "https://www.dor.ms.gov/business/corporate-income-and-franchise-tax",
    note: "The $250,000 'substantial economic presence' figure for Mississippi is sales/use tax, not income tax. The franchise tax (on apportioned capital) rides along with doing business in the state.",
  },
  MT: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Montana applies an economic-presence standard, and generally any activity in or with Montana beyond soliciting sales of tangible goods creates nexus and a filing requirement.",
    source: "https://revenue.mt.gov/taxes/nexus",
    note: "Montana DOR states explicitly that no specific dollar amount or transaction count automatically establishes (or avoids) income tax nexus; it weighs sales, employees, property, and use of Montana resources.",
  },
  NC: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” North Carolina applies a doing-business/economic-presence standard (17 NCAC 5C .0102), so income-producing activity with NC customers can create corporate income and franchise tax filing obligations at any level.",
    source: "https://www.ncdor.gov/taxes-forms/corporate-income-franchise-tax/filing-requirements",
    note: "The franchise tax attaches alongside the income tax for corporations doing business in NC. NC's $100,000 threshold is sales/use tax only.",
  },
  ND: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” every corporation doing business in or having income from North Dakota sources must file a corporate return; the state applies an economic-presence standard with no dollar trigger.",
    source: "https://www.tax.nd.gov/business/corporate-income-tax",
    note: "Form 40 required for any ND-source income; regular, systematic activity with ND customers can create nexus without physical presence.",
  },
  NE: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Nebraska asserts corporate income tax nexus on economic presence (sales into or business activity in the state), with no fixed dollar trigger.",
    source: "https://revenue.nebraska.gov/about/frequently-asked-questions/business-income-tax-faqs",
    note: "Service businesses get no P.L. 86-272 protection; Nebraska-source service receipts can create a filing obligation at any material level.",
  },
  NH: {
    basis: "doing-business",
    threshold_usd: 109000,
    indexed: true,
    label: "New Hampshire's Business Profits Tax return is required once a business with NH business activity has more than $109,000 of gross business income (2025, from ALL activities everywhere, not just NH), and the Business Enterprise Tax return at more than $298,000 of gross receipts or enterprise value tax base.",
    source: "https://www.revenue.nh.gov/news-and-media/business-enterprise-tax-and-business-profits-tax-filing-threshold-adjustment",
    note: "Nexus itself is a doing-business standard with no NH-source bright line; the $109k (BPT) and $298k (BET) figures are filing floors measured on total everywhere receipts, adjusted biennially for CPI (next adjustment for periods beginning on/after 1/1/2027). NH has no tax on wage income but very much taxes business entities.",
  },
  NJ: {
    basis: "factor-presence",
    threshold_usd: 100000,
    indexed: false,
    label: "Corporation Business Tax nexus at more than $100,000 of New Jersey-sourced receipts OR 200+ separate transactions delivered to New Jersey customers (bright-line, for privilege periods ending on or after July 31, 2023).",
    source: "https://www.nj.gov/treasury/taxation/pdf/pubs/tb/tb108.pdf",
    note: "P.L. 2023, c.96 / TB-108. This is an income-tax (CBT) bright line, unusual in including a 200-transaction prong; for services, receipts are sourced to where the benefit is received (market-based). Threshold not indexed.",
  },
  NM: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold for corporate income tax â€” any corporation transacting business in, into, or from New Mexico or deriving income from New Mexico property or employment has nexus.",
    source: "https://www.tax.newmexico.gov/businesses/determining-nexus/",
    note: "Separate caution: New Mexico's Gross Receipts Tax (its sales-tax analogue) taxes services and applies to remote sellers at $100,000 of NM receipts â€” that is a GRT/sales-type obligation, distinct from the income tax nexus described here.",
  },
  NV: {
    basis: "gross-receipts",
    threshold_usd: 4000000,
    indexed: false,
    label: "Nevada has no corporate income tax; its Commerce Tax return is required only when Nevada-sitused gross revenue exceeds $4,000,000 in the July-June taxable year.",
    source: "https://www.leg.state.nv.us/nrs/NRS-363C.html",
    note: "NRS 363C: businesses at or below $4M Nevada gross revenue are not required to file (filing requirement for under-threshold entities was removed in 2023). A 2025 bill (AB276) to CPI-index the threshold did not pass â€” it remains a flat $4,000,000.",
  },
  NY: {
    basis: "factor-presence",
    threshold_usd: 1283000,
    indexed: true,
    label: "Corporate franchise tax (Article 9-A) nexus when a corporation derives $1,283,000 or more of receipts from New York activity (threshold for tax years beginning in 2024-2026; indexed).",
    source: "https://www.tax.ny.gov/bus/ct/article9a_deriving_receipts.htm",
    note: "Originally $1,000,000; the Commissioner reviews annually and adjusts when cumulative CPI change reaches 10%+ ($1,138,000 for 2022-2023, $1,283,000 for 2024-2026). A parallel deriving-receipts test applies for the MTA surcharge in the MCTD. Related-member receipts can be aggregated.",
  },
  OH: {
    basis: "gross-receipts",
    threshold_usd: 6000000,
    indexed: false,
    label: "Ohio has no corporate income tax; its Commercial Activity Tax (CAT) now requires registration and filing only once Ohio gross receipts exceed $6 million a year (2025 and later).",
    source: "https://tax.ohio.gov/business/commercial-activity-tax",
    note: "Exclusion was $150k through 2023, $3M in 2024, $6M from 2025; annual minimum tax eliminated 2024. The old $500k bright-line nexus factor remains in statute but is moot below the $6M exclusion â€” businesses under it can cancel registration and owe no CAT filing.",
  },
  OK: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Oklahoma income-tax nexus rests on a facts-and-circumstances doing-business standard, and income derived from Oklahoma sources can be taxable at any level.",
    source: "https://oklahoma.gov/tax/helpcenter/businesses.html",
    note: "OAC 710:50-17-3 lists nexus-creating activities as non-exclusive guidelines; the $100k figure seen in searches is sales/use tax only, not income tax.",
  },
  OR: {
    basis: "gross-receipts",
    threshold_usd: 750000,
    indexed: false,
    label: "Oregon's Corporate Activity Tax (CAT) requires registration at $750,000 of Oregon commercial activity; a return and tax are due once taxable commercial activity tops $1 million.",
    source: "https://www.oregon.gov/dor/programs/businesses/pages/corporate-activity-tax.aspx",
    note: "Two-step: $750k register (within 30 days), $1M file/pay ($250 + 0.57% above $1M). Separately, Oregon's corporate excise/income tax uses a substantial-nexus doing-business standard with no bright line, so Oregon-source income can also trigger an income-tax return.",
  },
  PA: {
    basis: "factor-presence",
    threshold_usd: 500000,
    indexed: false,
    label: "Corporate net income tax nexus is presumed at $500,000 or more of Pennsylvania-sourced receipts (including services), even with no physical presence.",
    source: "https://www.pa.gov/content/dam/copapwp-pagov/en/revenue/documents/taxlawpoliciesbulletinsnotices/taxbulletins/ct/documents/ct_bulletin_2019-04.pdf",
    note: "Rebuttable presumption per Corporation Tax Bulletin 2019-04 (effective 2020); codified by Act 53 of 2022 for tax years beginning after 2022.",
  },
  RI: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Rhode Island asserts nexus over any corporation deriving income from Rhode Island sources or with a significant economic presence, at any dollar level.",
    source: "https://rules.sos.ri.gov/regulations/Part/280-20-25-8",
    note: "Reg. 280-RICR-20-25-8: economic presence alone can create business corporation tax nexus; a $400 minimum tax applies once a return is due.",
  },
  SC: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” South Carolina uses an economic-presence doing-business standard, so income earned from South Carolina customers can create a filing duty at any level.",
    source: "https://dor.sc.gov/businesses/nexus",
    note: "Economic-presence state since Geoffrey v. SC Tax Comm'n; physical presence not required for income tax nexus.",
  },
  SD: {
    basis: "no-income-tax",
    threshold_usd: null,
    indexed: false,
    label: "South Dakota has no corporate income tax and no gross-receipts business tax, so an out-of-state service business owes no entity-level income-type filing regardless of revenue.",
    source: "https://dor.sd.gov/businesses/taxes/",
    note: "Only narrow exception is the bank franchise tax on financial institutions â€” not applicable to an insurance agency's commission income.",
  },
  TN: {
    basis: "factor-presence",
    threshold_usd: 500000,
    indexed: false,
    label: "Franchise and excise tax nexus at the lesser of $500,000 or 25% of total receipts sourced to Tennessee (bright-line factor presence), with no physical presence required.",
    source: "https://revenue.support.tn.gov/hc/en-us/articles/360057957112-F-E-16-Economic-Nexus-Standard",
    note: "Tennessee also levies a separate gross-receipts business tax on out-of-state businesses with substantial nexus; its filing floor is $100,000 of in-state sales (raised from $10k by the 2023 Tennessee Works Act).",
  },
  TX: {
    basis: "gross-receipts",
    threshold_usd: 500000,
    indexed: false,
    label: "Texas franchise (margin) tax nexus begins at $500,000 of Texas gross receipts even with no physical presence â€” a report is owed at that point, though tax is $0 until revenue tops the no-tax-due floor.",
    source: "https://comptroller.texas.gov/taxes/franchise/",
    note: "Two numbers: $500k economic-nexus/filing threshold (fixed, since 2020) vs. the indexed no-tax-due floor â€” $2,470,000 for 2024-25 reports, $2,650,000 for 2026. Since 2024 entities under the floor skip the No Tax Due Report but must still file a Public/Ownership Information Report.",
  },
  UT: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Utah corporate franchise/income tax nexus rests on a doing-business standard, and performing services whose benefit is received in Utah can create nexus at any revenue level.",
    source: "https://tax.utah.gov/forms-pubs/pub-37/",
    note: "Tax Commission Publication 37 (Business Activity and Nexus in Utah); the $100k figure is sales-tax-only.",
  },
  VA: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” every corporation with income from Virginia sources must file, with 'Virginia source income' shown by a positive apportionment factor from business activity in the state.",
    source: "https://www.tax.virginia.gov/corporation-income-tax",
    note: "Va. Code 58.1-441; registration with the State Corporation Commission independently triggers a filing duty; regulations carve out only de minimis activity (23VAC10-120-90 G).",
  },
  VT: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Vermont taxes corporations doing business in or receiving income from Vermont sources, so service income from Vermont customers can trigger filing at any level.",
    source: "https://tax.vermont.gov/sites/tax/files/documents/TB-70.pdf",
    note: "Technical Bulletin TB-70 describes nexus activities; a minimum corporate tax (starting at $100) applies once a return is due.",
  },
  WA: {
    basis: "gross-receipts",
    threshold_usd: 100000,
    indexed: false,
    label: "Washington has no income tax on business profits, but its B&O gross-receipts tax requires registration and filing once Washington-sourced gross receipts exceed $100,000 in the current or prior year.",
    source: "https://dor.wa.gov/education/industry-guides/out-state-businesses-reporting-thresholds-and-nexus",
    note: "Flat $100k economic-nexus threshold since 2020 (replaced the older indexed $285k receipts test); applies to service income sourced to Washington customers.",
  },
  WI: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold â€” Wisconsin's doing-business standard reaches out-of-state companies that regularly sell services to Wisconsin customers, at any revenue level.",
    source: "https://docs.legis.wisconsin.gov/document/administrativecode/Tax%202.82",
    note: "Rule Tax 2.82; 2019 Wis. Act 10 expanded 'doing business' to regular service sales into the state without a dollar floor. An economic development surcharge adds on only at $4M+ total gross receipts.",
  },
  WV: {
    basis: "doing-business",
    threshold_usd: null,
    indexed: false,
    label: "No bright-line revenue threshold for most businesses â€” West Virginia corporate net income tax nexus rests on an engaging-in-business standard, and West Virginia-source income can be taxable at any level.",
    source: "https://tax.wv.gov/business/corporateincometax/pages/corporateincometax.aspx",
    note: "A statutory bright line ($100,000 of WV receipts or 20+ customers) exists only for financial organizations; single-sales-factor, market-based sourcing since 2022 makes service receipts WV-sourced.",
  },
  WY: {
    basis: "no-income-tax",
    threshold_usd: null,
    indexed: false,
    label: "Wyoming has no corporate income tax and no gross-receipts business tax, so an out-of-state service business owes no entity-level income-type filing regardless of revenue.",
    source: "https://revenue.wyo.gov/",
    note: "Only entity-level charge is a small annual license/capital tax for entities registered with the WY Secretary of State â€” not revenue-based nexus.",
  },
};

export function nexusInfo(state: string): NexusInfo | undefined {
  return ECONOMIC_NEXUS[state as StateCode];
}
